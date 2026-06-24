-- Migração 014: Restringe RLS por nível de acesso
--
-- Contexto: todos os usuários autenticados devem ter acesso a todas as empresas.
-- Regra de permissão:
--   - visualizador: apenas SELECT
--   - gestor / rh: SELECT, INSERT, UPDATE
--   - admin: SELECT, INSERT, UPDATE, DELETE
--
-- Esta migration substitui as policies criadas na migration 010.

-- Função auxiliar: verifica se o usuário é editor (admin, rh ou gestor)
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
      AND nivel_acesso IN ('admin', 'rh', 'gestor')
  );
$$;

-- Função auxiliar interna: aplica policies restritas em uma tabela
CREATE OR REPLACE FUNCTION public.aplicar_rls_restrito(p_tabela TEXT)
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
    -- Habilita RLS (caso ainda não esteja)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

    -- Remove policies antigas da migration 010
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.%I;', v_tabela);

    -- Cria novas policies por nível de acesso
    EXECUTE format(
      'CREATE POLICY "Permitir select para autenticados" ON public.%I FOR SELECT TO authenticated USING (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir insert para editores" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_editor());',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir update para editores" ON public.%I FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir delete apenas para admins" ON public.%I FOR DELETE TO authenticated USING (public.is_admin());',
      v_tabela
    );
  END IF;
END;
$$;

-- Aplica as policies restritas nas tabelas de negócio
SELECT public.aplicar_rls_restrito('empresas');
SELECT public.aplicar_rls_restrito('colaboradores');
SELECT public.aplicar_rls_restrito('departamentos');
SELECT public.aplicar_rls_restrito('perfis');
SELECT public.aplicar_rls_restrito('configuracoes');
SELECT public.aplicar_rls_restrito('ocorrencias');
SELECT public.aplicar_rls_restrito('ocorrencia_anexos');
SELECT public.aplicar_rls_restrito('ocorrencia_testemunhas');
SELECT public.aplicar_rls_restrito('ocorrencia_aprovacoes');
SELECT public.aplicar_rls_restrito('ocorrencia_defesas');
SELECT public.aplicar_rls_restrito('alertas');
SELECT public.aplicar_rls_restrito('modelos_ocorrencia');
SELECT public.aplicar_rls_restrito('auditoria');
SELECT public.aplicar_rls_restrito('projetos_vr');
SELECT public.aplicar_rls_restrito('resultados_vr');
SELECT public.aplicar_rls_restrito('fornecedores');
SELECT public.aplicar_rls_restrito('itens');
SELECT public.aplicar_rls_restrito('entregas');
SELECT public.aplicar_rls_restrito('contratos_adicionais');
SELECT public.aplicar_rls_restrito('vinculos_adicionais');
SELECT public.aplicar_rls_restrito('calendario_adicionais');
SELECT public.aplicar_rls_restrito('log_auditoria');

-- Remove a função auxiliar interna (não deve ficar exposta)
DROP FUNCTION IF EXISTS public.aplicar_rls_restrito(TEXT);

-- Garante que is_admin continue disponível para as policies
-- (já foi criada na migration 010 e mantida)
