-- Migração 047: Adiciona permissões de acesso a rotas e menus
--
-- Contexto: a migration 046 criou permissões de ações dentro das páginas.
-- Esta migration adiciona permissões de acesso às rotas/menus, permitindo que
-- a tela administrativa /permissoes controle também quem vê cada item do sidebar
-- e quem acessa cada rota.

INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES

-- ADM / ADMIN: acesso total
('adm', 'menu', 'todos', true),
('admin', 'menu', 'todos', true),
('adm', 'rota', 'todos', true),
('admin', 'rota', 'todos', true),

-- Dashboard: todos
('gestor', 'menu', 'dashboard', true),
('rh', 'menu', 'dashboard', true),
('dp1', 'menu', 'dashboard', true),
('dp2', 'menu', 'dashboard', true),
('mesa', 'menu', 'dashboard', true),
('inspetoria', 'menu', 'dashboard', true),
('financeiro', 'menu', 'dashboard', true),
('visualizador', 'menu', 'dashboard', true),

-- Colaboradores: todos visualizam
('gestor', 'menu', 'colaboradores', true),
('rh', 'menu', 'colaboradores', true),
('dp1', 'menu', 'colaboradores', true),
('dp2', 'menu', 'colaboradores', true),
('mesa', 'menu', 'colaboradores', true),
('inspetoria', 'menu', 'colaboradores', true),
('financeiro', 'menu', 'colaboradores', true),
('visualizador', 'menu', 'colaboradores', true),

-- Empresas
('gestor', 'menu', 'empresas', true),
('rh', 'menu', 'empresas', true),
('dp1', 'menu', 'empresas', true),
('dp2', 'menu', 'empresas', true),
('mesa', 'menu', 'empresas', true),
('financeiro', 'menu', 'empresas', true),
('visualizador', 'menu', 'empresas', true),

-- Departamentos: todos visualizam, edição controlada pelas ações internas
('gestor', 'menu', 'departamentos', true),
('rh', 'menu', 'departamentos', true),
('dp1', 'menu', 'departamentos', true),
('dp2', 'menu', 'departamentos', true),
('mesa', 'menu', 'departamentos', true),
('financeiro', 'menu', 'departamentos', true),
('inspetoria', 'menu', 'departamentos', true),
('visualizador', 'menu', 'departamentos', true),

-- RH / Ocorrências
('gestor', 'menu', 'rh', true),
('rh', 'menu', 'rh', true),
('dp1', 'menu', 'rh', true),
('dp2', 'menu', 'rh', true),
('mesa', 'menu', 'rh', true),
('inspetoria', 'menu', 'rh', true),

-- Extras
('mesa', 'menu', 'extras', true),
('dp1', 'menu', 'extras', true),
('financeiro', 'menu', 'extras', true),
('adm', 'menu', 'extras', true),
('admin', 'menu', 'extras', true),

-- VR
('dp1', 'menu', 'vr', true),
('dp2', 'menu', 'vr', true),

-- CEU
('gestor', 'menu', 'ceu', true),
('dp1', 'menu', 'ceu', true),
('mesa', 'menu', 'ceu', true),
('inspetoria', 'menu', 'ceu', true),

-- Adicionais
('gestor', 'menu', 'adicionais', true),
('dp2', 'menu', 'adicionais', true),
('mesa', 'menu', 'adicionais', true),
('financeiro', 'menu', 'adicionais', true),

-- Configurações
('gestor', 'menu', 'configuracoes', true),
('adm', 'menu', 'configuracoes', true),
('admin', 'menu', 'configuracoes', true),
('dp2', 'menu', 'configuracoes', true),

-- Auditoria
('gestor', 'menu', 'auditoria', true),
('adm', 'menu', 'auditoria', true),
('admin', 'menu', 'auditoria', true),

-- Permissões (tela administrativa)
('adm', 'menu', 'permissoes', true),
('admin', 'menu', 'permissoes', true),

-- Alertas
('dp1', 'menu', 'alertas', true),
('adm', 'menu', 'alertas', true),
('admin', 'menu', 'alertas', true),

-- Relatórios (placeholder)
('gestor', 'menu', 'relatorios', true),
('rh', 'menu', 'relatorios', true),
('dp1', 'menu', 'relatorios', true),
('dp2', 'menu', 'relatorios', true),
('mesa', 'menu', 'relatorios', true),
('inspetoria', 'menu', 'relatorios', true),
('financeiro', 'menu', 'relatorios', true),
('visualizador', 'menu', 'relatorios', true),

