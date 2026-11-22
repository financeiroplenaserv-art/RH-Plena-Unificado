-- 176_vt_extras_mensais.sql
-- Módulo VT — "Extra no mês (R$)" por pessoa na carga (decisão da gestora, 22/11/2026).
-- Valor TOTAL do mês (não por dia), com motivo obrigatório, válido só para a
-- competência. Casos: quem vai a outros contratos no mesmo dia (DuoConnect),
-- cobertura de Montreal/Évora, faltista sem rota certa. Lançamento humano —
-- nada é automático. Entra no lote como crédito (origem 'extra_mensal') e NÃO
-- tem datas: o Fechamento (que lê detalhe[].datas) nunca o desconta nem credita.
-- PREPARADA, NÃO aplicada. Idempotente. Sem begin/commit (o teste monta a transação).
--
-- RLS: SELECT autenticado; INSERT/UPDATE/DELETE is_editor() (DELETE editor por
-- ser lançamento operacional corriqueiro, como vt_coberturas). GRANT explícito
-- e REVOKE de anon (AGENTS.md §8). Auditoria auditar_operacao (como a 168).


CREATE TABLE IF NOT EXISTS public.vt_extras_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  competencia text NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor_centavos integer NOT NULL CHECK (valor_centavos > 0),
  motivo text NOT NULL CHECK (length(btrim(motivo)) > 0),
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, competencia)
);

CREATE INDEX IF NOT EXISTS vt_extras_mensais_competencia_idx
  ON public.vt_extras_mensais (competencia);

ALTER TABLE public.vt_extras_mensais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vt_extras_mensais_select" ON public.vt_extras_mensais;
DROP POLICY IF EXISTS "vt_extras_mensais_insert" ON public.vt_extras_mensais;
DROP POLICY IF EXISTS "vt_extras_mensais_update" ON public.vt_extras_mensais;
DROP POLICY IF EXISTS "vt_extras_mensais_delete" ON public.vt_extras_mensais;
CREATE POLICY "vt_extras_mensais_select" ON public.vt_extras_mensais FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "vt_extras_mensais_insert" ON public.vt_extras_mensais FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_extras_mensais_update" ON public.vt_extras_mensais FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_extras_mensais_delete" ON public.vt_extras_mensais FOR DELETE TO authenticated
  USING ((SELECT public.is_editor()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_extras_mensais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_extras_mensais TO service_role;
REVOKE ALL ON public.vt_extras_mensais FROM anon;

DROP TRIGGER IF EXISTS trg_auditoria_vt_extras_mensais ON public.vt_extras_mensais;
CREATE TRIGGER trg_auditoria_vt_extras_mensais
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_extras_mensais
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

