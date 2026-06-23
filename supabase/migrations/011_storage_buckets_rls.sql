-- Migração 011: Row Level Security (RLS) nos storage buckets
--
-- Protege os buckets de arquivos contra acesso, upload e remoção indevidos.
-- Como a mesma equipe gerencia todas as empresas, autenticados podem ler/upload.
-- DELETE restrito a administradores.
--
-- Pré-requisito: migração 010 (função public.is_admin() deve existir).

-- ============================================================
-- Bucket: ocorrencia-anexos
-- ============================================================

-- Torna o bucket privado (caso exista)
UPDATE storage.buckets
SET public = false
WHERE id = 'ocorrencia-anexos';

-- Cria policies apenas se o bucket existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos'
  ) THEN
    DROP POLICY IF EXISTS "Autenticados podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos" ON storage.objects;

    CREATE POLICY "Autenticados podem ler anexos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'ocorrencia-anexos');

    CREATE POLICY "Autenticados podem inserir anexos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'ocorrencia-anexos');

    CREATE POLICY "Autenticados podem atualizar anexos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'ocorrencia-anexos')
    WITH CHECK (bucket_id = 'ocorrencia-anexos');

    CREATE POLICY "Apenas admins podem deletar anexos"
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
    DROP POLICY IF EXISTS "Autenticados podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Autenticados podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos" ON storage.objects;

    CREATE POLICY "Autenticados podem ler vr-arquivos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'vr-arquivos');

    CREATE POLICY "Autenticados podem inserir vr-arquivos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'vr-arquivos');

    CREATE POLICY "Autenticados podem atualizar vr-arquivos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'vr-arquivos')
    WITH CHECK (bucket_id = 'vr-arquivos');

    CREATE POLICY "Apenas admins podem deletar vr-arquivos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'vr-arquivos'
      AND public.is_admin()
    );
  END IF;
END $$;
