-- Aplicação manual das migrations 038 e 039
-- Execute este SQL no SQL Editor do Supabase.
-- É idempotente: pode ser rodado várias vezes sem erro.

-- ============================================================
-- 1. Funções auxiliares
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_ver_extras()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'mesa', 'financeiro', 'dp1')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_ocorrencias()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'dp1', 'dp2', 'mesa', 'inspetoria')
  );
$$;

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

GRANT EXECUTE ON FUNCTION public.pode_ver_extras() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_ocorrencias() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_anexos_ocorrencia() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_vr_arquivos() TO authenticated;

-- ============================================================
-- 2. Tabelas: categorias_extras, extras, recibos_extras
-- ============================================================

ALTER TABLE public.categorias_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

-- categorias_extras
DROP POLICY IF EXISTS "Permitir select de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir insert de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir update de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir delete de categorias_extras" ON public.categorias_extras;

CREATE POLICY "Permitir select de categorias_extras"
  ON public.categorias_extras FOR SELECT TO authenticated
  USING (public.pode_ver_extras());

CREATE POLICY "Permitir insert de categorias_extras"
  ON public.categorias_extras FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de categorias_extras"
  ON public.categorias_extras FOR UPDATE TO authenticated
  USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de categorias_extras"
  ON public.categorias_extras FOR DELETE TO authenticated
  USING (public.is_admin());

-- extras
DROP POLICY IF EXISTS "Permitir select de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir insert de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir update de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir delete de extras" ON public.extras;

CREATE POLICY "Permitir select de extras"
  ON public.extras FOR SELECT TO authenticated
  USING (public.pode_ver_extras());

CREATE POLICY "Permitir insert de extras"
  ON public.extras FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de extras"
  ON public.extras FOR UPDATE TO authenticated
  USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de extras"
  ON public.extras FOR DELETE TO authenticated
  USING (public.is_admin());

-- recibos_extras
DROP POLICY IF EXISTS "Permitir select de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir insert de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir update de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir delete de recibos_extras" ON public.recibos_extras;

CREATE POLICY "Permitir select de recibos_extras"
  ON public.recibos_extras FOR SELECT TO authenticated
  USING (public.pode_ver_extras());

CREATE POLICY "Permitir insert de recibos_extras"
  ON public.recibos_extras FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de recibos_extras"
  ON public.recibos_extras FOR UPDATE TO authenticated
  USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de recibos_extras"
  ON public.recibos_extras FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. Tabela: ocorrencias
-- ============================================================

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir select de ocorrencias" ON public.ocorrencias;

CREATE POLICY "Permitir select de ocorrencias"
  ON public.ocorrencias FOR SELECT TO authenticated
  USING (public.pode_ver_ocorrencias());

-- INSERT/UPDATE/DELETE mantidos conforme migration 037 (editor/admin)

-- ============================================================
-- 4. Storage: ocorrencia-anexos
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ocorrencia-anexos') THEN
    DROP POLICY IF EXISTS "Editores podem ler anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar anexos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar anexos restrito" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir select de anexos de ocorrencias" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir insert de anexos de ocorrencias" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir update de anexos de ocorrencias" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir delete de anexos de ocorrencias" ON storage.objects;

    CREATE POLICY "Permitir select de anexos de ocorrencias"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'ocorrencia-anexos' AND public.pode_ver_anexos_ocorrencia());

    CREATE POLICY "Permitir insert de anexos de ocorrencias"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'ocorrencia-anexos' AND public.pode_ver_anexos_ocorrencia());

    CREATE POLICY "Permitir update de anexos de ocorrencias"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'ocorrencia-anexos' AND public.pode_ver_anexos_ocorrencia())
      WITH CHECK (bucket_id = 'ocorrencia-anexos' AND public.pode_ver_anexos_ocorrencia());

    CREATE POLICY "Permitir delete de anexos de ocorrencias"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'ocorrencia-anexos' AND public.is_admin());
  END IF;
END $$;

-- ============================================================
-- 5. Storage: vr-arquivos
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vr-arquivos') THEN
    DROP POLICY IF EXISTS "Editores podem ler vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem inserir vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Editores podem atualizar vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Apenas admins podem deletar vr-arquivos restrito" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir select de vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir insert de vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir update de vr-arquivos" ON storage.objects;
    DROP POLICY IF EXISTS "Permitir delete de vr-arquivos" ON storage.objects;

    CREATE POLICY "Permitir select de vr-arquivos"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'vr-arquivos' AND public.pode_ver_vr_arquivos());

    CREATE POLICY "Permitir insert de vr-arquivos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'vr-arquivos' AND public.pode_ver_vr_arquivos());

    CREATE POLICY "Permitir update de vr-arquivos"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'vr-arquivos' AND public.pode_ver_vr_arquivos())
      WITH CHECK (bucket_id = 'vr-arquivos' AND public.pode_ver_vr_arquivos());

    CREATE POLICY "Permitir delete de vr-arquivos"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'vr-arquivos' AND public.is_admin());
  END IF;
END $$;
