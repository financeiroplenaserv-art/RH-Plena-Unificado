-- Migração 065: Restringe SELECT de escalas, CEU, alertas e modelos por perfil
--
-- Continuação da leva 2 da auditoria pré-go-live. Tabelas com SELECT aberto
-- (USING true) herdado das migrations 010/014/037/048:
--
--   • locais_trabalho, mapeamento_flit_local_trabalho, locais_trabalho_diario,
--     historico_local_trabalho_diario — jornada/localização diária dos
--     colaboradores (dado pessoal, LGPD)
--   • itens, fornecedores, entregas — módulo CEU (uniformes/EPI por colaborador)
--   • alertas — descrições disciplinares com nome de colaborador
--   • modelos_ocorrencia — modelos de ocorrências
--
-- Também fecha a leitura do token e-Contador para o perfil rh (a regra de
-- negócio da migration 055 diz que RH não acessa o e-Contador) e remove a
-- policy órfã "Perfis delete admin" (redundante com a da 059).
--
-- As escritas já estão corretas (is_editor / is_admin) e não mudam.
-- As listas de perfis seguem a matriz de menus/rotas vigente; para abrir ou
-- fechar acesso, ajuste o IN (...) da função correspondente.

-- ============================================================
-- 1. Funções de verificação
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_ver_escalas()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'financeiro', 'inspetoria')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_ceu()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'dp1', 'dp2', 'mesa', 'inspetoria')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_alertas()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa')
  );
$$;

-- ============================================================
-- 2. Escalas (4 tabelas)
-- ============================================================

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.locais_trabalho;
CREATE POLICY "Permitir select de locais_trabalho"
  ON public.locais_trabalho FOR SELECT TO authenticated
  USING (public.pode_ver_escalas());

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.mapeamento_flit_local_trabalho;
CREATE POLICY "Permitir select de mapeamento_flit_local_trabalho"
  ON public.mapeamento_flit_local_trabalho FOR SELECT TO authenticated
  USING (public.pode_ver_escalas());

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.locais_trabalho_diario;
CREATE POLICY "Permitir select de locais_trabalho_diario"
  ON public.locais_trabalho_diario FOR SELECT TO authenticated
  USING (public.pode_ver_escalas());

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.historico_local_trabalho_diario;
CREATE POLICY "Permitir select de historico_local_trabalho_diario"
  ON public.historico_local_trabalho_diario FOR SELECT TO authenticated
  USING (public.pode_ver_escalas());

-- ============================================================
-- 3. CEU (itens, fornecedores, entregas)
-- ============================================================

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.itens;
CREATE POLICY "Permitir select de itens"
  ON public.itens FOR SELECT TO authenticated
  USING (public.pode_ver_ceu());

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.fornecedores;
CREATE POLICY "Permitir select de fornecedores"
  ON public.fornecedores FOR SELECT TO authenticated
  USING (public.pode_ver_ceu());

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.entregas;
CREATE POLICY "Permitir select de entregas"
  ON public.entregas FOR SELECT TO authenticated
  USING (public.pode_ver_ceu());

-- ============================================================
-- 4. Alertas e modelos de ocorrência
-- ============================================================

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.alertas;
CREATE POLICY "Permitir select de alertas"
  ON public.alertas FOR SELECT TO authenticated
  USING (public.pode_ver_alertas());

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.modelos_ocorrencia;
CREATE POLICY "Permitir select de modelos_ocorrencia"
  ON public.modelos_ocorrencia FOR SELECT TO authenticated
  USING (public.pode_ver_alertas());

-- ============================================================
-- 5. Token e-Contador: somente admin/dp (alinha com a migration 055)
-- ============================================================
-- A 059 resolveu configuracoes com UMA policy de SELECT combinada; manter o
-- mesmo padrao (1 policy) para nao violar a regra do validador.

DROP POLICY IF EXISTS "Permitir select token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select geral em configuracoes" ON public.configuracoes;

CREATE POLICY "Permitir select geral em configuracoes"
  ON public.configuracoes
  FOR SELECT TO authenticated
  USING (chave <> 'econtador_token' OR (chave = 'econtador_token' AND public.is_admin_ou_dp()));

-- ============================================================
-- 6. Higiene: remove policy órfã redundante da migration 042
-- ============================================================

DROP POLICY IF EXISTS "Perfis delete admin" ON public.perfis;
