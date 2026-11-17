-- 170_vt_lotes_carga_transacionais.sql
-- VT — persistência transacional dos lotes e aprovações (Etapa 3).
-- TESTADA EM TRANSAÇÃO DESFEITA em 15/11/2026; NÃO APLICADA EM PRODUÇÃO.
-- Depende da 169. Antes de aplicar: backup e autorização; nunca supabase db push.
--
-- Escrita autenticada SOMENTE por RPCs SECURITY DEFINER com is_editor().
-- SELECT autenticado; service_role integral; REVOKE ALL de anon nas 2 tabelas.

begin;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.vt_carga_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'confirmado', 'substituido')),
  versao_conteudo integer NOT NULL CHECK (versao_conteudo > 0),
  conteudo_hash text NOT NULL CHECK (conteudo_hash ~ '^[0-9a-f]{64}$'),
  versao_calculo text NOT NULL,
  versao_regras jsonb NOT NULL,
  fonte jsonb NOT NULL,
  linhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  totais_por_colaborador jsonb NOT NULL DEFAULT '[]'::jsonb,
  pendencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  necessidade_centavos integer NOT NULL,
  ajuste_centavos integer NOT NULL,
  valor_centavos integer CHECK (valor_centavos IS NULL OR valor_centavos >= 0),
  confirmacao jsonb,
  lote_substituido_id uuid REFERENCES public.vt_carga_lotes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lote_substituido_id IS NULL OR lote_substituido_id <> id),
  CHECK ((status = 'confirmado' AND confirmacao IS NOT NULL) OR status <> 'confirmado'),
  CHECK ((status = 'rascunho' AND confirmacao IS NULL) OR status <> 'rascunho')
);

CREATE INDEX IF NOT EXISTS vt_carga_lotes_competencia_idx
  ON public.vt_carga_lotes (competencia, status);
CREATE INDEX IF NOT EXISTS vt_carga_lotes_substituido_idx
  ON public.vt_carga_lotes (lote_substituido_id);
CREATE UNIQUE INDEX IF NOT EXISTS vt_carga_lotes_competencia_confirmada_unica_idx
  ON public.vt_carga_lotes (competencia) WHERE status = 'confirmado';

CREATE TABLE IF NOT EXISTS public.vt_lote_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.vt_carga_lotes(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id),
  divergencia_hash text NOT NULL CHECK (divergencia_hash ~ '^[0-9a-f]{64}$'),
  aprovada_por uuid NOT NULL,
  aprovada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lote_id, colaborador_id, divergencia_hash)
);

ALTER TABLE public.vt_carga_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_carga_lotes_select ON public.vt_carga_lotes
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.vt_carga_lotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_carga_lotes TO service_role;
REVOKE ALL ON public.vt_carga_lotes FROM anon;
CREATE TRIGGER trg_auditoria_vt_carga_lotes
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_carga_lotes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

ALTER TABLE public.vt_lote_aprovacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_lote_aprovacoes_select ON public.vt_lote_aprovacoes
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.vt_lote_aprovacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_lote_aprovacoes TO service_role;
REVOKE ALL ON public.vt_lote_aprovacoes FROM anon;
CREATE TRIGGER trg_auditoria_vt_lote_aprovacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_lote_aprovacoes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

-- ============================================================
-- A) Conversão e hash canônico idêntico ao TypeScript
-- ============================================================
CREATE OR REPLACE FUNCTION public.vt_lote_json(p public.vt_carga_lotes)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'competencia', p.competencia,
    'status', p.status,
    'versaoConteudo', p.versao_conteudo,
    'conteudoHash', p.conteudo_hash,
    'versaoCalculo', p.versao_calculo,
    'versaoRegras', p.versao_regras,
    'fonte', p.fonte,
    'linhas', p.linhas,
    'totaisPorColaborador', p.totais_por_colaborador,
    'pendencias', p.pendencias,
    'necessidadeCentavos', p.necessidade_centavos,
    'ajusteCentavos', p.ajuste_centavos,
    'valorCentavos', p.valor_centavos,
    'confirmacao', p.confirmacao,
    'loteSubstituidoId', p.lote_substituido_id
  );
$$;

