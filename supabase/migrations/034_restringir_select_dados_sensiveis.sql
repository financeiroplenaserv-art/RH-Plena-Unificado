-- Migração 034: Restringe SELECT irrestrito em dados sensíveis
--
-- Contexto: a migration 014 criou SELECT liberado para qualquer usuário autenticado
-- em todas as tabelas de negócio. Esta migration remove o acesso de visualizadores
-- a tabelas administrativas/sensíveis.
--
-- Perfis do sistema: admin/adm, rh, gestor, dp1, dp2, mesa, inspetoria, financeiro, visualizador

-- Atualiza is_admin para reconhecer 'admin' e 'adm'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm')
  );
$$;

-- Atualiza is_editor para incluir os novos perfis operacionais
CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'rh', 'gestor', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro')
  );
$$;

-- Função auxiliar: verifica se o usuário é apenas visualizador
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

-- Aplica SELECT restrito em tabelas sensíveis: apenas editores/admin podem ler
CREATE OR REPLACE FUNCTION public.aplicar_select_restrito(p_tabela TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tabela TEXT := p_tabela;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = v_tabela
  ) THEN
    -- Habilita RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

    -- Remove policy de SELECT antiga (se existir)
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select restrito" ON public.%I;', v_tabela);

    -- Cria policy que nega visualizadores e permite editores/admins
    EXECUTE format(
      'CREATE POLICY "Permitir select restrito" ON public.%I FOR SELECT TO authenticated USING (NOT public.is_visualizador());',
      v_tabela
    );
  END IF;
END;
$$;

-- Aplica restrição nas tabelas administrativas/sensíveis
SELECT public.aplicar_select_restrito('perfis');
SELECT public.aplicar_select_restrito('configuracoes');
SELECT public.aplicar_select_restrito('log_auditoria');
SELECT public.aplicar_select_restrito('auditoria');

-- Remove a função auxiliar (não deve ficar exposta)
DROP FUNCTION IF EXISTS public.aplicar_select_restrito(TEXT);
