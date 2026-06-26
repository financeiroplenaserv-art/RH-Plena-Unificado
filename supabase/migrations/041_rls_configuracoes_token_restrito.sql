-- Migração 041: Reforça RLS da tabela configuracoes para a chave econtador_token
--
-- Contexto: a migration 030 permitiu que qualquer "editor" (rh, gestor, mesa,
-- inspetoria, financeiro, dp1, dp2) inserisse/alterasse qualquer chave de
-- configuracoes, incluindo o token cifrado do e-Contador. Além disso, o
-- DROP POLICY usou nome diferente da policy criada na migration 015, deixando
-- a policy antiga de SELECT ativa.
--
-- Esta migration:
--   - Remove a policy antiga de SELECT do token (nome correto da migration 015).
--   - Restringe INSERT/UPDATE da chave 'econtador_token' a admin/adm/dp1/dp2.
--   - Mantém INSERT/UPDATE de outras chaves para editores.
--   - Mantém SELECT geral exceto o token e DELETE apenas para admin.

-- ============================================================
-- 1. Função auxiliar: admin/adm/dp1/dp2 podem gerenciar o token
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_ou_dp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'dp1', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_ou_dp() TO authenticated;

-- ============================================================
-- 2. Limpa policies antigas/conflitantes de configuracoes
-- ============================================================

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select geral de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select de econtador_token para admin/rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.configuracoes;

-- ============================================================
-- 3. Recria policies de configuracoes de forma segura
-- ============================================================

-- SELECT: autenticados leem tudo, EXCETO o token do e-Contador
CREATE POLICY "Permitir select geral de configuracoes"
  ON public.configuracoes
  FOR SELECT
  TO authenticated
  USING (chave <> 'econtador_token');

-- INSERT/UPDATE de chaves comuns: editores podem inserir/atualizar
CREATE POLICY "Permitir insert de configuracoes"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir update de configuracoes"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

-- INSERT/UPDATE do token e-Contador: apenas admin/adm/dp1/dp2
CREATE POLICY "Permitir insert token eContador apenas admin dp"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

CREATE POLICY "Permitir update token eContador apenas admin dp"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave = 'econtador_token' AND public.is_admin_ou_dp())
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

-- DELETE: apenas admin
CREATE POLICY "Permitir delete apenas para admins"
  ON public.configuracoes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
