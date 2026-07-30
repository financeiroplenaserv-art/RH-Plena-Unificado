-- ============================================================================
-- Migration 091: DELETE em recibos_extras para admin e financeiro.
--
-- Decisão da gestão em 30/07/2026: admin e financeiro podem excluir recibos
-- de extras (ex.: recibo gerado errado/duplicado). Até aqui não existia
-- policy de DELETE — com RLS habilitado, ninguém excluía via API (só via
-- service role em scripts). O cancelamento formal continua sendo via RPC
-- cancelar_recibo_extras; o DELETE é para limpeza administrativa.
--
-- A condição espelha a da RPC cancelar_recibo_extras (migration 081):
-- is_admin() OU perfil financeiro.
-- ============================================================================

DROP POLICY IF EXISTS "Permitir delete de recibos_extras" ON public.recibos_extras;
CREATE POLICY "Permitir delete de recibos_extras"
  ON public.recibos_extras
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'financeiro'
    )
  );
