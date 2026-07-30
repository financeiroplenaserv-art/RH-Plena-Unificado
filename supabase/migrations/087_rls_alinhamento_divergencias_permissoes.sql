-- ============================================================================
-- Migration 087: Alinhar backend (RLS/RPC) às permissões efetivas da UI —
-- auditoria das 34 divergências permissoes_perfil × PERMISSOES_PADRAO
-- (30/07/2026, script scripts/auditar-divergencias-permissoes.ts).
--
-- Mesmo padrão dos bugs corrigidos nas migrations 081–083: a tela Permissões
-- concede (dinâmico tem precedência), mas o banco bloqueia com listas de
-- perfis fixas — e UPDATE/DELETE falham EM SILÊNCIO (0 linhas, sem erro).
--
-- Concessões da tela que o backend bloqueava:
--   1. dp1/dp2 departamento.excluir        → DELETE de departamentos
--   2. dp2/mesa extras.cancelar_recibo     → RPC cancelar_recibo_extras
--   3. dp2/inspetoria extras.ver_relatorio, dp2 extras.ver_balanco
--                                          → SELECT de extras (pode_ver_extras)
--   4. inspetoria ocorrencia.criar/editar/aprovar
--                                          → INSERT/UPDATE de ocorrencias
--   5. dp1 adicionais.* (editar + ver_relatorio, este já no padrão)
--                                          → SELECT das tabelas de adicionais
--
-- Mesma falha já presente no mapa padrão (sem divergência dinâmica):
--   6. inspetoria extras.editar (padrão)   → INSERT/UPDATE de extras
--      (o mobile funciona porque usa RPC SECURITY DEFINER; o desktop falhava)
--   7. financeiro/inspetoria extras.editar_categoria e mesa/financeiro
--      extras.excluir_categoria (padrão)   → policies de categorias_extras
--
-- Restrições (tela mais restrita que o padrão) são intencionais e seguras —
-- nenhuma alteração. Observação registrada: com UPDATE em ocorrencias, a
-- inspetoria passa a poder também cancelar via chamada direta à API (a UI não
-- exibe a ação); as policies são por comando SQL, não por ação de negócio —
-- mesmo nível de granularidade que mesa/dp2 já tinham.
-- ============================================================================

-- (3) SELECT de extras: inclui dp2 e inspetoria.
CREATE OR REPLACE FUNCTION public.pode_ver_extras()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'mesa', 'financeiro', 'dp1', 'dp2', 'inspetoria')
  );
$$;

-- (5) SELECT das tabelas de adicionais: inclui dp1.
CREATE OR REPLACE FUNCTION public.pode_ver_adicionais()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'dp1', 'dp2', 'mesa', 'financeiro')
  );
$$;

-- (1) DELETE de departamentos: inclui dp1 e dp2.
DROP POLICY IF EXISTS "Permitir delete de departamentos" ON public.departamentos;
CREATE POLICY "Permitir delete de departamentos"
  ON public.departamentos
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('gestor', 'financeiro', 'dp1', 'dp2')
    )
  );

-- (2) RPC cancelar_recibo_extras: inclui dp2 e mesa (espelha a tela).
-- Corpo idêntico ao da migration 084 (unnest), só muda a checagem de perfil.
CREATE OR REPLACE FUNCTION public.cancelar_recibo_extras(p_recibo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('financeiro', 'dp2', 'mesa')
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar recibo';
  END IF;

  UPDATE public.extras
  SET status = 'Pendente'
  WHERE id IN (
    SELECT e.extra_id
    FROM public.recibos_extras r,
         LATERAL unnest(r.extras_ids) AS e(extra_id)
    WHERE r.id = p_recibo_id
  );

  UPDATE public.recibos_extras
  SET status = 'cancelado',
      updated_at = now()
  WHERE id = p_recibo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo não encontrado';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_recibo_extras(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_recibo_extras(uuid) TO authenticated;

-- (4) INSERT/UPDATE de ocorrencias: inclui inspetoria.
DROP POLICY IF EXISTS "Permitir insert de ocorrencias" ON public.ocorrencias;
CREATE POLICY "Permitir insert de ocorrencias"
  ON public.ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR public.is_rh_ou_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'inspetoria'
    )
  );

DROP POLICY IF EXISTS "Permitir update de ocorrencias" ON public.ocorrencias;
CREATE POLICY "Permitir update de ocorrencias"
  ON public.ocorrencias
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_editor()
    OR public.is_rh_ou_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'inspetoria'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR public.is_rh_ou_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'inspetoria'
    )
  );

-- (6) INSERT/UPDATE de extras: inclui inspetoria (já concedido no padrão da
-- tela; alinha o desktop ao que a RPC do mobile já permitia).
DROP POLICY IF EXISTS "Permitir insert de extras" ON public.extras;
CREATE POLICY "Permitir insert de extras"
  ON public.extras
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'inspetoria'
    )
  );

DROP POLICY IF EXISTS "Permitir update de extras" ON public.extras;
CREATE POLICY "Permitir update de extras"
  ON public.extras
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'inspetoria'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'inspetoria'
    )
  );

-- (7) categorias_extras: INSERT/UPDATE com financeiro e inspetoria; DELETE
-- com mesa e financeiro (espelha editar_categoria / excluir_categoria da tela).
DROP POLICY IF EXISTS "Permitir insert de categorias_extras" ON public.categorias_extras;
CREATE POLICY "Permitir insert de categorias_extras"
  ON public.categorias_extras
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('financeiro', 'inspetoria')
    )
  );

DROP POLICY IF EXISTS "Permitir update de categorias_extras" ON public.categorias_extras;
CREATE POLICY "Permitir update de categorias_extras"
  ON public.categorias_extras
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('financeiro', 'inspetoria')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('financeiro', 'inspetoria')
    )
  );

DROP POLICY IF EXISTS "Permitir delete de categorias_extras" ON public.categorias_extras;
CREATE POLICY "Permitir delete de categorias_extras"
  ON public.categorias_extras
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('mesa', 'financeiro')
    )
  );
