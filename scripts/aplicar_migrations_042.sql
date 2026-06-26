-- Migração 042: Limpa policies legadas/abertas em tabelas sensíveis
--
-- Contexto: após as migrations 040 e 041, ainda restaram policies antigas
-- com nomes diferentes (ex.: select_autenticado, perfil_proprio, write_admin_rh)
-- que mantinham SELECT aberto (USING (true)) em tabelas sensíveis.
--
-- Esta migration remove TODAS as policies de:
--   - public.perfis
--   - public.configuracoes
--   - public.auditoria
--   - public.log_auditoria
--
-- E recria apenas as policies necessárias, alinhadas com o modelo de permissão
-- atual do sistema.

-- ============================================================
-- 1. Garante funções auxiliares
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND nivel_acesso IN ('admin', 'adm')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_visualizador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND nivel_acesso = 'visualizador'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_ou_dp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'dp1', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_visualizador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_ou_dp() TO authenticated;

-- ============================================================
-- 2. Limpa e recria policies de PERFIS
-- ============================================================

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Remove TODAS as policies antigas
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'perfis'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.perfis;', r.policyname);
  END LOOP;
END
$$;

-- SELECT: usuário vê seu próprio perfil; editores veem todos
CREATE POLICY "Perfis select proprio ou editor"
  ON public.perfis
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_editor());

-- INSERT: usuário pode inserir apenas seu próprio perfil (sign-up)
CREATE POLICY "Perfis insert proprio"
  ON public.perfis
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: usuário pode alterar apenas seu próprio perfil
CREATE POLICY "Perfis update proprio"
  ON public.perfis
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DELETE: apenas admin
CREATE POLICY "Perfis delete admin"
  ON public.perfis
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. Limpa e recria policies de CONFIGURACOES
-- ============================================================

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'configuracoes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.configuracoes;', r.policyname);
  END LOOP;
END
$$;

-- SELECT: autenticados leem tudo, EXCETO o token do e-Contador
CREATE POLICY "Configuracoes select geral"
  ON public.configuracoes
  FOR SELECT
  TO authenticated
  USING (chave <> 'econtador_token');

-- INSERT/UPDATE de chaves comuns: editores
CREATE POLICY "Configuracoes insert comum"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Configuracoes update comum"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

-- INSERT/UPDATE do token e-Contador: apenas admin/adm/dp1/dp2
CREATE POLICY "Configuracoes insert token admin dp"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

CREATE POLICY "Configuracoes update token admin dp"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave = 'econtador_token' AND public.is_admin_ou_dp())
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

-- DELETE: apenas admin
CREATE POLICY "Configuracoes delete admin"
  ON public.configuracoes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 4. Limpa e recria policies de AUDITORIA
-- ============================================================

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auditoria'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.auditoria;', r.policyname);
  END LOOP;
END
$$;

-- Apenas SELECT restrito. INSERT/UPDATE/DELETE são feitos por triggers SECURITY DEFINER.
CREATE POLICY "Auditoria select restrito"
  ON public.auditoria
  FOR SELECT
  TO authenticated
  USING (NOT public.is_visualizador());

-- ============================================================
-- 5. Limpa e recria policies de LOG_AUDITORIA
-- ============================================================

ALTER TABLE public.log_auditoria ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'log_auditoria'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.log_auditoria;', r.policyname);
  END LOOP;
END
$$;

-- Apenas SELECT restrito. INSERT/UPDATE/DELETE são feitos por triggers SECURITY DEFINER.
CREATE POLICY "Log auditoria select restrito"
  ON public.log_auditoria
  FOR SELECT
  TO authenticated
  USING (NOT public.is_visualizador());
