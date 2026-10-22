-- 157_vt_cargas.sql
-- Módulo VT (Vale-Transporte) — Fase 2a (plano: docs/PLANO_MODULO_VT.md §6;
-- decisões da gestora de 21/10/2026). Carga mensal pela ESCALA do mês
-- seguinte: dias por posto × custo do dia do trajeto confirmado (bilhetes).
-- Sem reconciliação e sem desconto de 6% nesta etapa (ficam para depois).
-- NÃO aplicada — a gestora aplica via Management API (script de ARQUIVO, nunca
-- inline — regra da migration 131: SQL com acento só via arquivo UTF-8).
--
--  A) vt_cargas: uma carga por colaborador × competência ('AAAA-MM').
--     detalhe: array jsonb de { departamento_id, posto, dias,
--     custo_dia_centavos, subtotal_centavos } — foto do cálculo no momento da
--     gravação (a carga gravada não muda se o trajeto/bilhete mudar depois).
--     ajuste_centavos fica para a reconciliação (Fase seguinte); nasce 0.
--     valor_centavos = necessidade + ajuste, com piso 0 (nunca credita
--     negativo — regra da lib).
--
-- GRANT explícito em tabela nova (AGENTS.md §8); RLS padrão do módulo VT
-- (SELECT autenticado, INSERT/UPDATE is_editor(), DELETE is_admin()) — mesmo
-- desenho de vt_bilhetes/vt_trajetos (155). Sem seeds de permissão: a aba
-- Carga reusa vt.gerenciar/vt.visualizar. Idempotente.

begin;

-- ============================================================
-- A) Cargas mensais de VT
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vt_cargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  detalhe jsonb NOT NULL,
  necessidade_centavos integer NOT NULL,
  ajuste_centavos integer NOT NULL DEFAULT 0,
  valor_centavos integer NOT NULL,
  gerada_por uuid,
  gerada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, competencia)
);

ALTER TABLE public.vt_cargas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vt_cargas_select" ON public.vt_cargas;
DROP POLICY IF EXISTS "vt_cargas_insert" ON public.vt_cargas;
DROP POLICY IF EXISTS "vt_cargas_update" ON public.vt_cargas;
DROP POLICY IF EXISTS "vt_cargas_delete" ON public.vt_cargas;
CREATE POLICY "vt_cargas_select" ON public.vt_cargas FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "vt_cargas_insert" ON public.vt_cargas FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_cargas_update" ON public.vt_cargas FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_cargas_delete" ON public.vt_cargas FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_cargas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_cargas TO service_role;

commit;
