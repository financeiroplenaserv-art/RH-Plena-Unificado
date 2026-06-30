-- Diagnóstico rápido do ambiente de testes
-- Execute no SQL Editor do Supabase

-- 1. Verifica se os usuários de teste existem
SELECT 
  u.email,
  u.created_at,
  p.nome AS perfil_nome,
  p.nivel_acesso
FROM auth.users u
LEFT JOIN public.perfis p ON p.id = u.id
WHERE u.email LIKE 'teste.%@plena.local'
ORDER BY u.email;

-- 2. Conta quantas permissões existem por perfil na tabela dinâmica
SELECT 
  perfil,
  COUNT(*) AS total_permissoes,
  COUNT(*) FILTER (WHERE permitido = true) AS permitidas,
  COUNT(*) FILTER (WHERE permitido = false) AS negadas
FROM public.permissoes_perfil
WHERE perfil IN ('adm', 'admin', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro', 'visualizador')
GROUP BY perfil
ORDER BY perfil;

-- 3. Lista permissões de menu e rota por perfil (controle de sidebar/acesso)
SELECT 
  perfil,
  recurso,
  acao,
  permitido
FROM public.permissoes_perfil
WHERE recurso IN ('menu', 'rota')
  AND perfil IN ('adm', 'admin', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro', 'visualizador')
ORDER BY perfil, recurso, acao;

-- 4. Lista permissões de ações críticas por perfil
SELECT 
  perfil,
  recurso,
  acao,
  permitido
FROM public.permissoes_perfil
WHERE (
  (recurso = 'colaborador' AND acao IN ('cadastrar', 'excluir', 'editar_completo'))
  OR (recurso = 'ocorrencia' AND acao IN ('criar', 'editar', 'cancelar'))
  OR (recurso = 'extras' AND acao IN ('editar', 'marcar_pago', 'gerenciar_recibo'))
  OR (recurso = 'vr' AND acao IN ('visualizar', 'gerenciar'))
  OR (recurso = 'econtador' AND acao = 'gerenciar')
  OR (recurso = 'configuracoes' AND acao = 'ver')
  OR (recurso = 'auditoria' AND acao = 'ver')
)
AND perfil IN ('adm', 'admin', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro', 'visualizador')
ORDER BY perfil, recurso, acao;
