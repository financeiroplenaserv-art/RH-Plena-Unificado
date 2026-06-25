-- Migração 037: RBAC granular com 8 perfis
--
-- Perfis do sistema: adm, gestor, rh, dp1, dp2, mesa, inspetoria, financeiro
-- Perfis legados mantidos para compatibilidade: admin (equivalente a adm), visualizador

-- ============================================================
-- 1. Funções auxiliares de permissão
-- ============================================================

-- Administrador: admin (legado) ou adm
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

-- Editor: perfis com permissão de escrita em dados de negócio
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
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro')
  );
$$;

-- Visualizador: apenas leitura (perfil legado)
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

-- DP: dp1 ou dp2
CREATE OR REPLACE FUNCTION public.is_dp()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('dp1', 'dp2')
  );
$$;

-- Mesa
CREATE OR REPLACE FUNCTION public.is_mesa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'mesa'
  );
$$;

-- Inspetoria
CREATE OR REPLACE FUNCTION public.is_inspetoria()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'inspetoria'
  );
$$;

-- Financeiro
CREATE OR REPLACE FUNCTION public.is_financeiro()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'financeiro'
  );
$$;

-- Gestor
CREATE OR REPLACE FUNCTION public.is_gestor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'gestor'
  );
$$;

-- RH
CREATE OR REPLACE FUNCTION public.is_rh()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso = 'rh'
  );
$$;

-- Garante que usuários autenticados possam executar as funções de permissão
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_visualizador() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mesa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_inspetoria() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_financeiro() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_gestor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rh() TO authenticated;

-- ============================================================
-- 2. Reaplica policies RLS para garantir consistência
-- ============================================================

-- Reaplica RLS nas tabelas de negócio com as funções atualizadas
CREATE OR REPLACE FUNCTION public.aplicar_rls_padrao(p_tabela TEXT)
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tabela);

    EXECUTE format('DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert para editores" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir update para editores" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.%I;', v_tabela);

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

SELECT public.aplicar_rls_padrao('empresas');
SELECT public.aplicar_rls_padrao('colaboradores');
SELECT public.aplicar_rls_padrao('departamentos');
SELECT public.aplicar_rls_padrao('perfis');
SELECT public.aplicar_rls_padrao('configuracoes');
SELECT public.aplicar_rls_padrao('ocorrencias');
SELECT public.aplicar_rls_padrao('ocorrencia_anexos');
SELECT public.aplicar_rls_padrao('ocorrencia_testemunhas');
SELECT public.aplicar_rls_padrao('ocorrencia_aprovacoes');
SELECT public.aplicar_rls_padrao('ocorrencia_defesas');
SELECT public.aplicar_rls_padrao('alertas');
SELECT public.aplicar_rls_padrao('modelos_ocorrencia');
SELECT public.aplicar_rls_padrao('auditoria');
SELECT public.aplicar_rls_padrao('projetos_vr');
SELECT public.aplicar_rls_padrao('resultados_vr');
SELECT public.aplicar_rls_padrao('fornecedores');
SELECT public.aplicar_rls_padrao('itens');
SELECT public.aplicar_rls_padrao('entregas');
SELECT public.aplicar_rls_padrao('contratos_adicionais');
SELECT public.aplicar_rls_padrao('vinculos_adicionais');
SELECT public.aplicar_rls_padrao('calendario_adicionais');
SELECT public.aplicar_rls_padrao('log_auditoria');

DROP FUNCTION IF EXISTS public.aplicar_rls_padrao(TEXT);

-- ============================================================
-- 3. Policies específicas já existentes mantidas
-- ============================================================

-- A migration 032 já criou policies específicas para extras, categorias_extras e recibos_extras.
-- A migration 034 já criou SELECT restrito para perfis, configuracoes, log_auditoria e auditoria.
-- A migration 035 já criou policies para storage buckets.
-- A migration 036 já criou policies para termos_lgpd e perfis.

-- Nenhuma alteração adicional necessária nessas tabelas; as funções is_admin/is_editor atualizadas
-- garantem que os novos perfis sejam reconhecidos pelas policies existentes.
