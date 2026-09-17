-- Migração 110: Ocorrências — exclusão assistida (só admin/adm, só canceladas)
--
-- Decisão da gestão (17/09/2026): a exclusão de ocorrência deixa de ser SQL
-- manual (com backup feito à mão) e vira fluxo assistido no app:
--
-- 1. Tabela ocorrencias_excluidas_log — arquivo morto com a cópia integral da
--    ocorrência e das filhas (anexos, testemunhas, aprovações, defesas) em
--    JSONB, mais o motivo e quem excluiu. Retenção de 90 dias (LGPD), com
--    purge oportunista a cada exclusão — não depende de pg_cron.
--
-- 2. RPC excluir_ocorrencia_admin (SECURITY DEFINER) — confere is_admin(),
--    exige status 'Cancelada' (a exclusão é o passo DEPOIS do cancelamento
--    formal) e motivo obrigatório; arquiva, exclui as filhas e a ocorrência
--    numa única transação e devolve os caminhos dos anexos para o frontend
--    remover os arquivos do bucket ocorrencia-anexos (a RPC não alcança o
--    storage; a remoção é best-effort no cliente).
--
-- O trigger de auditoria (migration 061) já registra o DELETE da ocorrência
-- em log_auditoria automaticamente — não é preciso log manual aqui.
--
-- Na mesma decisão, a listagem de ocorrências passou a esconder as Canceladas
-- por padrão (sentinela "exceto_canceladas" em src/lib/ocorrencias/
-- filtroStatus.ts) — o cancelamento é o destino formal do registro e a
-- cancelada visível gerava pedido de exclusão física.

-- ============================================================
-- 1. Arquivo morto das exclusões
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ocorrencias_excluidas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL,
  colaborador_nome text,
  tipo_ocorrencia text,
  data_ocorrencia date,
  dados jsonb NOT NULL,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  testemunhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  aprovacoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  defesas jsonb NOT NULL DEFAULT '[]'::jsonb,
  motivo text NOT NULL,
  excluido_por uuid,
  excluido_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ocorrencias_excluidas_log IS 'Arquivo morto das ocorrências excluídas pela RPC excluir_ocorrencia_admin: cópia integral do registro e das filhas, com motivo e autor. Retenção de 90 dias (purge oportunista na própria RPC).';

CREATE INDEX IF NOT EXISTS idx_ocorrencias_excluidas_log_excluido_em
  ON public.ocorrencias_excluidas_log(excluido_em);

ALTER TABLE public.ocorrencias_excluidas_log ENABLE ROW LEVEL SECURITY;

-- Leitura só para admin/adm (o arquivo contém dados pessoais). Nenhuma policy
-- de escrita para autenticados: quem escreve é a RPC (o dono ignora RLS).
CREATE POLICY "Permitir select do log de exclusoes de ocorrencias"
  ON public.ocorrencias_excluidas_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 2. RPC de exclusão assistida
-- ============================================================

CREATE OR REPLACE FUNCTION public.excluir_ocorrencia_admin(p_ocorrencia_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc public.ocorrencias%ROWTYPE;
  v_anexos jsonb;
  v_testemunhas jsonb;
  v_aprovacoes jsonb;
  v_defesas jsonb;
  v_caminhos jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas admin/adm podem excluir ocorrências';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da exclusão';
  END IF;

  SELECT * INTO v_oc FROM public.ocorrencias WHERE id = p_ocorrencia_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ocorrência não encontrada';
  END IF;
  IF v_oc.status <> 'Cancelada' THEN
    RAISE EXCEPTION 'Só é possível excluir ocorrências com status Cancelada (cancele primeiro)';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO v_anexos
    FROM public.ocorrencia_anexos a WHERE a.ocorrencia_id = p_ocorrencia_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_testemunhas
    FROM public.ocorrencia_testemunhas t WHERE t.ocorrencia_id = p_ocorrencia_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(ap)), '[]'::jsonb) INTO v_aprovacoes
    FROM public.ocorrencia_aprovacoes ap WHERE ap.ocorrencia_id = p_ocorrencia_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_defesas
    FROM public.ocorrencia_defesas d WHERE d.ocorrencia_id = p_ocorrencia_id;
  SELECT COALESCE(jsonb_agg(a.caminho_storage), '[]'::jsonb) INTO v_caminhos
    FROM public.ocorrencia_anexos a WHERE a.ocorrencia_id = p_ocorrencia_id;

  INSERT INTO public.ocorrencias_excluidas_log (
    ocorrencia_id, colaborador_nome, tipo_ocorrencia, data_ocorrencia,
    dados, anexos, testemunhas, aprovacoes, defesas, motivo, excluido_por
  ) VALUES (
    v_oc.id, v_oc.colaborador_nome, v_oc.tipo_ocorrencia, v_oc.data_ocorrencia,
    to_jsonb(v_oc), v_anexos, v_testemunhas, v_aprovacoes, v_defesas,
    btrim(p_motivo), auth.uid()
  );

  DELETE FROM public.ocorrencia_anexos WHERE ocorrencia_id = p_ocorrencia_id;
  DELETE FROM public.ocorrencia_testemunhas WHERE ocorrencia_id = p_ocorrencia_id;
  DELETE FROM public.ocorrencia_aprovacoes WHERE ocorrencia_id = p_ocorrencia_id;
  DELETE FROM public.ocorrencia_defesas WHERE ocorrencia_id = p_ocorrencia_id;
  DELETE FROM public.ocorrencias WHERE id = p_ocorrencia_id;

  -- Retenção do arquivo morto: 90 dias (LGPD). Purge oportunista a cada
  -- exclusão — não depende de pg_cron.
  DELETE FROM public.ocorrencias_excluidas_log
  WHERE excluido_em < now() - interval '90 days';

  RETURN jsonb_build_object('ok', true, 'caminhos_storage', v_caminhos);
END;
$$;

-- A guarda interna (is_admin) é a autorização; como nas demais RPCs do
-- projeto, o EXECUTE fica liberado para autenticados.
GRANT EXECUTE ON FUNCTION public.excluir_ocorrencia_admin(uuid, text) TO authenticated;