-- Férias (placeholder)
('gestor', 'menu', 'ferias', true),
('rh', 'menu', 'ferias', true),
('dp1', 'menu', 'ferias', true),
('dp2', 'menu', 'ferias', true),
('mesa', 'menu', 'ferias', true),
('inspetoria', 'menu', 'ferias', true),
('financeiro', 'menu', 'ferias', true),
('visualizador', 'menu', 'ferias', true),

-- ============================================================
-- Rotas específicas (usadas pelo ProtectedRoute)
-- ============================================================

-- Rotas de dados mestres
('gestor', 'rota', 'empresas', true),
('rh', 'rota', 'empresas', true),
('dp1', 'rota', 'empresas', true),
('dp2', 'rota', 'empresas', true),
('mesa', 'rota', 'empresas', true),
('financeiro', 'rota', 'empresas', true),
('visualizador', 'rota', 'empresas', true),

('gestor', 'rota', 'departamentos', true),
('rh', 'rota', 'departamentos', true),
('dp1', 'rota', 'departamentos', true),
('dp2', 'rota', 'departamentos', true),
('mesa', 'rota', 'departamentos', true),
('financeiro', 'rota', 'departamentos', true),
('inspetoria', 'rota', 'departamentos', true),
('visualizador', 'rota', 'departamentos', true),

('gestor', 'rota', 'colaboradores', true),
('rh', 'rota', 'colaboradores', true),
('dp1', 'rota', 'colaboradores', true),
('dp2', 'rota', 'colaboradores', true),
('mesa', 'rota', 'colaboradores', true),
('inspetoria', 'rota', 'colaboradores', true),
('financeiro', 'rota', 'colaboradores', true),
('visualizador', 'rota', 'colaboradores', true),

-- Rotas de importação e-Contador
('dp1', 'rota', 'importar_econtador', true),
('dp2', 'rota', 'importar_econtador', true),

-- Rotas de ocorrências
('gestor', 'rota', 'ocorrencias', true),
('rh', 'rota', 'ocorrencias', true),
('dp1', 'rota', 'ocorrencias', true),
('dp2', 'rota', 'ocorrencias', true),
('mesa', 'rota', 'ocorrencias', true),
('inspetoria', 'rota', 'ocorrencias', true),

-- Rotas de extras
('mesa', 'rota', 'extras', true),
('dp1', 'rota', 'extras', true),
('financeiro', 'rota', 'extras', true),

-- Rotas de VR
('dp1', 'rota', 'vr', true),
('dp2', 'rota', 'vr', true),

-- Rotas de CEU
('gestor', 'rota', 'ceu', true),
('dp1', 'rota', 'ceu', true),
('mesa', 'rota', 'ceu', true),
('inspetoria', 'rota', 'ceu', true),

-- Rotas de adicionais
('gestor', 'rota', 'adicionais', true),
('dp2', 'rota', 'adicionais', true),
('mesa', 'rota', 'adicionais', true),
('financeiro', 'rota', 'adicionais', true),

-- Rotas de configurações e auditoria
('gestor', 'rota', 'configuracoes', true),
('dp2', 'rota', 'configuracoes', true),

('gestor', 'rota', 'auditoria', true),

-- Rota de permissões
('adm', 'rota', 'permissoes', true),
('admin', 'rota', 'permissoes', true),

-- Rotas de alertas
('dp1', 'rota', 'alertas', true),

-- Rotas de relatórios/ferias (placeholders)
('gestor', 'rota', 'relatorios', true),
('rh', 'rota', 'relatorios', true),
('dp1', 'rota', 'relatorios', true),
('dp2', 'rota', 'relatorios', true),
('mesa', 'rota', 'relatorios', true),
('inspetoria', 'rota', 'relatorios', true),
('financeiro', 'rota', 'relatorios', true),
('visualizador', 'rota', 'relatorios', true),

('gestor', 'rota', 'ferias', true),
('rh', 'rota', 'ferias', true),
('dp1', 'rota', 'ferias', true),
('dp2', 'rota', 'ferias', true),
('mesa', 'rota', 'ferias', true),
('inspetoria', 'rota', 'ferias', true),
('financeiro', 'rota', 'ferias', true),
('visualizador', 'rota', 'ferias', true)

ON CONFLICT (perfil, recurso, acao) DO UPDATE
SET permitido = EXCLUDED.permitido,
    updated_at = now();
