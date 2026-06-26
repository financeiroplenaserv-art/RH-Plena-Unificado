-- Migração 046: Cria tabela administrativa de permissões por perfil
--
-- Objetivo: permitir que administradores ajustem o que cada perfil pode fazer
-- no sistema sem precisar editar código.

-- ============================================================
-- 1. Criação da tabela
-- ============================================================

CREATE TABLE IF NOT EXISTS public.permissoes_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil TEXT NOT NULL,
  recurso TEXT NOT NULL,
  acao TEXT NOT NULL,
  permitido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(perfil, recurso, acao)
);

COMMENT ON TABLE public.permissoes_perfil IS 'Configuração dinâmica de permissões por perfil de acesso.';

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE public.permissoes_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissoes perfil select" ON public.permissoes_perfil;
DROP POLICY IF EXISTS "Permissoes perfil insert" ON public.permissoes_perfil;
DROP POLICY IF EXISTS "Permissoes perfil update" ON public.permissoes_perfil;
DROP POLICY IF EXISTS "Permissoes perfil delete" ON public.permissoes_perfil;

CREATE POLICY "Permissoes perfil select"
  ON public.permissoes_perfil
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permissoes perfil insert"
  ON public.permissoes_perfil
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Permissoes perfil update"
  ON public.permissoes_perfil
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Permissoes perfil delete"
  ON public.permissoes_perfil
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 3. Popula com permissões atuais do src/lib/permissoes.ts
-- ============================================================

INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES

-- ADM / ADMIN: tudo permitido
('adm', 'todos', 'todos', true),
('admin', 'todos', 'todos', true),

-- VISUALIZADOR: apenas visualização básica
('visualizador', 'dashboard', 'ver', true),
('visualizador', 'colaboradores', 'ver', true),
('visualizador', 'empresas', 'ver', true),
('visualizador', 'departamentos', 'ver', true),
('visualizador', 'extras', 'ver_balanco', true),

-- GESTOR
('gestor', 'empresa', 'editar', true),
('gestor', 'departamento', 'editar', true),
('gestor', 'departamento', 'excluir', true),
('gestor', 'departamento', 'importar', true),
('gestor', 'colaborador', 'editar_basico', true),
('gestor', 'colaborador', 'editar_completo', true),
('gestor', 'colaborador', 'exportar', true),
('gestor', 'ocorrencia', 'criar', true),
('gestor', 'ocorrencia', 'editar', true),
('gestor', 'ocorrencia', 'cancelar', true),
('gestor', 'ocorrencia', 'ver_detalhes', true),
('gestor', 'ocorrencia', 'aprovar', true),
('gestor', 'ocorrencia', 'anexar', true),
('gestor', 'ocorrencia', 'adicionar_testemunha', true),
('gestor', 'ocorrencia', 'gerar_pdf', true),
('gestor', 'adicionais', 'editar_contrato', true),
('gestor', 'adicionais', 'ver_relatorio', false),
('gestor', 'auditoria', 'ver', true),
('gestor', 'configuracoes', 'ver', true),

-- RH
('rh', 'colaborador', 'editar_basico', true),
('rh', 'colaborador', 'editar_completo', true),
('rh', 'colaborador', 'cadastrar', true),
('rh', 'colaborador', 'exportar', true),
('rh', 'departamento', 'importar', true),
('rh', 'ocorrencia', 'criar', true),
('rh', 'ocorrencia', 'editar', true),
('rh', 'ocorrencia', 'cancelar', true),
('rh', 'ocorrencia', 'ver_detalhes', true),
('rh', 'ocorrencia', 'aprovar', true),
('rh', 'ocorrencia', 'anexar', true),
('rh', 'ocorrencia', 'adicionar_testemunha', true),
('rh', 'ocorrencia', 'gerar_pdf', true),
('rh', 'ocorrencia', 'gerenciar_modelos', true),
('rh', 'econtador', 'gerenciar', true),

-- DP1
('dp1', 'empresa', 'editar', true),
('dp1', 'departamento', 'editar', true),
('dp1', 'colaborador', 'editar_basico', true),
('dp1', 'colaborador', 'editar_completo', true),
('dp1', 'colaborador', 'cadastrar', true),
('dp1', 'colaborador', 'excluir', true),
('dp1', 'colaborador', 'importar', true),
('dp1', 'colaborador', 'exportar', true),
('dp1', 'departamento', 'importar', true),
('dp1', 'econtador', 'gerenciar', true),
('dp1', 'ocorrencia', 'criar', true),
('dp1', 'ocorrencia', 'editar', true),
('dp1', 'ocorrencia', 'cancelar', true),
('dp1', 'ocorrencia', 'ver_detalhes', true),
('dp1', 'ocorrencia', 'aprovar', true),
('dp1', 'ocorrencia', 'anexar', true),
('dp1', 'ocorrencia', 'adicionar_testemunha', true),
('dp1', 'ocorrencia', 'gerar_pdf', true),
('dp1', 'ocorrencia', 'gerenciar_modelos', true),
('dp1', 'alertas', 'gerenciar', true),
('dp1', 'vr', 'visualizar', true),
('dp1', 'extras', 'gerenciar_recibo', true),
('dp1', 'adicionais', 'ver_relatorio', true),

