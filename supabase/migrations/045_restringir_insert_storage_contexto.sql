-- Migração 045: Reforça INSERT nos buckets privados exigindo contexto válido
--
-- Contexto: a migration 044 isolou o SELECT/UPDATE/DELETE pelo path, mas o INSERT
-- ainda permitia upload para qualquer path desde que o usuário tivesse o perfil
-- correto. Esta migration exige que o path corresponda a uma ocorrência/projeto
-- existente no momento do upload.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos'
  ) THEN
    DROP POLICY IF EXISTS "Permitir insert de anexos de ocorrencias" ON storage.objects;

    CREATE POLICY "Permitir insert de anexos de ocorrencias"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_acessar_anexo_ocorrencia(name)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vr-arquivos'
  ) THEN
    DROP POLICY IF EXISTS "Permitir insert de vr-arquivos" ON storage.objects;

    CREATE POLICY "Permitir insert de vr-arquivos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'vr-arquivos'
        AND public.pode_acessar_arquivo_vr(name)
      );
  END IF;
END $$;
