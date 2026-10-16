-- Migração 131: recria 3 funções cujos acentos foram corrompidos (U+FFFD) ao
-- aplicar as migrations 110/115/117 via Management API com SQL inline no
-- PowerShell 5.1 (sem -Encoding UTF8).
--
-- Impacto real encontrado em 16/10/2026: a RPC validar_documentos_ocorrencia
-- (115) comparava o status com o literal corrompido 'Aguardando Valida??o',
-- que nunca casa — TODA validação/devolução de documentos falhava com
-- "A ocorrência não está aguardando validação (status atual: Aguardando
-- Validação)". As outras duas (excluir_ocorrencia_admin da 110 e
-- salvar_dados_cracha da 117) tinham a corrupção só em mensagens/comentários
-- (a lógica compara literais ASCII) — recriadas aqui por higiene.
--
-- Os corpos são VERBATIM das migrations de origem (110/115/117), só com os
-- acentos corretos. Nenhuma mudança de comportamento além do conserto.
-- Não cria tabela — sem GRANT de tabela.
-- APLICAR via scripts/lib/executar-arquivo-sql-management-api.ps1 (arquivo
-- UTF-8) — NUNCA inline no -Query.

-- ============================================================
-- 1) validar_documentos_ocorrencia (origem: migration 115)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validar_documentos_ocorrencia(
  p_ocorrencia_id uuid,
  p_aprovado boolean,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil text;
  v_status text;
BEGIN
  SELECT nivel_acesso INTO v_perfil FROM public.perfis WHERE id = auth.uid();
  IF v_perfil IS NULL OR v_perfil NOT IN ('admin', 'adm', 'dp1', 'dp2') THEN
    RAISE EXCEPTION 'Apenas admin, adm, dp1 ou dp2 podem validar documentos de ocorrências';
  END IF;

  SELECT status INTO v_status FROM public.ocorrencias WHERE id = p_ocorrencia_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ocorrência não encontrada';
  END IF;
  IF v_status <> 'Aguardando Validação' THEN
    RAISE EXCEPTION 'A ocorrência não está aguardando validação (status atual: %)', v_status;
  END IF;

  IF p_aprovado THEN
    UPDATE public.ocorrencias
    SET status = 'Ativa',
        validado_por = auth.uid(),
        validado_em = now(),
        devolvido_por = NULL,
        devolvido_em = NULL,
        devolucao_motivo = NULL
    WHERE id = p_ocorrencia_id;
  ELSE
    IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
      RAISE EXCEPTION 'Informe o motivo da devolução';
    END IF;
    UPDATE public.ocorrencias
    SET status = 'Pendente',
        devolvido_por = auth.uid(),
        devolvido_em = now(),
        devolucao_motivo = btrim(p_motivo)
    WHERE id = p_ocorrencia_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_documentos_ocorrencia(uuid, boolean, text) TO authenticated;

-- ============================================================
-- 2) excluir_ocorrencia_admin (origem: migration 110)
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

-- ============================================================
-- 3) salvar_dados_cracha (origem: migration 117)
-- ============================================================
CREATE OR REPLACE FUNCTION public.salvar_dados_cracha(
  p_colaborador_id uuid,
  p_nome_cracha text DEFAULT NULL,
  p_foto_path text DEFAULT NULL,
  p_atualizar_nome boolean DEFAULT false,
  p_atualizar_foto boolean DEFAULT false,
  p_cargo_cracha text DEFAULT NULL,
  p_atualizar_cargo boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_cargo text;
  v_foto text;
  v_linhas integer;
BEGIN
  IF NOT public.pode_emitir_cracha() THEN
    RAISE EXCEPTION 'Sem permissão para emitir crachás';
  END IF;

  v_nome := NULLIF(btrim(COALESCE(p_nome_cracha, '')), '');
  v_cargo := NULLIF(btrim(COALESCE(p_cargo_cracha, '')), '');
  v_foto := NULLIF(btrim(COALESCE(p_foto_path, '')), '');

  IF v_nome IS NOT NULL AND char_length(v_nome) > 120 THEN
    RAISE EXCEPTION 'Nome do crachá longo demais (máximo 120 caracteres)';
  END IF;

  IF v_cargo IS NOT NULL AND char_length(v_cargo) > 120 THEN
    RAISE EXCEPTION 'Função do crachá longa demais (máximo 120 caracteres)';
  END IF;

  -- A foto só pode apontar para um arquivo do próprio colaborador (<id>.jpg)
  IF v_foto IS NOT NULL AND left(v_foto, char_length(p_colaborador_id::text) + 1) <> p_colaborador_id::text || '.' THEN
    RAISE EXCEPTION 'Caminho de foto inválido para este colaborador';
  END IF;

  IF NOT p_atualizar_nome AND NOT p_atualizar_foto AND NOT p_atualizar_cargo THEN
    RETURN false;
  END IF;

  UPDATE public.colaboradores
  SET nome_cracha = CASE WHEN p_atualizar_nome THEN v_nome ELSE nome_cracha END,
      cargo_cracha = CASE WHEN p_atualizar_cargo THEN v_cargo ELSE cargo_cracha END,
      foto_path = CASE WHEN p_atualizar_foto THEN v_foto ELSE foto_path END
  WHERE id = p_colaborador_id;

  GET DIAGNOSTICS v_linhas = ROW_COUNT;
  RETURN v_linhas > 0;
END;
$$;

-- Assinatura antiga (5 args) fora do caminho, como na 117
DROP FUNCTION IF EXISTS public.salvar_dados_cracha(uuid, text, text, boolean, boolean);

GRANT EXECUTE ON FUNCTION public.salvar_dados_cracha(uuid, text, text, boolean, boolean, text, boolean) TO authenticated;
