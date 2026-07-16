-- Migração 058: Consolida e restringe RLS das tabelas sensíveis
--
-- Contexto: as migrations 010 e 014 criaram policies de SELECT irrestrito
-- (USING (true)) para várias tabelas de negócio. Esta migration substitui essas
-- policies por regras baseadas nos perfis de acesso, alinhadas com
-- src/lib/permissoes.ts.
--
-- Regras gerais:
--   - SELECT: apenas perfis que têm acesso de visualização ao módulo.
--   - INSERT/UPDATE: apenas perfis com poder de edição (editores).
--   - DELETE: apenas admin/adm.
--   - Empresas e departamentos continuam com SELECT aberto por decisão de
--     negócio (todos os usuários veem todas as empresas/departamentos).

-- ============================================================
-- 1. Funções auxiliares
-- ============================================================

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
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_rh_ou_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'rh', 'dp1', 'dp2')
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_colaboradores()
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

CREATE OR REPLACE FUNCTION public.pode_ver_vr()
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

CREATE OR REPLACE FUNCTION public.pode_ver_adicionais()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'dp2', 'mesa', 'financeiro')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rh_ou_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_colaboradores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_vr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_adicionais() TO authenticated;

-- ============================================================
-- 2. colaboradores
-- ============================================================

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.colaboradores;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.colaboradores;

CREATE POLICY "Permitir select de colaboradores"
  ON public.colaboradores
  FOR SELECT TO authenticated
  USING (public.pode_ver_colaboradores());

CREATE POLICY "Permitir insert de colaboradores"
  ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_rh_ou_admin() OR public.is_editor());

CREATE POLICY "Permitir update de colaboradores"
  ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (public.is_rh_ou_admin() OR public.is_editor())
  WITH CHECK (public.is_rh_ou_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de colaboradores"
  ON public.colaboradores
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. empresas
-- ============================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.empresas;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.empresas;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.empresas;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.empresas;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.empresas;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.empresas;

CREATE POLICY "Permitir select de empresas"
  ON public.empresas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Permitir insert de empresas"
  ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de empresas"
  ON public.empresas
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de empresas"
  ON public.empresas
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 4. departamentos
-- ============================================================

ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ler departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Permitir select em departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Permitir insert em departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Permitir update em departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Permitir delete em departamentos" ON public.departamentos;

CREATE POLICY "Permitir select de departamentos"
  ON public.departamentos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Permitir insert de departamentos"
  ON public.departamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de departamentos"
  ON public.departamentos
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de departamentos"
  ON public.departamentos
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 5. ocorrencias (SELECT já restrito na 043; consolida operações)
-- ============================================================

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ocorrencias;
DROP POLICY IF EXISTS "Permitir select de ocorrencias" ON public.ocorrencias;

CREATE POLICY "Permitir select de ocorrencias"
  ON public.ocorrencias
  FOR SELECT TO authenticated
  USING (public.pode_ver_ocorrencias());

CREATE POLICY "Permitir insert de ocorrencias"
  ON public.ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir update de ocorrencias"
  ON public.ocorrencias
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin())
  WITH CHECK (public.is_admin() OR public.is_editor() OR public.is_rh_ou_admin());

CREATE POLICY "Permitir delete de ocorrencias"
  ON public.ocorrencias
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 6. extras, categorias_extras, recibos_extras
-- ============================================================

ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir select de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir insert de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir update de extras" ON public.extras;
DROP POLICY IF EXISTS "Permitir delete de extras" ON public.extras;

DROP POLICY IF EXISTS "Permitir leitura de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir select de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir insert de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir update de categorias_extras" ON public.categorias_extras;
DROP POLICY IF EXISTS "Permitir delete de categorias_extras" ON public.categorias_extras;

DROP POLICY IF EXISTS "Permitir leitura de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir gerenciamento de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir select de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir insert de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir update de recibos_extras" ON public.recibos_extras;
DROP POLICY IF EXISTS "Permitir delete de recibos_extras" ON public.recibos_extras;

CREATE POLICY "Permitir select de extras"
  ON public.extras
  FOR SELECT TO authenticated
  USING (public.pode_ver_extras());

CREATE POLICY "Permitir insert de extras"
  ON public.extras
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de extras"
  ON public.extras
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de extras"
  ON public.extras
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de categorias_extras"
  ON public.categorias_extras
  FOR SELECT TO authenticated
  USING (public.pode_ver_extras());

CREATE POLICY "Permitir insert de categorias_extras"
  ON public.categorias_extras
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de categorias_extras"
  ON public.categorias_extras
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de categorias_extras"
  ON public.categorias_extras
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de recibos_extras"
  ON public.recibos_extras
  FOR SELECT TO authenticated
  USING (public.pode_ver_extras());

