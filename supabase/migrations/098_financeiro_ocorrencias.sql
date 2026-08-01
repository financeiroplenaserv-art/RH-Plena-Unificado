-- ============================================================================
-- Migration 098: Financeiro — acesso ao quadro do colaborador e criação de
-- ocorrências.
--
-- Decisão da gestão (01/08/2026): "Dê ao usuário financeiro a possibilidade
-- de ter acesso ao quadro de informações do colaborador assim como inserir
-- ocorrências."
--
-- Situação anterior:
-- - Detalhe do colaborador (/rh/colaboradores/:id): rota e SELECT em
--   colaboradores JÁ funcionavam para financeiro (rota.colaboradores no seed
--   047; pode_ver_colaboradores inclui financeiro desde a 058). A seção de
--   ocorrências da página aparecia vazia porque pode_ver_ocorrencias() não
--   incluía financeiro (SELECT zerava em silêncio).
-- - Ocorrências: rotas fechadas (sem linha rota.ocorrencias), menu oculto
--   (menu.rh), INSERT bloqueado por RLS.
--
-- O que esta migration faz:
-- 1. pode_ver_ocorrencias() passa a incluir financeiro — libera SELECT em
--    ocorrencias e nas tabelas filhas (anexos, testemunhas, defesas), que
--    usam a mesma função. Escopo: leitura para acompanhar o que criou.
-- 2. INSERT em ocorrencias passa a aceitar financeiro (UPDATE/DELETE não —
--    ele só cria; editar/cancelar continuam com os perfis atuais).
-- 3. Linhas dinâmicas da tela Permissões: rota.ocorrencias, menu.rh,
--    ocorrencia.criar e ocorrencia.ver_detalhes = true (o PERMISSOES_PADRAO
--    foi atualizado junto, conforme a regra do AGENTS.md).
-- 4. CPF completo para o financeiro (pedido da gestão na mesma sessão):
--    nova ação colaborador.ver_cpf_completo no mapa padrão
--    (gestor/rh/dp1/dp2/financeiro) + linha dinâmica explícita aqui;
--    listagem e ficha passaram a usar essa ação (antes: editar_completo).
--
-- Limitação conhecida (mesma das migrations 069/089): a função
-- reset_permissoes_perfil (054) tem lista fixa; "Restaurar padrão" do perfil
-- financeiro remove estas concessões — re-aplicar esta migration se isso
-- acontecer.
-- ============================================================================

-- (1) SELECT: inclui financeiro na visão de ocorrências.
CREATE OR REPLACE FUNCTION public.pode_ver_ocorrencias()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'dp1', 'dp2', 'mesa', 'inspetoria', 'financeiro')
  );
$$;

-- (2) INSERT: inclui financeiro (espelha o padrão da policy da 087).
DROP POLICY IF EXISTS "Permitir insert de ocorrencias" ON public.ocorrencias;
CREATE POLICY "Permitir insert de ocorrencias"
  ON public.ocorrencias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_editor()
    OR public.is_rh_ou_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso IN ('inspetoria', 'financeiro')
    )
  );

-- (3) Tela Permissões / rotas / menu (dinâmico tem precedência sobre o mapa
-- padrão — sem estas linhas, verificarPermissao() nega a rota mesmo com o
-- PERMISSOES_PADRAO atualizado).
INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido)
VALUES
  ('financeiro', 'rota', 'ocorrencias', true),
  ('financeiro', 'menu', 'rh', true),
  ('financeiro', 'ocorrencia', 'criar', true),
  ('financeiro', 'ocorrencia', 'ver_detalhes', true),
  ('financeiro', 'colaborador', 'ver_cpf_completo', true)
ON CONFLICT (perfil, recurso, acao) DO UPDATE SET permitido = true, updated_at = now();