CREATE OR REPLACE FUNCTION public.vt_json_array_texto_ord(p jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '[' || COALESCE(string_agg(item::text, ',' ORDER BY item::text), '') || ']'
    FROM jsonb_array_elements(COALESCE(p, '[]'::jsonb)) AS item;
$$;

CREATE OR REPLACE FUNCTION public.vt_json_valor_texto(p jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p IS NULL THEN 'null' ELSE p::text END;
$$;

CREATE OR REPLACE FUNCTION public.vt_total_canonico(p jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p IS NULL THEN RETURN 'null'; END IF;
  RETURN format(
    '{"ajusteCentavos":%s,"colaboradorId":%s,"excedenteTruncadoCentavos":%s,"lancamentoAjusteIds":%s,"necessidadeCentavos":%s,"pendenciaIds":%s,"status":%s,"valorCentavos":%s}',
    public.vt_json_valor_texto(p->'ajusteCentavos'),
    public.vt_json_valor_texto(p->'colaboradorId'),
    public.vt_json_valor_texto(p->'excedenteTruncadoCentavos'),
    public.vt_json_array_texto_ord(p->'lancamentoAjusteIds'),
    public.vt_json_valor_texto(p->'necessidadeCentavos'),
    public.vt_json_array_texto_ord(p->'pendenciaIds'),
    public.vt_json_valor_texto(p->'status'),
    public.vt_json_valor_texto(p->'valorCentavos')
  );
END $$;

CREATE OR REPLACE FUNCTION public.vt_divergencia_hash(p_anterior jsonb, p_atual jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(extensions.digest(format(
    '{"anterior":%s,"atual":%s}',
    public.vt_total_canonico(p_anterior),
    public.vt_total_canonico(p_atual)
  ), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.vt_lote_divergencias(p_anteriores jsonb, p_atuais jsonb)
RETURNS TABLE (colaborador_id text, divergencia_hash text)
LANGUAGE sql
STABLE
AS $$
  WITH ids AS (
    SELECT DISTINCT item->>'colaboradorId' AS id
      FROM jsonb_array_elements(COALESCE(p_anteriores, '[]'::jsonb)) AS item
    UNION
    SELECT DISTINCT item->>'colaboradorId' AS id
      FROM jsonb_array_elements(COALESCE(p_atuais, '[]'::jsonb)) AS item
  )
  SELECT ids.id,
         public.vt_divergencia_hash(a.total, n.total)
    FROM ids
    LEFT JOIN LATERAL (
      SELECT item AS total FROM jsonb_array_elements(COALESCE(p_anteriores, '[]'::jsonb)) AS item
       WHERE item->>'colaboradorId' = ids.id LIMIT 1
    ) a ON true
    LEFT JOIN LATERAL (
      SELECT item AS total FROM jsonb_array_elements(COALESCE(p_atuais, '[]'::jsonb)) AS item
       WHERE item->>'colaboradorId' = ids.id LIMIT 1
    ) n ON true
   WHERE public.vt_total_canonico(a.total) <> public.vt_total_canonico(n.total)
   ORDER BY ids.id;
$$;

-- ============================================================
-- B) Rascunho e aprovações
-- ============================================================
CREATE OR REPLACE FUNCTION public.vt_salvar_rascunho_lote(p_lote jsonb, p_versao_esperada integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := (p_lote->>'id')::uuid;
  v_versao integer := (p_lote->>'versaoConteudo')::integer;
  v_hash text := p_lote->>'conteudoHash';
  v_existente public.vt_carga_lotes;
  v_linha public.vt_carga_lotes;
BEGIN
  IF NOT public.is_editor() THEN RAISE EXCEPTION 'Somente editores podem salvar lotes de VT'; END IF;
  IF p_lote->>'status' <> 'rascunho' THEN RAISE EXCEPTION 'O lote salvo precisa estar em rascunho'; END IF;
  IF v_versao IS NULL OR v_versao < 1 THEN RAISE EXCEPTION 'Versão de conteúdo inválida'; END IF;
  IF v_hash IS NULL OR v_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Hash de conteúdo inválido'; END IF;

  SELECT * INTO v_existente FROM public.vt_carga_lotes WHERE id = v_id FOR UPDATE;
  IF FOUND THEN
    IF v_existente.status <> 'rascunho' OR v_existente.versao_conteudo <> p_versao_esperada
       OR v_versao <> v_existente.versao_conteudo + 1 THEN
      RAISE EXCEPTION 'O rascunho mudou ou já foi confirmado por outro operador';
    END IF;
  ELSIF p_versao_esperada <> 0 OR v_versao <> 1 THEN
    RAISE EXCEPTION 'Lote novo precisa começar na versão 1';
  END IF;

  INSERT INTO public.vt_carga_lotes (
    id, competencia, status, versao_conteudo, conteudo_hash,
    versao_calculo, versao_regras, fonte, linhas, totais_por_colaborador,
    pendencias, necessidade_centavos, ajuste_centavos, valor_centavos,
    confirmacao, lote_substituido_id
  ) VALUES (
    v_id, p_lote->>'competencia', 'rascunho', v_versao, v_hash,
    p_lote->>'versaoCalculo', p_lote->'versaoRegras', p_lote->'fonte',
    COALESCE(p_lote->'linhas', '[]'::jsonb),
    COALESCE(p_lote->'totaisPorColaborador', '[]'::jsonb),
    COALESCE(p_lote->'pendencias', '[]'::jsonb),
    (p_lote->>'necessidadeCentavos')::integer,
    (p_lote->>'ajusteCentavos')::integer,
    (p_lote->>'valorCentavos')::integer,
    NULL, NULLIF(p_lote->>'loteSubstituidoId', '')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    competencia = EXCLUDED.competencia,
    versao_conteudo = EXCLUDED.versao_conteudo,
    conteudo_hash = EXCLUDED.conteudo_hash,
    versao_calculo = EXCLUDED.versao_calculo,
    versao_regras = EXCLUDED.versao_regras,
    fonte = EXCLUDED.fonte,
    linhas = EXCLUDED.linhas,
    totais_por_colaborador = EXCLUDED.totais_por_colaborador,
    pendencias = EXCLUDED.pendencias,
    necessidade_centavos = EXCLUDED.necessidade_centavos,
    ajuste_centavos = EXCLUDED.ajuste_centavos,
    valor_centavos = EXCLUDED.valor_centavos,
    confirmacao = NULL,
    lote_substituido_id = EXCLUDED.lote_substituido_id
  RETURNING * INTO v_linha;
  RETURN public.vt_lote_json(v_linha);
END $$;

CREATE OR REPLACE FUNCTION public.vt_aprovar_divergencia(
  p_anterior_id uuid,
  p_novo_id uuid,
  p_colaborador_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anterior public.vt_carga_lotes;
  v_novo public.vt_carga_lotes;
  v_hash text;
BEGIN
  IF NOT public.is_editor() THEN RAISE EXCEPTION 'Somente editores podem aprovar divergências'; END IF;
  SELECT * INTO v_anterior FROM public.vt_carga_lotes WHERE id = p_anterior_id FOR SHARE;
  SELECT * INTO v_novo FROM public.vt_carga_lotes WHERE id = p_novo_id FOR SHARE;
  IF v_anterior.id IS NULL OR v_anterior.status <> 'confirmado' THEN
    RAISE EXCEPTION 'O lote anterior não está confirmado';
  END IF;
  IF v_novo.id IS NULL OR v_novo.status <> 'rascunho' THEN
    RAISE EXCEPTION 'O novo lote não está em rascunho';
  END IF;

  SELECT d.divergencia_hash INTO v_hash
    FROM public.vt_lote_divergencias(
      v_anterior.totais_por_colaborador,
      v_novo.totais_por_colaborador
    ) d
   WHERE d.colaborador_id = p_colaborador_id::text;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'A divergência não existe ou já foi alterada'; END IF;

  INSERT INTO public.vt_lote_aprovacoes (
    lote_id, colaborador_id, divergencia_hash, aprovada_por, aprovada_em
  ) VALUES (
    p_novo_id, p_colaborador_id, v_hash, auth.uid(), now()
  )
  ON CONFLICT (lote_id, colaborador_id, divergencia_hash) DO UPDATE
    SET aprovada_por = EXCLUDED.aprovada_por, aprovada_em = EXCLUDED.aprovada_em;
  RETURN v_hash;
END $$;

-- ============================================================
-- C) Confirmação e substituição atômicas
-- ============================================================
CREATE OR REPLACE FUNCTION public.vt_confirmar_lote(p_lote_id uuid, p_versao_esperada integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote public.vt_carga_lotes;
BEGIN
  IF NOT public.is_editor() THEN RAISE EXCEPTION 'Somente editores podem confirmar lotes'; END IF;
  SELECT * INTO v_lote FROM public.vt_carga_lotes WHERE id = p_lote_id FOR UPDATE;
  IF v_lote.id IS NULL THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
  IF v_lote.status = 'confirmado' THEN RAISE EXCEPTION 'O lote já está confirmado'; END IF;
  IF v_lote.status <> 'rascunho' OR v_lote.versao_conteudo <> p_versao_esperada THEN
    RAISE EXCEPTION 'A versão do lote mudou; recarregue antes de confirmar';
  END IF;
  IF v_lote.lote_substituido_id IS NOT NULL THEN
    RAISE EXCEPTION 'Substituição exige aprovações; use vt_confirmar_substituto';
  END IF;
  IF v_lote.valor_centavos IS NULL OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lote.totais_por_colaborador) total
     WHERE total->>'status' = 'parcial'
  ) THEN
    RAISE EXCEPTION 'O lote tem pendências e não pode ser confirmado';
  END IF;

  UPDATE public.vt_carga_lotes
     SET status = 'confirmado',
         confirmacao = jsonb_build_object(
           'versaoConteudo', v_lote.versao_conteudo,
           'conteudoHash', v_lote.conteudo_hash,
           'confirmadaPor', auth.uid(),
           'confirmadaEm', now()
         )
   WHERE id = p_lote_id
  RETURNING * INTO v_lote;
  RETURN public.vt_lote_json(v_lote);
END $$;

CREATE OR REPLACE FUNCTION public.vt_confirmar_substituto(
  p_anterior_id uuid,
  p_versao_esperada_anterior integer,
  p_novo_id uuid,
  p_versao_esperada_novo integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anterior public.vt_carga_lotes;
  v_novo public.vt_carga_lotes;
  v_linha record;
  v_divergencia record;
BEGIN
  IF NOT public.is_editor() THEN RAISE EXCEPTION 'Somente editores podem substituir lotes'; END IF;
  IF p_anterior_id = p_novo_id THEN RAISE EXCEPTION 'O substituto precisa ser outro lote'; END IF;

  FOR v_linha IN
    SELECT * FROM public.vt_carga_lotes
     WHERE id IN (p_anterior_id, p_novo_id) ORDER BY id FOR UPDATE
  LOOP
    IF v_linha.id = p_anterior_id THEN v_anterior := v_linha;
    ELSE v_novo := v_linha;
    END IF;
  END LOOP;

  IF v_anterior.id IS NULL OR v_anterior.status <> 'confirmado'
     OR v_anterior.versao_conteudo <> p_versao_esperada_anterior THEN
    RAISE EXCEPTION 'O lote anterior mudou ou já foi substituído';
  END IF;
  IF v_novo.id IS NULL OR v_novo.status <> 'rascunho'
     OR v_novo.versao_conteudo <> p_versao_esperada_novo THEN
    RAISE EXCEPTION 'O novo lote mudou ou já foi confirmado';
  END IF;
  IF v_novo.lote_substituido_id IS NOT NULL AND v_novo.lote_substituido_id <> p_anterior_id THEN
    RAISE EXCEPTION 'O novo lote está vinculado a outro lote substituído';
  END IF;
  IF v_novo.valor_centavos IS NULL OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_novo.totais_por_colaborador) total
     WHERE total->>'status' = 'parcial'
  ) THEN
    RAISE EXCEPTION 'O novo lote tem pendências e não pode ser confirmado';
  END IF;

  FOR v_divergencia IN
    SELECT * FROM public.vt_lote_divergencias(
      v_anterior.totais_por_colaborador,
      v_novo.totais_por_colaborador
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.vt_lote_aprovacoes a
       WHERE a.lote_id = p_novo_id
         AND a.colaborador_id::text = v_divergencia.colaborador_id
         AND a.divergencia_hash = v_divergencia.divergencia_hash
    ) THEN
      RAISE EXCEPTION 'Divergência sem aprovação para o colaborador %', v_divergencia.colaborador_id;
    END IF;
  END LOOP;

  UPDATE public.vt_carga_lotes SET status = 'substituido' WHERE id = p_anterior_id;
  UPDATE public.vt_carga_lotes
     SET status = 'confirmado',
         lote_substituido_id = p_anterior_id,
         confirmacao = jsonb_build_object(
           'versaoConteudo', v_novo.versao_conteudo,
           'conteudoHash', v_novo.conteudo_hash,
           'confirmadaPor', auth.uid(),
           'confirmadaEm', now()
         )
   WHERE id = p_novo_id
  RETURNING * INTO v_novo;
  RETURN public.vt_lote_json(v_novo);
END $$;

-- Execução direta de helpers fica restrita a service_role; RPCs são dos editores.
REVOKE ALL ON FUNCTION public.vt_lote_json(public.vt_carga_lotes) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vt_json_array_texto_ord(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vt_json_valor_texto(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vt_total_canonico(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vt_divergencia_hash(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vt_lote_divergencias(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vt_lote_json(public.vt_carga_lotes) TO service_role;
GRANT EXECUTE ON FUNCTION public.vt_json_array_texto_ord(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.vt_json_valor_texto(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.vt_total_canonico(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.vt_divergencia_hash(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.vt_lote_divergencias(jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.vt_salvar_rascunho_lote(jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vt_aprovar_divergencia(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vt_confirmar_lote(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vt_confirmar_substituto(uuid, integer, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vt_salvar_rascunho_lote(jsonb, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vt_aprovar_divergencia(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vt_confirmar_lote(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vt_confirmar_substituto(uuid, integer, uuid, integer) TO authenticated, service_role;

commit;