CREATE POLICY "Permitir insert de recibos_extras"
  ON public.recibos_extras
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de recibos_extras"
  ON public.recibos_extras
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de recibos_extras"
  ON public.recibos_extras
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 7. contratos_adicionais e vinculos_adicionais
-- ============================================================

ALTER TABLE public.contratos_adicionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculos_adicionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.contratos_adicionais;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.contratos_adicionais;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.vinculos_adicionais;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.vinculos_adicionais;

CREATE POLICY "Permitir select de contratos_adicionais"
  ON public.contratos_adicionais
  FOR SELECT TO authenticated
  USING (public.pode_ver_adicionais());

CREATE POLICY "Permitir insert de contratos_adicionais"
  ON public.contratos_adicionais
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de contratos_adicionais"
  ON public.contratos_adicionais
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de contratos_adicionais"
  ON public.contratos_adicionais
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR SELECT TO authenticated
  USING (public.pode_ver_adicionais());

CREATE POLICY "Permitir insert de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 8. configuracoes
-- ============================================================

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.configuracoes;

-- As policies seguras da migration 015 já devem estar ativas; reforçamos aqui.
DROP POLICY IF EXISTS "Permitir select geral em configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert em configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update em configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update token eContador apenas admin rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.configuracoes;

CREATE POLICY "Permitir select geral em configuracoes"
  ON public.configuracoes
  FOR SELECT TO authenticated
  USING (chave <> 'econtador_token');

CREATE POLICY "Permitir select token eContador apenas admin rh"
  ON public.configuracoes
  FOR SELECT TO authenticated
  USING (chave = 'econtador_token' AND public.is_rh_ou_admin());

CREATE POLICY "Permitir insert em configuracoes"
  ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir update em configuracoes"
  ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (chave <> 'econtador_token' AND public.is_editor())
  WITH CHECK (chave <> 'econtador_token' AND public.is_editor());

CREATE POLICY "Permitir insert token eContador apenas admin rh"
  ON public.configuracoes
  FOR INSERT TO authenticated
  WITH CHECK (chave = 'econtador_token' AND public.is_rh_ou_admin());

CREATE POLICY "Permitir update token eContador apenas admin rh"
  ON public.configuracoes
  FOR UPDATE TO authenticated
  USING (chave = 'econtador_token' AND public.is_rh_ou_admin())
  WITH CHECK (chave = 'econtador_token' AND public.is_rh_ou_admin());

CREATE POLICY "Permitir delete de configuracoes"
  ON public.configuracoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 9. permissoes_perfil
-- ============================================================

ALTER TABLE public.permissoes_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissoes perfil select" ON public.permissoes_perfil;
DROP POLICY IF EXISTS "Permissoes perfil insert" ON public.permissoes_perfil;
DROP POLICY IF EXISTS "Permissoes perfil update" ON public.permissoes_perfil;
DROP POLICY IF EXISTS "Permissoes perfil delete" ON public.permissoes_perfil;

CREATE POLICY "Permitir select de permissoes_perfil"
  ON public.permissoes_perfil
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir insert de permissoes_perfil"
  ON public.permissoes_perfil
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir update de permissoes_perfil"
  ON public.permissoes_perfil
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir delete de permissoes_perfil"
  ON public.permissoes_perfil
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 10. perfis
-- ============================================================

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.perfis;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.perfis;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.perfis;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.perfis;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.perfis;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.perfis;

CREATE POLICY "Permitir select de perfis"
  ON public.perfis
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Permitir insert de perfis"
  ON public.perfis
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Permitir update de perfis"
  ON public.perfis
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "Permitir delete de perfis"
  ON public.perfis
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 11. projetos_vr e resultados_vr
-- ============================================================

ALTER TABLE public.projetos_vr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_vr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.projetos_vr;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir insert para autenticados" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.resultados_vr;

CREATE POLICY "Permitir select de projetos_vr"
  ON public.projetos_vr
  FOR SELECT TO authenticated
  USING (public.pode_ver_vr());

CREATE POLICY "Permitir insert de projetos_vr"
  ON public.projetos_vr
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.pode_ver_vr());

CREATE POLICY "Permitir update de projetos_vr"
  ON public.projetos_vr
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.pode_ver_vr())
  WITH CHECK (public.is_admin() OR public.pode_ver_vr());

CREATE POLICY "Permitir delete de projetos_vr"
  ON public.projetos_vr
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY "Permitir select de resultados_vr"
  ON public.resultados_vr
  FOR SELECT TO authenticated
  USING (public.pode_ver_vr());

CREATE POLICY "Permitir insert de resultados_vr"
  ON public.resultados_vr
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.pode_ver_vr());

CREATE POLICY "Permitir update de resultados_vr"
  ON public.resultados_vr
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.pode_ver_vr())
  WITH CHECK (public.is_admin() OR public.pode_ver_vr());

CREATE POLICY "Permitir delete de resultados_vr"
  ON public.resultados_vr
  FOR DELETE TO authenticated
  USING (public.is_admin());
