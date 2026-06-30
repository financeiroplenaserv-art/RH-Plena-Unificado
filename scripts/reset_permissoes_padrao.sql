-- Reset das permissões para o padrão seguro do seed
--
-- Este script restaura a tabela public.permissoes_perfil para o estado original
-- definido pelas migrations 046 e 047. Ele apaga todas as permissões dos perfis
-- listados abaixo e reinsere apenas as permissões do seed padrão.
--
-- Recomendação: executar no SQL Editor do Supabase quando as permissões estiverem
-- inconsistentes (por exemplo, perfil adm com permissões false no banco).

BEGIN;

-- Limpa permissões existentes dos perfis que serão resetados
DELETE FROM public.permissoes_perfil
WHERE perfil IN ('adm', 'admin', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro', 'visualizador');

-- ============================================================
-- 1. Permissões de ações (migration 046)
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
('financeiro', 'extras', 'ver_balanco', true),

-- Escalas (migration 048)
('adm', 'escala', 'visualizar', true),
('admin', 'escala', 'visualizar', true),
('gestor', 'escala', 'visualizar', true),
('rh', 'escala', 'visualizar', true),
('dp1', 'escala', 'visualizar', true),
('dp2', 'escala', 'visualizar', true),
('mesa', 'escala', 'visualizar', true),
('inspetoria', 'escala', 'visualizar', true),
('financeiro', 'escala', 'visualizar', true),
('visualizador', 'escala', 'visualizar', true),

('adm', 'escala', 'editar_local', true),
('admin', 'escala', 'editar_local', true),
('gestor', 'escala', 'editar_local', true),
('rh', 'escala', 'editar_local', true),
('dp1', 'escala', 'editar_local', true),
('dp2', 'escala', 'editar_local', true),

('adm', 'escala', 'mapear_flit', true),
('admin', 'escala', 'mapear_flit', true),
('gestor', 'escala', 'mapear_flit', true),
('rh', 'escala', 'mapear_flit', true),
('dp1', 'escala', 'mapear_flit', true),
('dp2', 'escala', 'mapear_flit', true),

('adm', 'escala', 'importar', true),
('admin', 'escala', 'importar', true),
('gestor', 'escala', 'importar', true),
('rh', 'escala', 'importar', true),
('dp1', 'escala', 'importar', true),
('dp2', 'escala', 'importar', true),

('adm', 'escala', 'confirmar_manual', true),
('admin', 'escala', 'confirmar_manual', true),
('gestor', 'escala', 'confirmar_manual', true),
('rh', 'escala', 'confirmar_manual', true),
('dp1', 'escala', 'confirmar_manual', true),
('dp2', 'escala', 'confirmar_manual', true),
('mesa', 'escala', 'confirmar_manual', true),

('adm', 'escala', 'editar_dia', true),
('admin', 'escala', 'editar_dia', true),
('gestor', 'escala', 'editar_dia', true),
('rh', 'escala', 'editar_dia', true),
('dp1', 'escala', 'editar_dia', true),
('dp2', 'escala', 'editar_dia', true),
('mesa', 'escala', 'editar_dia', true)

ON CONFLICT (perfil, recurso, acao) DO UPDATE
SET permitido = EXCLUDED.permitido,
    updated_at = now();

-- ============================================================
-- 2. Permissões de menus e rotas (migrations 047 e 048)
-- ============================================================

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

-- Departamentos: todos visualizam
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
('inspetoria', 'menu', 'extras', true),
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

-- Escalas
('adm', 'menu', 'escalas', true),
('admin', 'menu', 'escalas', true),
('gestor', 'menu', 'escalas', true),
('rh', 'menu', 'escalas', true),
('dp1', 'menu', 'escalas', true),
('dp2', 'menu', 'escalas', true),
('mesa', 'menu', 'escalas', true),
('inspetoria', 'menu', 'escalas', true),
('financeiro', 'menu', 'escalas', true),
('visualizador', 'menu', 'escalas', true),

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
('inspetoria', 'rota', 'extras', true),

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
('visualizador', 'rota', 'ferias', true),

('adm', 'rota', 'escalas', true),
('admin', 'rota', 'escalas', true),
('gestor', 'rota', 'escalas', true),
('rh', 'rota', 'escalas', true),
('dp1', 'rota', 'escalas', true),
('dp2', 'rota', 'escalas', true),
('mesa', 'rota', 'escalas', true),
('inspetoria', 'rota', 'escalas', true),
('financeiro', 'rota', 'escalas', true),
('visualizador', 'rota', 'escalas', true),

('gestor', 'rota', 'mobile_falta', true),
('rh', 'rota', 'mobile_falta', true),
('dp1', 'rota', 'mobile_falta', true),
('dp2', 'rota', 'mobile_falta', true),
('mesa', 'rota', 'mobile_falta', true),
('inspetoria', 'rota', 'mobile_falta', true),
('financeiro', 'rota', 'mobile_falta', true),
('visualizador', 'rota', 'mobile_falta', true)

ON CONFLICT (perfil, recurso, acao) DO UPDATE
SET permitido = EXCLUDED.permitido,
    updated_at = now();

COMMIT;
