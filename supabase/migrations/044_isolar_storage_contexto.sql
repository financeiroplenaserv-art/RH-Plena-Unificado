-- Migração 044: Isola storage por contexto (ocorrencia_id / projeto_id)
--
-- Contexto: as migrations 035 e 039 tornaram os buckets privados e restritas por
-- perfil, mas qualquer usuário com o perfil correto conseguia acessar QUALQUER
-- arquivo do bucket. Esta migration reforça o isolamento verificando se o path
-- do objeto corresponde a uma ocorrência/projeto existente e acessível.
--
-- Buckets afetados:
--   - ocorrencia-anexos  → path: <ocorrencia_id>/<arquivo>
--   - vr-arquivos        → path: <projeto_id>/<tipo>/<arquivo>

-- ============================================================
-- 1. Funções auxiliares para extrair contexto do path
-- ============================================================

CREATE OR REPLACE FUNCTION public.storage_path_contexto_id(path TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT split_part(path, '/', 1);
$$;

GRANT EXECUTE ON FUNCTION public.storage_path_contexto_id(TEXT) TO authenticated;

-- ============================================================
-- 2. Função de permissão para anexos de ocorrências
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_acessar_anexo_ocorrencia(path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    public.is_admin()
    OR (
      public.pode_ver_anexos_ocorrencia()
      AND EXISTS (
        SELECT 1
        FROM public.ocorrencias o
        WHERE o.id::TEXT = public.storage_path_contexto_id(path)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.pode_acessar_anexo_ocorrencia(TEXT) TO authenticated;

-- ============================================================
-- 3. Função de permissão para arquivos de VR
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_acessar_arquivo_vr(path TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    public.is_admin()
    OR (
      public.pode_ver_vr_arquivos()
      AND EXISTS (
        SELECT 1
        FROM public.projetos_vr p
        WHERE p.id::TEXT = public.storage_path_contexto_id(path)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.pode_acessar_arquivo_vr(TEXT) TO authenticated;

-- ============================================================
-- 4. Atualiza policies do bucket ocorrencia-anexos
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos'
  ) THEN
    DROP POLICY IF EXISTS "Permitir select de anexos de ocorrencias" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir insert de anexos de ocorrencias" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir update de anexos de ocorrencias" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir delete de anexos de ocorrencias" ON storage.objects;

    CREATE POLICY "Permitir select de anexos de ocorrencias"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_acessar_anexo_ocorrencia(name)
      );

    CREATE POLICY "Permitir insert de anexos de ocorrencias"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_ver_anexos_ocorrencia()
      );

    CREATE POLICY "Permitir update de anexos de ocorrencias"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'ocorrencia-anexos'
        AND public.is_admin()
      )
      WITH CHECK (
        bucket_id = 'ocorrencia-anexos'
        AND public.is_admin()
      );

    CREATE POLICY "Permitir delete de anexos de ocorrencias"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'ocorrencia-anexos'
        AND public.is_admin()
      );
  END IF;
END $$;

-- ============================================================
-- 5. Atualiza policies do bucket vr-arquivos
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vr-arquivos'
  ) THEN
    DROP POLICY IF EXISTS "Permitir select de vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir insert de vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir update de vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir delete de vr-arquivos" ON storage.objects;

    CREATE POLICY "Permitir select de vr-arquivos"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'vr-arquivos'
        AND public.pode_acessar_arquivo_vr(name)
      );

    CREATE POLICY "Permitir insert de vr-arquivos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'vr-arquivos'
        AND public.pode_ver_vr_arquivos()
      );

    CREATE POLICY "Permitir update de vr-arquivos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'vr-arquivos'
        AND public.is_admin()
      )
      WITH CHECK (
        bucket_id = 'vr-arquivos'
        AND public.is_admin()
      );

    CREATE POLICY "Permitir delete de vr-arquivos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'vr-arquivos'
        AND public.is_admin()
      );
  END IF;
END $$;
