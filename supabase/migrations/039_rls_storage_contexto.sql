-- Migração 039: Refina RLS dos buckets de storage
--
-- Regras de negócio validadas em 2026-06-26:
--   - Anexos de ocorrências: adm, gestor, rh, dp1, dp2, mesa, inspetoria.
--   - Anexos de VR/projetos: adm e dp2.
--   - Exclusão: apenas adm em ambos.

-- ============================================================
-- 1. Funções auxiliares de permissão para storage
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_ver_anexos_ocorrencia()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_vr_arquivos()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_ver_anexos_ocorrencia() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_vr_arquivos() TO authenticated;

-- ============================================================
-- 2. Bucket: ocorrencia-anexos
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos'
  ) THEN
    DROP POLICY IF EXISTS "Editores podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos restrito" ON storage.objects;

    CREATE POLICY "Permitir select de anexos de ocorrencias"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_ver_anexos_ocorrencia()
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
        AND public.pode_ver_anexos_ocorrencia()
      )
      WITH CHECK (
        bucket_id = 'ocorrencia-anexos'
        AND public.pode_ver_anexos_ocorrencia()
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
-- 3. Bucket: vr-arquivos
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'vr-arquivos'
  ) THEN
    DROP POLICY IF EXISTS "Editores podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos restrito" ON storage.objects;

    CREATE POLICY "Permitir select de vr-arquivos"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'vr-arquivos'
        AND public.pode_ver_vr_arquivos()
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
        AND public.pode_ver_vr_arquivos()
      )
      WITH CHECK (
        bucket_id = 'vr-arquivos'
        AND public.pode_ver_vr_arquivos()
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
