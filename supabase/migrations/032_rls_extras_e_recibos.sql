-- Migração 032: Restringe RLS das tabelas extras, categorias_extras e recibos_extras
--
-- Contexto: as migrations 018 e 026 criaram policies abertas (USING (true))
-- para todas as operações, permitindo que qualquer usuário autenticado lesse,
-- alterasse ou removesse dados financeiros. Esta migration corrige isso.
--
-- Regra de permissão:
--   - visualizador: apenas SELECT
--   - gestor / rh: SELECT, INSERT, UPDATE
--   - admin: SELECT, INSERT, UPDATE, DELETE

-- ============================================================
-- categorias_extras
-- ============================================================

ALTER TABLE public.categorias_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de categorias_extras" ON public.categorias_extras;

CREATE POLICY "Permitir select de categorias_extras"
  ON public.categorias_extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insert de categorias_extras"
  ON public.categorias_extras
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de categorias_extras"
  ON public.categorias_extras
  FOR UPDATE
  TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de categorias_extras"
  ON public.categorias_extras
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- extras
-- ============================================================

ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de extras" ON public.extras;

CREATE POLICY "Permitir select de extras"
  ON public.extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insert de extras"
  ON public.extras
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de extras"
  ON public.extras
  FOR UPDATE
  TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de extras"
  ON public.extras
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- recibos_extras
-- ============================================================

ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de recibos_extras" ON public.recibos_extras;

CREATE POLICY "Permitir select de recibos_extras"
  ON public.recibos_extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir insert de recibos_extras"
  ON public.recibos_extras
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de recibos_extras"
  ON public.recibos_extras
  FOR UPDATE
  TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete de recibos_extras"
  ON public.recibos_extras
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
