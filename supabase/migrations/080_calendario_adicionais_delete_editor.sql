-- ============================================================================
-- Migration 080: Permitir que editores (adm, mesa, dp2, etc.) excluam dias do
-- calendário de adicionais.
--
-- Contexto: a importação de ponto (espelho Flit, "CORH - Adicionais e
-- Ocorrências") recria os dias do período — exclui os existentes e reinsere.
-- A policy de DELETE criada na migration 064 exigia is_admin(), então perfis
-- operacionais como "mesa" (que têm permissão de editar o calendário na UI,
-- ver PERMISSOES_PADRAO: adicionais.editar_calendario) recebiam erro de RLS
-- ao importar o ponto. Como INSERT e UPDATE já aceitam editores, o DELETE
-- passa a seguir a mesma regra.
-- ============================================================================

DROP POLICY IF EXISTS "calendario_adicionais_delete" ON public.calendario_adicionais;
-- Remove as policies legadas de DELETE (019 e 064) que exigiam is_admin();
-- policies permissivas são combinadas com OR, então elas ficariam redundantes.
DROP POLICY IF EXISTS "Permitir delete de calendario_adicionais" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.calendario_adicionais;

CREATE POLICY "calendario_adicionais_delete" ON public.calendario_adicionais
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.is_editor());
