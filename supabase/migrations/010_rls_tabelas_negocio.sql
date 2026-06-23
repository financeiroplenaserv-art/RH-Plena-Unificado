-- Migração 010: Row Level Security (RLS) para tabelas de negócio
-- Contexto: uma única equipe gerencia todas as empresas do grupo.
-- Objetivo: permitir leitura/escrita livre para usuários autenticados,
-- mas restringir DELETE apenas a administradores.
--
-- Esta migração verifica se cada tabela existe antes de aplicar as policies,
-- evitando erros quando o schema ainda não possui determinadas tabelas.

-- Função auxiliar: verifica se o usuário logado é admin
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
      AND nivel_acesso = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Função auxiliar: aplica RLS e policies de forma segura em uma tabela
CREATE OR REPLACE FUNCTION public.aplicar_rls_admin(p_tabela TEXT)
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

    -- Remove policies antigas caso existam
    EXECUTE format('DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.%I;', v_tabela);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.%I;', v_tabela);

    -- Cria policies
    EXECUTE format(
      'CREATE POLICY "Permitir select para autenticados" ON public.%I FOR SELECT TO authenticated USING (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir insert para autenticados" ON public.%I FOR INSERT TO authenticated WITH CHECK (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir update para autenticados" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);',
      v_tabela
    );
    EXECUTE format(
      'CREATE POLICY "Permitir delete apenas para admins" ON public.%I FOR DELETE TO authenticated USING (public.is_admin());',
      v_tabela
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_rls_admin(TEXT) TO authenticated;

-- ============================================================
-- Aplica RLS nas tabelas de negócio (apenas se existirem)
-- ============================================================

SELECT public.aplicar_rls_admin('empresas');
SELECT public.aplicar_rls_admin('colaboradores');
SELECT public.aplicar_rls_admin('departamentos');
SELECT public.aplicar_rls_admin('perfis');
SELECT public.aplicar_rls_admin('configuracoes');
SELECT public.aplicar_rls_admin('ocorrencias');
SELECT public.aplicar_rls_admin('ocorrencia_anexos');
SELECT public.aplicar_rls_admin('ocorrencia_testemunhas');
SELECT public.aplicar_rls_admin('ocorrencia_aprovacoes');
SELECT public.aplicar_rls_admin('ocorrencia_defesas');
SELECT public.aplicar_rls_admin('alertas');
SELECT public.aplicar_rls_admin('modelos_ocorrencia');
SELECT public.aplicar_rls_admin('auditoria');
SELECT public.aplicar_rls_admin('projetos_vr');
SELECT public.aplicar_rls_admin('resultados_vr');
SELECT public.aplicar_rls_admin('fornecedores');
SELECT public.aplicar_rls_admin('itens');
SELECT public.aplicar_rls_admin('entregas');
SELECT public.aplicar_rls_admin('contratos_adicionais');
SELECT public.aplicar_rls_admin('vinculos_adicionais');
SELECT public.aplicar_rls_admin('calendario_adicionais');
SELECT public.aplicar_rls_admin('log_auditoria');

-- ============================================================
-- Tabela com regra específica: histórico de importações
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'historico_importacoes_econtador'
  ) THEN
    ALTER TABLE public.historico_importacoes_econtador ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Usuários veem próprio histórico" ON public.historico_importacoes_econtador;
    DROP POLICY IF EXISTS "Usuários inserem próprio histórico" ON public.historico_importacoes_econtador;
    DROP POLICY IF EXISTS "Usuários atualizam próprio histórico" ON public.historico_importacoes_econtador;
    DROP POLICY IF EXISTS "Apenas admins deletam histórico" ON public.historico_importacoes_econtador;

    CREATE POLICY "Usuários veem próprio histórico" ON public.historico_importacoes_econtador
      FOR SELECT TO authenticated USING (usuario_id = auth.uid());

    CREATE POLICY "Usuários inserem próprio histórico" ON public.historico_importacoes_econtador
      FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

    CREATE POLICY "Usuários atualizam próprio histórico" ON public.historico_importacoes_econtador
      FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

    CREATE POLICY "Apenas admins deletam histórico" ON public.historico_importacoes_econtador
      FOR DELETE TO authenticated USING (usuario_id = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- Limpa as funções auxiliares se desejar (descomente abaixo após execução bem-sucedida)
-- DROP FUNCTION IF EXISTS public.aplicar_rls_admin(TEXT);
