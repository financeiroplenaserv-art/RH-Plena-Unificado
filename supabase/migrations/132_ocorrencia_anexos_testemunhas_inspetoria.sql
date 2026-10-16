-- Migração 132: inspetoria pode anexar arquivos e adicionar testemunhas em
-- ocorrências (alinha o banco às concessões que a UI já faz).
--
-- Caso real (16/10/2026): o usuário augusto (perfil inspetoria) criou uma
-- ocorrência de Elogio e o anexo era recusado. A UI libera o upload
-- (PERMISSOES_PADRAO e permissoes_perfil concedem ocorrencia.anexar e
-- ocorrencia.adicionar_testemunha à inspetoria; o bucket ocorrencia-anexos
-- aceita o arquivo via pode_ver_anexos_ocorrencia, que inclui inspetoria),
-- mas as policies de INSERT/UPDATE das tabelas ocorrencia_anexos e
-- ocorrencia_testemunhas (migration 059) exigem is_admin()/is_editor()/
-- is_rh_ou_admin() — e is_editor() NÃO inclui inspetoria. A migration 087
-- já tinha incluído inspetoria no INSERT/UPDATE da tabela ocorrencias (ela
-- cria e edita ocorrências), mas as tabelas filhas ficaram esquecidas —
-- mesma classe de divergência RLS×UI da auditoria 087.
--
-- ocorrencia_defesas e ocorrencia_aprovacoes NÃO mudam: a UI não concede
-- essas ações à inspetoria.
-- Não cria tabela — sem GRANT de tabela.

-- ============================================================
-- 1) ocorrencia_anexos: INSERT/UPDATE + inspetoria
-- ============================================================
DROP POLICY IF EXISTS "Permitir insert de ocorrencia_anexos" ON public.ocorrencia_anexos;
CREATE POLICY "Permitir insert de ocorrencia_anexos"
  ON public.ocorrencia_anexos
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

DROP POLICY IF EXISTS "Permitir update de ocorrencia_anexos" ON public.ocorrencia_anexos;
CREATE POLICY "Permitir update de ocorrencia_anexos"
  ON public.ocorrencia_anexos
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

-- ============================================================
-- 2) ocorrencia_testemunhas: INSERT/UPDATE + inspetoria
-- ============================================================
DROP POLICY IF EXISTS "Permitir insert de ocorrencia_testemunhas" ON public.ocorrencia_testemunhas;
CREATE POLICY "Permitir insert de ocorrencia_testemunhas"
  ON public.ocorrencia_testemunhas
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

DROP POLICY IF EXISTS "Permitir update de ocorrencia_testemunhas" ON public.ocorrencia_testemunhas;
CREATE POLICY "Permitir update de ocorrencia_testemunhas"
  ON public.ocorrencia_testemunhas
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
