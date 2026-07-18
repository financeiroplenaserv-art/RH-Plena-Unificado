-- Migração 063: Restringe leitura de empresas e departamentos por perfil (RLS)
--
-- Contexto: na migration 058, as tabelas `empresas` e `departamentos` ficaram
-- com SELECT aberto (USING true) para qualquer usuário autenticado. Assim, um
-- perfil sem acesso às telas de cadastro ainda conseguia ler esses dados pela
-- API.
--
-- Esta migration cria as funções pode_ver_empresas() e pode_ver_departamentos()
-- no mesmo padrão das demais (pode_ver_colaboradores, pode_ver_ocorrencias etc.)
-- e passa a exigir perfil autorizado para o SELECT.
--
-- ⚠️ IMPORTANTE — por que mesa e inspetoria estão na lista:
-- Esses perfis leem empresas/departamentos em telas do dia a dia, não apenas
-- nas telas de cadastro:
--   • mesa: filtro de empresa em Ocorrências; seleção de empresa ao emitir
--     recibo de extras; dropdowns de departamento em Escalas/Extras/CEU.
--   • inspetoria: filtro de empresa em Ocorrências; dropdowns de departamento.
-- Além disso, os JOINs do Supabase (embeds como departamento:departamentos(nome))
-- respeitam a RLS da tabela relacionada: remover um perfil daqui faz listas
-- inteiras pararem de exibir o nome do departamento/empresa para ele.
--
-- Se quiser tirar um perfil desta lista, remova-o do IN (...) abaixo — mas
-- verifique antes se ele não usa as telas citadas. O bloqueio de acesso às
-- TELAS de cadastro (menu/rota) continua sendo feito pela tela Permissões.

-- ============================================================
-- 1. Funções de verificação
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_ver_empresas()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'financeiro', 'inspetoria')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_departamentos()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'financeiro', 'inspetoria')
  );
$$;

-- ============================================================
-- 2. Policies de SELECT
-- ============================================================

DROP POLICY IF EXISTS "Permitir select de empresas" ON public.empresas;

CREATE POLICY "Permitir select de empresas"
  ON public.empresas
  FOR SELECT TO authenticated
  USING (public.pode_ver_empresas());

DROP POLICY IF EXISTS "Permitir select de departamentos" ON public.departamentos;

CREATE POLICY "Permitir select de departamentos"
  ON public.departamentos
  FOR SELECT TO authenticated
  USING (public.pode_ver_departamentos());
