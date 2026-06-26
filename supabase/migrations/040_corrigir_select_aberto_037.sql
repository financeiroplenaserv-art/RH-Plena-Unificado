-- Migração 040: Corrige policies SELECT abertas deixadas pela migration 037
--
-- Contexto: a migration 037 aplicou RLS padrão em várias tabelas, recriando a
-- policy "Permitir select para autenticados" com USING (true). Como a migration
-- 034 já havia criado policies restritas ("Permitir select restrito") nas
-- tabelas administrativas/sensíveis, as duas policies coexistiram e o PostgreSQL
-- avaliou com OR, anulando a proteção.
--
-- Esta migration remove a policy aberta e garante a policy restrita nas tabelas:
--   - perfis
--   - configuracoes
--   - auditoria
--   - log_auditoria

-- ============================================================
-- 1. Garante que a função is_visualizador existe e está atualizada
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_visualizador()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'visualizador'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_visualizador() TO authenticated;

-- ============================================================
-- 2. Remove policy SELECT aberta e recria policy restrita
-- ============================================================

DO $$
DECLARE
  v_tabela TEXT;
  v_tabelas TEXT[] := ARRAY['perfis', 'configuracoes', 'auditoria', 'log_auditoria'];
BEGIN
  FOREACH v_tabela IN ARRAY v_tabelas
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = v_tabela
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

      -- Remove a policy aberta criada pela migration 037
      EXECUTE format(
        'DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;',
        v_tabela
      );

      -- Remove e recria a policy restrita para garantir consistência
      EXECUTE format(
        'DROP POLICY IF EXISTS "Permitir select restrito" ON public.%I;',
        v_tabela
      );

      EXECUTE format(
        'CREATE POLICY "Permitir select restrito" ON public.%I FOR SELECT TO authenticated USING (NOT public.is_visualizador());',
        v_tabela
      );
    END IF;
  END LOOP;
END
$$;
