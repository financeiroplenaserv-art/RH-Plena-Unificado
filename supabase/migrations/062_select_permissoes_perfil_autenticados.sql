-- Migração 062: Restaura leitura de permissoes_perfil para usuários autenticados
--
-- Problema: a migration 058 (consolidação RLS) restringiu o SELECT de
-- permissoes_perfil para admins (USING public.is_admin()). Com isso, qualquer
-- usuário não-admin fica com a sidebar vazia: o app carrega as permissões do
-- próprio perfil no login (useAuth > carregarPermissoesDoPerfil) e, sem
-- permissão de leitura, o cache fica vazio e verificarPermissao retorna
-- false para todos os itens de menu.
--
-- Justificativa: a tabela contém apenas flags de visibilidade de menus/ações
-- por perfil (perfil, recurso, acao, permitido) — não há dados pessoais ou
-- sensíveis. A escrita (INSERT/UPDATE/DELETE) continua restrita a admins.
-- Este SELECT era aberto a autenticados na migration 046 original.

DROP POLICY IF EXISTS "Permitir select de permissoes_perfil" ON public.permissoes_perfil;

CREATE POLICY "Permitir select de permissoes_perfil"
  ON public.permissoes_perfil
  FOR SELECT
  TO authenticated
  USING (true);
