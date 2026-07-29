-- ============================================================================
-- Migration 082: Alinhar RLS de departamentos e extras ao mapa de permissões.
--
-- Contexto: dois desalinhamentos entre a UI (PERMISSOES_PADRAO) e o banco:
--
-- 1) Departamentos — a UI permite ao perfil financeiro editar departamentos
--    (departamento.editar: gestor, dp1, dp2, mesa, financeiro), mas as policies
--    de INSERT/UPDATE exigiam is_admin() OR is_editor() — e is_editor() NÃO
--    inclui financeiro. Como UPDATE bloqueado por RLS afeta 0 linhas SEM erro,
--    a usuária clicava em "Atualizar", via o toast de sucesso e a lista
--    recarregava sem a mudança. DELETE idem (departamento.excluir: gestor,
--    financeiro). Aproveita e remove as policies legadas redundantes
--    ("... para editores", "delete apenas para admins") — policies permissivas
--    são combinadas com OR, então bastava uma por operação.
--
-- 2) Extras — a UI passa a permitir ao perfil mesa excluir um extra lançado
--    errado (nova ação extras.excluir: mesa). A policy de DELETE exigia
--    is_admin(); passa a aceitar mesa também.
-- ============================================================================

-- ============================================================
-- 1. Departamentos — INSERT/UPDATE com financeiro; DELETE com gestor/financeiro
-- ============================================================

DROP POLICY IF EXISTS "Permitir insert de departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.departamentos;
CREATE POLICY "Permitir insert de departamentos"
  ON public.departamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'financeiro'
    )
  );

DROP POLICY IF EXISTS "Permitir update de departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.departamentos;
CREATE POLICY "Permitir update de departamentos"
  ON public.departamentos
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'financeiro'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'financeiro'
    )
  );

DROP POLICY IF EXISTS "Permitir delete de departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.departamentos;
CREATE POLICY "Permitir delete de departamentos"
  ON public.departamentos
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso IN ('gestor', 'financeiro')
    )
  );

-- ============================================================
-- 2. Extras — DELETE também para mesa (extras.excluir na UI)
-- ============================================================

DROP POLICY IF EXISTS "Permitir delete de extras" ON public.extras;
CREATE POLICY "Permitir delete de extras"
  ON public.extras
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'mesa'
    )
  );
