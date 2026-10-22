-- 158_vt_coberturas.sql
-- Módulo VT (Vale-Transporte) — cobertura de FÉRIAS pelo ferista (decisão da
-- gestora, 21/10/2026 — docs/PLANO_MODULO_VT.md §10.9/§6.1). O Flit não mostra
-- para onde o ferista vai, então a cobertura é registro manual mínimo e a
-- carga mensal usa o posto da cobertura com PRIORIDADE sobre a escala.
-- Faltista (cobre falta, imprevisível) segue valor cheio pela escala — não
-- entra aqui. NÃO aplicada — a gestora aplica via Management API (script de
-- ARQUIVO, nunca inline — regra da migration 131).
--
--  A) vt_coberturas: ferista × posto coberto × período. Sem status — registro
--     operacional simples (errado = excluir e registrar de novo).
--
-- GRANT explícito em tabela nova (AGENTS.md §8). RLS: SELECT autenticado;
-- INSERT/UPDATE is_editor(); DELETE is_editor() também (registro operacional
-- do dia a dia — a Fase 1 usou is_admin() no DELETE de vt_trajetos por se
-- tratar de base de cálculo; a cobertura é lançamento corriqueiro, decidido
-- nesta migration). Sem seeds de permissão: reusa vt.gerenciar/vt.visualizar.
-- Idempotente.

begin;

-- ============================================================
-- A) Coberturas de férias (ferista → posto, período)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vt_coberturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacao text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS vt_coberturas_colab_periodo_idx
  ON public.vt_coberturas (colaborador_id, data_inicio, data_fim);

ALTER TABLE public.vt_coberturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vt_coberturas_select" ON public.vt_coberturas;
DROP POLICY IF EXISTS "vt_coberturas_insert" ON public.vt_coberturas;
DROP POLICY IF EXISTS "vt_coberturas_update" ON public.vt_coberturas;
DROP POLICY IF EXISTS "vt_coberturas_delete" ON public.vt_coberturas;
CREATE POLICY "vt_coberturas_select" ON public.vt_coberturas FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "vt_coberturas_insert" ON public.vt_coberturas FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_coberturas_update" ON public.vt_coberturas FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_coberturas_delete" ON public.vt_coberturas FOR DELETE TO authenticated
  USING ((SELECT public.is_editor()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_coberturas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_coberturas TO service_role;

commit;
