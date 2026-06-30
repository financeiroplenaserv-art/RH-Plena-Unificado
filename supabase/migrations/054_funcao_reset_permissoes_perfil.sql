-- Migração 054: Função para resetar permissões de um perfil para o padrão seguro
--
-- Permite que o administrador restaure as permissões de um perfil específico
-- diretamente pela tela /permissoes, sem precisar executar SQL manualmente.

CREATE OR REPLACE FUNCTION public.reset_permissoes_perfil(p_perfil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Apenas administradores podem executar esta função
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar permissões';
  END IF;

  IF p_perfil IS NULL OR p_perfil = '' THEN
    RAISE EXCEPTION 'Perfil não informado';
  END IF;

  -- Remove as permissões atuais do perfil
  DELETE FROM public.permissoes_perfil
  WHERE perfil = p_perfil;

  -- ============================================================
  -- ADM / ADMIN: acesso total
  -- ============================================================
  IF p_perfil IN ('adm', 'admin') THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('adm', 'todos', 'todos', true),
      ('admin', 'todos', 'todos', true),
      ('adm', 'menu', 'todos', true),
      ('admin', 'menu', 'todos', true),
      ('adm', 'rota', 'todos', true),
      ('admin', 'rota', 'todos', true);
    RETURN;
  END IF;

  -- ============================================================
  -- VISUALIZADOR
  -- ============================================================
  IF p_perfil = 'visualizador' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('visualizador', 'dashboard', 'ver', true),
      ('visualizador', 'colaboradores', 'ver', true),
      ('visualizador', 'empresas', 'ver', true),
      ('visualizador', 'departamentos', 'ver', true),
      ('visualizador', 'extras', 'ver_balanco', true),
      ('visualizador', 'menu', 'dashboard', true),
      ('visualizador', 'menu', 'colaboradores', true),
      ('visualizador', 'menu', 'empresas', true),
      ('visualizador', 'menu', 'departamentos', true),
      ('visualizador', 'menu', 'relatorios', true),
      ('visualizador', 'menu', 'ferias', true),
      ('visualizador', 'rota', 'empresas', true),
      ('visualizador', 'rota', 'departamentos', true),
      ('visualizador', 'rota', 'colaboradores', true),
      ('visualizador', 'rota', 'relatorios', true),
      ('visualizador', 'rota', 'ferias', true),
      ('visualizador', 'rota', 'mobile_falta', true),
      ('visualizador', 'menu', 'escalas', true),
      ('visualizador', 'rota', 'escalas', true),
      ('visualizador', 'escala', 'visualizar', true);
    RETURN;
  END IF;

  -- ============================================================
  -- GESTOR
  -- ============================================================
  IF p_perfil = 'gestor' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
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
      ('gestor', 'menu', 'dashboard', true),
      ('gestor', 'menu', 'colaboradores', true),
      ('gestor', 'menu', 'empresas', true),
      ('gestor', 'menu', 'departamentos', true),
      ('gestor', 'menu', 'rh', true),
      ('gestor', 'menu', 'ceu', true),
      ('gestor', 'menu', 'adicionais', true),
      ('gestor', 'menu', 'configuracoes', true),
      ('gestor', 'menu', 'auditoria', true),
      ('gestor', 'menu', 'relatorios', true),
      ('gestor', 'menu', 'ferias', true),
      ('gestor', 'rota', 'empresas', true),
      ('gestor', 'rota', 'departamentos', true),
      ('gestor', 'rota', 'colaboradores', true),
      ('gestor', 'rota', 'ocorrencias', true),
      ('gestor', 'rota', 'ceu', true),
      ('gestor', 'rota', 'adicionais', true),
      ('gestor', 'rota', 'configuracoes', true),
      ('gestor', 'rota', 'auditoria', true),
      ('gestor', 'rota', 'relatorios', true),
      ('gestor', 'rota', 'ferias', true),
      ('gestor', 'rota', 'mobile_falta', true),
      ('gestor', 'menu', 'escalas', true),
      ('gestor', 'rota', 'escalas', true),
      ('gestor', 'escala', 'visualizar', true),
      ('gestor', 'escala', 'editar_local', true),
      ('gestor', 'escala', 'mapear_flit', true),
      ('gestor', 'escala', 'importar', true),
      ('gestor', 'escala', 'confirmar_manual', true),
      ('gestor', 'escala', 'editar_dia', true);
    RETURN;
  END IF;

  -- ============================================================
  -- RH
  -- ============================================================
  IF p_perfil = 'rh' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
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
      ('rh', 'menu', 'dashboard', true),
      ('rh', 'menu', 'colaboradores', true),
      ('rh', 'menu', 'empresas', true),
      ('rh', 'menu', 'departamentos', true),
      ('rh', 'menu', 'rh', true),
      ('rh', 'menu', 'relatorios', true),
      ('rh', 'menu', 'ferias', true),
      ('rh', 'rota', 'empresas', true),
      ('rh', 'rota', 'departamentos', true),
      ('rh', 'rota', 'colaboradores', true),
      ('rh', 'rota', 'ocorrencias', true),
      ('rh', 'rota', 'relatorios', true),
      ('rh', 'rota', 'ferias', true),
      ('rh', 'rota', 'mobile_falta', true),
      ('rh', 'menu', 'escalas', true),
      ('rh', 'rota', 'escalas', true),
      ('rh', 'escala', 'visualizar', true),
      ('rh', 'escala', 'editar_local', true),
      ('rh', 'escala', 'mapear_flit', true),
      ('rh', 'escala', 'importar', true),
      ('rh', 'escala', 'confirmar_manual', true),
      ('rh', 'escala', 'editar_dia', true);
    RETURN;
  END IF;

  -- ============================================================
  -- DP1
  -- ============================================================
  IF p_perfil = 'dp1' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
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
      ('dp1', 'menu', 'dashboard', true),
      ('dp1', 'menu', 'colaboradores', true),
      ('dp1', 'menu', 'empresas', true),
      ('dp1', 'menu', 'departamentos', true),
      ('dp1', 'menu', 'rh', true),
      ('dp1', 'menu', 'extras', true),
      ('dp1', 'menu', 'vr', true),
      ('dp1', 'menu', 'ceu', true),
      ('dp1', 'menu', 'adicionais', true),
      ('dp1', 'menu', 'alertas', true),
      ('dp1', 'menu', 'relatorios', true),
      ('dp1', 'menu', 'ferias', true),
      ('dp1', 'rota', 'empresas', true),
      ('dp1', 'rota', 'departamentos', true),
      ('dp1', 'rota', 'colaboradores', true),
      ('dp1', 'rota', 'ocorrencias', true),
      ('dp1', 'rota', 'extras', true),
      ('dp1', 'rota', 'vr', true),
      ('dp1', 'rota', 'ceu', true),
      ('dp1', 'rota', 'adicionais', true),
      ('dp1', 'rota', 'importar_econtador', true),
      ('dp1', 'rota', 'alertas', true),
      ('dp1', 'rota', 'relatorios', true),
      ('dp1', 'rota', 'ferias', true),
      ('dp1', 'rota', 'mobile_falta', true),
      ('dp1', 'menu', 'escalas', true),
      ('dp1', 'rota', 'escalas', true),
      ('dp1', 'escala', 'visualizar', true),
      ('dp1', 'escala', 'editar_local', true),
      ('dp1', 'escala', 'mapear_flit', true),
      ('dp1', 'escala', 'importar', true),
      ('dp1', 'escala', 'confirmar_manual', true),
      ('dp1', 'escala', 'editar_dia', true);
    RETURN;
  END IF;

  -- ============================================================
  -- DP2
  -- ============================================================
  IF p_perfil = 'dp2' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
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
      ('dp2', 'menu', 'dashboard', true),
      ('dp2', 'menu', 'colaboradores', true),
      ('dp2', 'menu', 'empresas', true),
      ('dp2', 'menu', 'departamentos', true),
      ('dp2', 'menu', 'rh', true),
      ('dp2', 'menu', 'extras', true),
      ('dp2', 'menu', 'vr', true),
      ('dp2', 'menu', 'ceu', true),
      ('dp2', 'menu', 'adicionais', true),
      ('dp2', 'menu', 'configuracoes', true),
      ('dp2', 'menu', 'relatorios', true),
      ('dp2', 'menu', 'ferias', true),
      ('dp2', 'rota', 'empresas', true),
      ('dp2', 'rota', 'departamentos', true),
      ('dp2', 'rota', 'colaboradores', true),
      ('dp2', 'rota', 'ocorrencias', true),
      ('dp2', 'rota', 'extras', true),
      ('dp2', 'rota', 'vr', true),
      ('dp2', 'rota', 'ceu', true),
      ('dp2', 'rota', 'adicionais', true),
      ('dp2', 'rota', 'importar_econtador', true),
      ('dp2', 'rota', 'configuracoes', true),
      ('dp2', 'rota', 'relatorios', true),
      ('dp2', 'rota', 'ferias', true),
      ('dp2', 'rota', 'mobile_falta', true),
      ('dp2', 'menu', 'escalas', true),
      ('dp2', 'rota', 'escalas', true),
      ('dp2', 'escala', 'visualizar', true),
      ('dp2', 'escala', 'editar_local', true),
      ('dp2', 'escala', 'mapear_flit', true),
      ('dp2', 'escala', 'importar', true),
      ('dp2', 'escala', 'confirmar_manual', true),
      ('dp2', 'escala', 'editar_dia', true);
    RETURN;
  END IF;

  -- ============================================================
  -- MESA
  -- ============================================================
  IF p_perfil = 'mesa' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
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
      ('mesa', 'menu', 'dashboard', true),
      ('mesa', 'menu', 'colaboradores', true),
      ('mesa', 'menu', 'empresas', true),
      ('mesa', 'menu', 'departamentos', true),
      ('mesa', 'menu', 'rh', true),
      ('mesa', 'menu', 'extras', true),
      ('mesa', 'menu', 'ceu', true),
      ('mesa', 'menu', 'adicionais', true),
      ('mesa', 'menu', 'relatorios', true),
      ('mesa', 'menu', 'ferias', true),
      ('mesa', 'rota', 'empresas', true),
      ('mesa', 'rota', 'departamentos', true),
      ('mesa', 'rota', 'colaboradores', true),
      ('mesa', 'rota', 'ocorrencias', true),
      ('mesa', 'rota', 'extras', true),
      ('mesa', 'rota', 'ceu', true),
      ('mesa', 'rota', 'adicionais', true),
      ('mesa', 'rota', 'relatorios', true),
      ('mesa', 'rota', 'ferias', true),
      ('mesa', 'rota', 'mobile_falta', true),
      ('mesa', 'menu', 'escalas', true),
      ('mesa', 'rota', 'escalas', true),
      ('mesa', 'escala', 'visualizar', true),
      ('mesa', 'escala', 'confirmar_manual', true),
      ('mesa', 'escala', 'editar_dia', true);
    RETURN;
  END IF;

  -- ============================================================
  -- INSPETORIA
  -- ============================================================
  IF p_perfil = 'inspetoria' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('inspetoria', 'ocorrencia', 'ver_detalhes', true),
      ('inspetoria', 'ocorrencia', 'anexar', true),
      ('inspetoria', 'ocorrencia', 'adicionar_testemunha', true),
      ('inspetoria', 'ocorrencia', 'gerar_pdf', true),
      ('inspetoria', 'extras', 'editar', true),
      ('inspetoria', 'extras', 'editar_categoria', true),
      ('inspetoria', 'extras', 'enviar_comunicacao', true),
      ('inspetoria', 'extras', 'ver_balanco', true),
      ('inspetoria', 'menu', 'dashboard', true),
      ('inspetoria', 'menu', 'colaboradores', true),
      ('inspetoria', 'menu', 'departamentos', true),
      ('inspetoria', 'menu', 'rh', true),
      ('inspetoria', 'menu', 'extras', true),
      ('inspetoria', 'menu', 'ceu', true),
      ('inspetoria', 'menu', 'relatorios', true),
      ('inspetoria', 'menu', 'ferias', true),
      ('inspetoria', 'rota', 'departamentos', true),
      ('inspetoria', 'rota', 'colaboradores', true),
      ('inspetoria', 'rota', 'ocorrencias', true),
      ('inspetoria', 'rota', 'extras', true),
      ('inspetoria', 'rota', 'ceu', true),
      ('inspetoria', 'rota', 'relatorios', true),
      ('inspetoria', 'rota', 'ferias', true),
      ('inspetoria', 'rota', 'mobile_falta', true),
      ('inspetoria', 'menu', 'escalas', true),
      ('inspetoria', 'rota', 'escalas', true),
      ('inspetoria', 'escala', 'visualizar', true);
    RETURN;
  END IF;

  -- ============================================================
  -- FINANCEIRO
  -- ============================================================
  IF p_perfil = 'financeiro' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
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
      ('financeiro', 'menu', 'dashboard', true),
      ('financeiro', 'menu', 'colaboradores', true),
      ('financeiro', 'menu', 'empresas', true),
      ('financeiro', 'menu', 'departamentos', true),
      ('financeiro', 'menu', 'extras', true),
      ('financeiro', 'menu', 'adicionais', true),
      ('financeiro', 'menu', 'relatorios', true),
      ('financeiro', 'menu', 'ferias', true),
      ('financeiro', 'rota', 'empresas', true),
      ('financeiro', 'rota', 'departamentos', true),
      ('financeiro', 'rota', 'colaboradores', true),
      ('financeiro', 'rota', 'extras', true),
      ('financeiro', 'rota', 'adicionais', true),
      ('financeiro', 'rota', 'relatorios', true),
      ('financeiro', 'rota', 'ferias', true),
      ('financeiro', 'rota', 'mobile_falta', true),
      ('financeiro', 'menu', 'escalas', true),
      ('financeiro', 'rota', 'escalas', true),
      ('financeiro', 'escala', 'visualizar', true);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Perfil desconhecido: %', p_perfil;
END;
$$;

-- Permite que usuários autenticados chamem a função (a função interna valida se é admin)
GRANT EXECUTE ON FUNCTION public.reset_permissoes_perfil(text) TO authenticated;
