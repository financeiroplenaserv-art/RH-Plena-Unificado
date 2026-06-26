-- Migração 035: Isola storage buckets por contexto/perfil
--
-- Contexto: a migration 011 permitiu que qualquer usuário autenticado lesse,
-- inserisse e atualizasse arquivos nos buckets. Esta migration restringe as
-- operações por perfil de acesso.
--
-- Regras aplicadas:
--   - visualizador: sem acesso ao storage
--   - editor (admin, rh, gestor, dp1, dp2, mesa, inspetoria, financeiro): pode ler/inserir/atualizar
--   - admin: pode deletar

-- ============================================================
-- Bucket: ocorrencia-anexos
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'ocorrencia-anexos';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos'
  ) THEN
    -- Limpa policies antigas
    DROP POLICY IF EXISTS "Autenticados podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos restrito" ON storage.objects;

    CREATE POLICY "Editores podem ler anexos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_editor()
    );

    CREATE POLICY "Editores podem inserir anexos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_editor()
    );

    CREATE POLICY "Editores podem atualizar anexos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_editor()
    )
    WITH CHECK (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_editor()
    );

    CREATE POLICY "Apenas admins podem deletar anexos restrito"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'ocorrencia-anexos'
      AND public.is_admin()
    );
  END IF;
END $$;

-- ============================================================
-- Bucket: vr-arquivos
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'vr-arquivos';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vr-arquivos'
  ) THEN
    -- Limpa policies antigas
    DROP POLICY IF EXISTS "Autenticados podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos restrito" ON storage.objects;

    CREATE POLICY "Editores podem ler vr-arquivos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'vr-arquivos'
      AND public.is_editor()
    );

    CREATE POLICY "Editores podem inserir vr-arquivos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'vr-arquivos'
      AND public.is_editor()
    );

    CREATE POLICY "Editores podem atualizar vr-arquivos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'vr-arquivos'
      AND public.is_editor()
    )
    WITH CHECK (
      bucket_id = 'vr-arquivos'
      AND public.is_editor()
    );

    CREATE POLICY "Apenas admins podem deletar vr-arquivos restrito"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'vr-arquivos'
      AND public.is_admin()
    );
  END IF;
END $$;
