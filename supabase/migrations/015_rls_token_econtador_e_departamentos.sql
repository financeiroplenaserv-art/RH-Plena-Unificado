-- Migração 015: Protege token do eContador e alinha RLS de departamentos
--
-- Contexto:
--   1. O token da API Alterdata estava acessível a qualquer usuário autenticado
--      porque a tabela public.configuracoes permitia SELECT irrestrito.
--   2. A migration 005 criou policies permissivas para departamentos,
--      permitindo qualquer operação a qualquer usuário logado.
--
-- Esta migration:
--   - Restringe leitura/escrita da chave 'econtador_token' a admin e rh.
--   - Substitui as policies permissivas de departamentos pelas regras de nível
--     de acesso usadas nas demais tabelas (visualizador lê, gestor/rh editam,
--     admin deleta).

-- ============================================================
-- Função auxiliar: verifica se o usuário é admin ou rh
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_rh_ou_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'rh')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_rh_ou_admin() TO authenticated;

-- ============================================================
-- Protege a tabela configuracoes
-- ============================================================

-- Remove policies anteriores (migration 010 / 014)
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.configuracoes;

-- Leitura geral exceto token eContador
CREATE POLICY "Permitir select geral em configuracoes"
  ON public.configuracoes
  FOR SELECT TO authenticated
  USING (chave <> 'econtador_token');

-- Leitura do token eContador apenas para admin/rh
CREATE POLICY "Permitir select token eContador apenas admin rh"
  ON public.configuracoes
  FOR SELECT TO authenticated
  USING (chave = 'econtador_token' AND public.is_rh_ou_admin());

-- Escrita geral para editores exceto token
CREATE POLICY "Permitir insert em configuracoes"
  ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir update em configuracoes"
  ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

-- Escrita do token apenas para admin/rh
CREATE POLICY "Permitir insert token eContador apenas admin rh"
  ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_rh_ou_admin());

CREATE POLICY "Permitir update token eContador apenas admin rh"
  ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (chave = 'econtador_token' AND public.is_rh_ou_admin())
  WITH CHECK (chave = 'econtador_token' AND public.is_rh_ou_admin());

-- Delete apenas para admin
CREATE POLICY "Permitir delete apenas para admins"
  ON public.configuracoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- Alinha RLS de departamentos com as demais tabelas
-- ============================================================

-- Remove policies permissivas da migration 005
DROP POLICY IF EXISTS "Usuários autenticados podem ler departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar departamentos" ON public.departamentos;

-- Aplica policies restritas por nível de acesso
CREATE POLICY "Permitir select em departamentos"
  ON public.departamentos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Permitir insert em departamentos"
  ON public.departamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update em departamentos"
  ON public.departamentos
  FOR UPDATE TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete em departamentos"
  ON public.departamentos
  FOR DELETE TO authenticated
  USING (public.is_admin());
