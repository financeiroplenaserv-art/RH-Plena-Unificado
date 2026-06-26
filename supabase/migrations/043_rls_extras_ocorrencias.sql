-- Migração 038: Ajusta RLS de extras, recibos_extras, categorias_extras e ocorrências
--
-- Regras de negócio validadas em 2026-06-26:
--   - Extras: visualização apenas para adm, mesa, financeiro e dp1.
--   - Ocorrências: visualização para adm, gestor, dp1, dp2, mesa e inspetoria.
--   - Administrador legado ('admin') equivale a 'adm'.

-- ============================================================
-- 1. Funções auxiliares de visualização
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

GRANT EXECUTE ON FUNCTION public.pode_ver_extras() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_ocorrencias() TO authenticated;

-- ============================================================
-- 2. categorias_extras
-- ============================================================

ALTER TABLE public.categorias_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de categorias_extras" ON public.categorias_extras;

CREATE POLICY "Permitir select de categorias_extras"
  ON public.categorias_extras
  FOR SELECT
  TO authenticated
  USING (public.pode_ver_extras());

-- INSERT/UPDATE/DELETE mantidos conforme migration 032

-- ============================================================
-- 3. extras
-- ============================================================

ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de extras" ON public.extras;

CREATE POLICY "Permitir select de extras"
  ON public.extras
  FOR SELECT
  TO authenticated
  USING (public.pode_ver_extras());

-- INSERT/UPDATE/DELETE mantidos conforme migration 032

-- ============================================================
-- 4. recibos_extras
-- ============================================================

ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de recibos_extras" ON public.recibos_extras;

CREATE POLICY "Permitir select de recibos_extras"
  ON public.recibos_extras
  FOR SELECT
  TO authenticated
  USING (public.pode_ver_extras());

-- INSERT/UPDATE/DELETE mantidos conforme migration 032

-- ============================================================
-- 5. ocorrências
-- ============================================================

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencias;

CREATE POLICY "Permitir select de ocorrencias"
  ON public.ocorrencias
  FOR SELECT
  TO authenticated
  USING (public.pode_ver_ocorrencias());

-- INSERT/UPDATE/DELETE mantidos conforme migration 037 (editor/admin)
