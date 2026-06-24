-- Migração 013: Remove a função auxiliar aplicar_rls_admin
--
-- Contexto: a função public.aplicar_rls_admin(TEXT) foi criada na migration 010
-- com SECURITY DEFINER e GRANT EXECUTE para authenticated. Isso permitia que
-- qualquer usuário logado alterasse policies, habilitasse/desabilitasse RLS e
-- manipulasse permissões de tabelas.
--
-- Esta migration revoga o privilégio e remove a função completamente.

-- Revoga o privilégio caso ainda exista (bancos onde a migration 010 original foi aplicada).
REVOKE ALL ON FUNCTION public.aplicar_rls_admin(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.aplicar_rls_admin(TEXT) FROM public;

-- Remove a função auxiliar do banco.
DROP FUNCTION IF EXISTS public.aplicar_rls_admin(TEXT);