-- DP2
('dp2', 'empresa', 'editar', true),
('dp2', 'departamento', 'editar', true),
('dp2', 'colaborador', 'editar_basico', true),
('dp2', 'colaborador', 'editar_completo', true),
('dp2', 'colaborador', 'cadastrar', true),
('dp2', 'colaborador', 'excluir', true),
('dp2', 'colaborador', 'importar', true),
('dp2', 'colaborador', 'exportar', true),
('dp2', 'departamento', 'importar', true),
('dp2', 'econtador', 'gerenciar', true),
('dp2', 'configuracoes', 'configurar_token', true),
('dp2', 'ocorrencia', 'criar', true),
('dp2', 'ocorrencia', 'editar', true),
('dp2', 'ocorrencia', 'ver_detalhes', true),
('dp2', 'ocorrencia', 'aprovar', true),
('dp2', 'ocorrencia', 'anexar', true),
('dp2', 'ocorrencia', 'adicionar_testemunha', true),
('dp2', 'ocorrencia', 'gerar_pdf', true),
('dp2', 'ocorrencia', 'gerenciar_modelos', true),
('dp2', 'vr', 'visualizar', true),
('dp2', 'vr', 'gerenciar', true),
('dp2', 'adicionais', 'editar_contrato', true),
('dp2', 'adicionais', 'editar_vinculo', true),
('dp2', 'adicionais', 'editar_calendario', true),
('dp2', 'adicionais', 'ver_relatorio', true),
('dp2', 'extras', 'gerenciar_recibo', true),

-- MESA
('mesa', 'colaborador', 'editar_basico', true),
('mesa', 'colaborador', 'exportar', true),
('mesa', 'departamento', 'editar', true),
('mesa', 'departamento', 'importar', true),
('mesa', 'ocorrencia', 'criar', true),
('mesa', 'ocorrencia', 'editar', true),
('mesa', 'ocorrencia', 'cancelar', true),
('mesa', 'ocorrencia', 'ver_detalhes', true),
('mesa', 'ocorrencia', 'anexar', true),
('mesa', 'ocorrencia', 'adicionar_testemunha', true),
('mesa', 'ocorrencia', 'gerar_pdf', true),
('mesa', 'extras', 'editar', true),
('mesa', 'extras', 'editar_categoria', true),
('mesa', 'extras', 'excluir_categoria', true),
('mesa', 'extras', 'gerenciar_recibo', true),
('mesa', 'extras', 'ver_relatorio', true),
('mesa', 'adicionais', 'editar_contrato', true),
('mesa', 'adicionais', 'editar_vinculo', true),
('mesa', 'adicionais', 'editar_calendario', true),
('mesa', 'extras', 'enviar_comunicacao', true),
('mesa', 'extras', 'ver_balanco', true),

-- INSPETORIA
('inspetoria', 'ocorrencia', 'ver_detalhes', true),
('inspetoria', 'ocorrencia', 'anexar', true),
('inspetoria', 'ocorrencia', 'adicionar_testemunha', true),
('inspetoria', 'ocorrencia', 'gerar_pdf', true),
('inspetoria', 'extras', 'editar', true),
('inspetoria', 'extras', 'editar_categoria', true),
('inspetoria', 'extras', 'enviar_comunicacao', true),
('inspetoria', 'extras', 'ver_balanco', true),

-- FINANCEIRO
('financeiro', 'empresa', 'editar', true),
('financeiro', 'departamento', 'editar', true),
('financeiro', 'departamento', 'excluir', true),
('financeiro', 'colaborador', 'exportar', true),
('financeiro', 'adicionais', 'editar_contrato', true),
('financeiro', 'adicionais', 'ver_relatorio', true),
('financeiro', 'extras', 'editar_categoria', true),
('financeiro', 'extras', 'excluir_categoria', true),
('financeiro', 'extras', 'gerenciar_recibo', true),
('financeiro', 'extras', 'marcar_pago', true),
('financeiro', 'extras', 'cancelar_recibo', true),
('financeiro', 'extras', 'ver_relatorio', true),
('financeiro', 'extras', 'ver_balanco', true)

ON CONFLICT (perfil, recurso, acao) DO UPDATE
SET permitido = EXCLUDED.permitido,
    updated_at = now();
