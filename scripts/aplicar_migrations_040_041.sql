-- ============================================================
-- MIGRATIONS 040 + 041 — APLICAR MANUALMENTE NO SUPABASE
--
-- Projeto: RH Plena Unificado
-- Project ref: jmdjdogskvybsdjtmpmb
-- Data: 2026-06-26
--
-- Instruções:
-- 1. Acesse o Supabase Dashboard: https://supabase.com/dashboard/project/jmdjdogskvybsdjtmpmb
-- 2. Vá em "SQL Editor" > "New query".
-- 3. Cole TODO o conteúdo deste arquivo.
-- 4. Clique em "Run".
-- 5. Verifique se não houve erros no painel de resultados.
--
-- IMPORTANTE: recomenda-se executar em ambiente de teste antes de produção.
-- ============================================================

-- ============================================================
-- MIGRATION 040: Corrige policies SELECT abertas deixadas pela migration 037
-- ============================================================

-- Garante que a função is_visualizador existe e está atualizada
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

-- Remove policy SELECT aberta e recria policy restrita
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

-- ============================================================
-- MIGRATION 041: Reforça RLS da tabela configuracoes para a chave econtador_token
-- ============================================================

-- Função auxiliar: admin/adm/dp1/dp2 podem gerenciar o token
CREATE OR REPLACE FUNCTION public.is_admin_ou_dp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'dp1', 'dp2')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_ou_dp() TO authenticated;

-- Limpa policies antigas/conflitantes de configuracoes
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select geral de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select de econtador_token para admin/rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.configuracoes;

-- Recria policies de configuracoes de forma segura
CREATE POLICY "Permitir select geral de configuracoes"
  ON public.configuracoes
  FOR SELECT
  TO authenticated
  USING (chave <> 'econtador_token');

CREATE POLICY "Permitir insert de configuracoes"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir update de configuracoes"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir insert token eContador apenas admin dp"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

CREATE POLICY "Permitir update token eContador apenas admin dp"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (chave = 'econtador_token' AND public.is_admin_ou_dp())
  WITH CHECK (chave = 'econtador_token' AND public.is_admin_ou_dp());

CREATE POLICY "Permitir delete apenas para admins"
  ON public.configuracoes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
