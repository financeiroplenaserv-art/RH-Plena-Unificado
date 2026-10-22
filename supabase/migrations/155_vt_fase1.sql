-- 155_vt_fase1.sql
-- Módulo VT (Vale-Transporte) — Fase 1 (plano: docs/PLANO_MODULO_VT.md;
-- decisões da gestora de 21/10/2026). Escopo: cadastro de optantes/tipo de
-- bilhete, trajetos casa → posto e custo do dia por combinação nomeada com
-- valor diário fechado (§2d do plano — substitui o modelo "conduções × tarifa").
-- NÃO aplicada — a gestora aplica via Management API (script de ARQUIVO, nunca
-- inline — regra da migration 131: SQL com acento só via arquivo UTF-8).
--
--  A) colaboradores: vt_optante (usa VT?) e vt_tipo_cartao ('bun' = Bilhete
--     Único de Niterói, 'bui' = Bilhete Único Intermunicipal, 'comum' = sem
--     integração). Cadastro manual: a API da Alterdata não expõe VT
--     (verificado ao vivo em 21/10/2026 — plano §9).
--  B) vt_combinacoes: combinação nomeada com VALOR DIÁRIO FECHADO (ida+volta)
--     — modelo aprovado pela gestora em 21/10/2026 (plano §2d/§10.8). A
--     precificação do VT NÃO é por conduções × tarifa: cada combinação tem um
--     valor diário e um trajeto usa até 2 combinações (custo do dia = soma).
--     Tabela COM VIGÊNCIA (padrão ceu_itens_precos). Seeds com as 9
--     combinações reais confirmadas pela gestora.
--  C) vt_trajetos: um trajeto por par colaborador × departamento (posto) —
--     cache eterno, só recalcula quando muda o endereço ou o posto. Nasce
--     'sugerido' e só entra no cálculo depois de 'confirmado' pelo RH (regra
--     "importação nunca grava palpite"). Precificação por combinação nomeada
--     (combinacao_id + opcional combinacao_2_id — nunca igual à 1ª); a coluna
--     `escopo` ficou como classificação INFORMACIONAL auto-sugerida (não
--     precifica mais). precisao_origem: 'exato' (rua + número) ou 'bairro'
--     (selo "precisão reduzida", confirmação com mapa).
--  D) vt_geocode_cache: cache de geocodificação por endereço normalizado
--     (LGPD: sem nome/CPF). A Fase 1 NÃO chama geocoder — a tabela já fica
--     pronta para a fase seguinte.
--  E) Permissões: menu/rota.vt (true: gestor, mesa, dp1, dp2, financeiro) e
--     ações vt.gerenciar (true: gestor, mesa, dp1, dp2) e vt.visualizar
--     (true: + financeiro). admin/adm sem linha (bypass total), mesmo padrão
--     das seeds da migration 129.
--  F) reset_permissoes_perfil recriada: VERBATIM da 129 + linhas vt com os
--     mesmos valores das seeds, para o "Restaurar padrão" não revogar o acesso.
--     Também corrige a regressão da cadeia 115→129, que reverteu a decisão da
--     migration 111 (menu.bi/rota.bi = true para rh, dp1, dp2 e financeiro) no
--     Restaurar padrão — os 4 perfis voltam a ter bi = true nesta recriação.
--
-- GRANT explícito em toda tabela nova (AGENTS.md §8 — mudança do Supabase de
-- 30/10/2026); RLS padrão do projeto: SELECT autenticado, INSERT/UPDATE
-- is_editor(), DELETE is_admin(). Nada para anon.

begin;

-- ============================================================
-- A) Cadastro do VT no colaborador
-- ============================================================
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_optante boolean NOT NULL DEFAULT false;
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_tipo_cartao text;
ALTER TABLE public.colaboradores
  DROP CONSTRAINT IF EXISTS colaboradores_vt_tipo_cartao_check;
ALTER TABLE public.colaboradores
  ADD CONSTRAINT colaboradores_vt_tipo_cartao_check
  CHECK (vt_tipo_cartao IS NULL OR vt_tipo_cartao IN ('bun', 'bui', 'comum'));

-- ============================================================
-- B) Combinações nomeadas com valor diário fechado (ida+volta)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vt_combinacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor_diario_centavos integer NOT NULL CHECK (valor_diario_centavos >= 0),
  vigente_desde date NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vt_combinacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vt_combinacoes_select" ON public.vt_combinacoes;
DROP POLICY IF EXISTS "vt_combinacoes_insert" ON public.vt_combinacoes;
DROP POLICY IF EXISTS "vt_combinacoes_update" ON public.vt_combinacoes;
DROP POLICY IF EXISTS "vt_combinacoes_delete" ON public.vt_combinacoes;
CREATE POLICY "vt_combinacoes_select" ON public.vt_combinacoes FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "vt_combinacoes_insert" ON public.vt_combinacoes FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_combinacoes_update" ON public.vt_combinacoes FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_combinacoes_delete" ON public.vt_combinacoes FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_combinacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_combinacoes TO service_role;

-- Seeds (9 combinações reais confirmadas pela gestora em 21/10/2026 — plano
-- §2d). Idempotente: não reinsere se já existe combinação com mesmo nome e
-- vigência.
INSERT INTO public.vt_combinacoes (nome, valor_diario_centavos, vigente_desde)
SELECT s.nome, s.valor_diario_centavos, s.vigente_desde
  FROM (VALUES
    ('CENTRO RJ', 1000, '2026-10-21'::date),
    ('BU NITERÓI', 1120, '2026-10-21'::date),
    ('CARTÃO JAE RJ', 1400, '2026-10-21'::date),
    ('PASSAGEM SÃO GONÇALO', 1420, '2026-10-21'::date),
    ('TREM', 1580, '2026-10-21'::date),
    ('ÔNIBUS E VLT - INTEGRAÇÃO RJ', 1600, '2026-10-21'::date),
    ('BILHETE ÚNICO INTERMUNICIPAL', 1880, '2026-10-21'::date),
    ('ÔNIBUS, TREM E METRÔ', 2880, '2026-10-21'::date),
    ('SEM INTEGRAÇÃO BU', 3200, '2026-10-21'::date)
  ) AS s(nome, valor_diario_centavos, vigente_desde)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.vt_combinacoes c
    WHERE c.nome = s.nome AND c.vigente_desde = s.vigente_desde
 );

-- ============================================================
-- C) Trajetos casa → posto (um por par colaborador × departamento)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vt_trajetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  combinacao_id uuid NOT NULL REFERENCES public.vt_combinacoes(id),
  combinacao_2_id uuid REFERENCES public.vt_combinacoes(id),
  escopo text NOT NULL CHECK (escopo IN ('niteroi_municipal', 'intermunicipal', 'municipal_outra')),
  precisao_origem text NOT NULL DEFAULT 'bairro' CHECK (precisao_origem IN ('exato', 'bairro')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'link_confirmado')),
  status text NOT NULL DEFAULT 'sugerido' CHECK (status IN ('sugerido', 'confirmado')),
  observacao text,
  confirmado_por uuid,
  confirmado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, departamento_id),
  CONSTRAINT vt_trajetos_combinacoes_distintas_ck
    CHECK (combinacao_2_id IS NULL OR combinacao_2_id <> combinacao_id)
);

DROP TRIGGER IF EXISTS trg_vt_trajetos_updated_at ON public.vt_trajetos;
CREATE TRIGGER trg_vt_trajetos_updated_at BEFORE UPDATE ON public.vt_trajetos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

ALTER TABLE public.vt_trajetos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vt_trajetos_select" ON public.vt_trajetos;
DROP POLICY IF EXISTS "vt_trajetos_insert" ON public.vt_trajetos;
DROP POLICY IF EXISTS "vt_trajetos_update" ON public.vt_trajetos;
DROP POLICY IF EXISTS "vt_trajetos_delete" ON public.vt_trajetos;
CREATE POLICY "vt_trajetos_select" ON public.vt_trajetos FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "vt_trajetos_insert" ON public.vt_trajetos FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_trajetos_update" ON public.vt_trajetos FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_trajetos_delete" ON public.vt_trajetos FOR DELETE TO authenticated
  USING ((SELECT public.is_editor()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_trajetos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_trajetos TO service_role;

-- ============================================================
-- D) Cache de geocodificação (uso futuro — a Fase 1 não chama geocoder)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vt_geocode_cache (
  chave text PRIMARY KEY,
  lat double precision,
  lng double precision,
  precisao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vt_geocode_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vt_geocode_cache_select" ON public.vt_geocode_cache;
DROP POLICY IF EXISTS "vt_geocode_cache_insert" ON public.vt_geocode_cache;
DROP POLICY IF EXISTS "vt_geocode_cache_update" ON public.vt_geocode_cache;
DROP POLICY IF EXISTS "vt_geocode_cache_delete" ON public.vt_geocode_cache;
CREATE POLICY "vt_geocode_cache_select" ON public.vt_geocode_cache FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "vt_geocode_cache_insert" ON public.vt_geocode_cache FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_geocode_cache_update" ON public.vt_geocode_cache FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_geocode_cache_delete" ON public.vt_geocode_cache FOR DELETE TO authenticated
  USING ((SELECT public.is_admin()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_geocode_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_geocode_cache TO service_role;

-- ============================================================
-- E) Permissões do módulo (mesmo padrão das seeds da 129; admin/adm sem
--    linha — bypass total). A tabela tem UNIQUE(perfil, recurso, acao)
--    (migration 046).
-- ============================================================
INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
  ('gestor', 'menu', 'vt', true),
  ('gestor', 'rota', 'vt', true),
  ('gestor', 'vt', 'gerenciar', true),
  ('gestor', 'vt', 'visualizar', true),
  ('mesa', 'menu', 'vt', true),
  ('mesa', 'rota', 'vt', true),
  ('mesa', 'vt', 'gerenciar', true),
  ('mesa', 'vt', 'visualizar', true),
  ('dp1', 'menu', 'vt', true),
  ('dp1', 'rota', 'vt', true),
  ('dp1', 'vt', 'gerenciar', true),
  ('dp1', 'vt', 'visualizar', true),
  ('dp2', 'menu', 'vt', true),
  ('dp2', 'rota', 'vt', true),
  ('dp2', 'vt', 'gerenciar', true),
  ('dp2', 'vt', 'visualizar', true),
  ('financeiro', 'menu', 'vt', true),
  ('financeiro', 'rota', 'vt', true),
  ('financeiro', 'vt', 'gerenciar', false),
  ('financeiro', 'vt', 'visualizar', true),
  ('rh', 'menu', 'vt', false),
  ('rh', 'rota', 'vt', false),
  ('rh', 'vt', 'gerenciar', false),
  ('rh', 'vt', 'visualizar', false),
  ('inspetoria', 'menu', 'vt', false),
  ('inspetoria', 'rota', 'vt', false),
  ('inspetoria', 'vt', 'gerenciar', false),
  ('inspetoria', 'vt', 'visualizar', false),
  ('visualizador', 'menu', 'vt', false),
  ('visualizador', 'rota', 'vt', false),
  ('visualizador', 'vt', 'gerenciar', false),
  ('visualizador', 'vt', 'visualizar', false),
  ('dp3', 'menu', 'vt', false),
  ('dp3', 'rota', 'vt', false),
  ('dp3', 'vt', 'gerenciar', false),
  ('dp3', 'vt', 'visualizar', false)
ON CONFLICT (perfil, recurso, acao) DO NOTHING;

-- ============================================================
-- F) reset_permissoes_perfil: VERBATIM da migration 129 + linhas vt
--    (mesmos valores das seeds do bloco E), para o "Restaurar padrão" da tela
--    Permissões não revogar o acesso ao módulo.
-- ============================================================
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
      ('visualizador', 'escala', 'visualizar', true),
      ('visualizador', 'menu', 'bi', false),
      ('visualizador', 'rota', 'bi', false),
      ('visualizador', 'ocorrencia', 'validar', false),
      ('visualizador', 'menu', 'materiais', false),
      ('visualizador', 'rota', 'materiais', false),
      ('visualizador', 'menu', 'materiais_fornecedores', false),
      ('visualizador', 'rota', 'materiais_fornecedores', false),
      ('visualizador', 'menu', 'materiais_kit', false),
      ('visualizador', 'rota', 'materiais_kit', false),
      ('visualizador', 'materiais', 'editar_kit_uniforme', false),
      ('visualizador', 'menu', 'vt', false),
      ('visualizador', 'rota', 'vt', false),
      ('visualizador', 'vt', 'gerenciar', false),
      ('visualizador', 'vt', 'visualizar', false);
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
      ('gestor', 'escala', 'editar_dia', true),
      ('gestor', 'menu', 'bi', true),
      ('gestor', 'rota', 'bi', true),
      ('gestor', 'ocorrencia', 'validar', false),
      ('gestor', 'materiais', 'editar_catalogo', true),
      ('gestor', 'materiais', 'gerenciar_fornecedores', true),
      ('gestor', 'materiais', 'editar_kit', true),
      ('gestor', 'materiais', 'editar_rota', true),
      ('gestor', 'materiais', 'alterar_rota_pedido', true),
      ('gestor', 'materiais', 'decidir_alteracao_kit', true),
      ('gestor', 'materiais', 'gerenciar_links', true),
      ('gestor', 'materiais', 'ver_sem_pedido', true),
      ('gestor', 'materiais', 'preencher_pelo_kit', true),
      ('gestor', 'materiais', 'validar', true),
      ('gestor', 'materiais', 'aprovar', true),
      ('gestor', 'materiais', 'reabrir_pedido', true),
      ('gestor', 'ceu', 'conferir_pedido', true),
      ('gestor', 'ceu', 'atender_pedido', true),
      ('gestor', 'menu', 'materiais', true),
      ('gestor', 'rota', 'materiais', true),
      ('gestor', 'menu', 'materiais_fornecedores', true),
      ('gestor', 'rota', 'materiais_fornecedores', true),
      ('gestor', 'menu', 'materiais_kit', true),
      ('gestor', 'rota', 'materiais_kit', true),
      ('gestor', 'materiais', 'editar_kit_uniforme', true),
      ('gestor', 'menu', 'vt', true),
      ('gestor', 'rota', 'vt', true),
      ('gestor', 'vt', 'gerenciar', true),
      ('gestor', 'vt', 'visualizar', true);
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
      ('rh', 'escala', 'editar_dia', true),
      ('rh', 'menu', 'bi', true),
      ('rh', 'rota', 'bi', true),
      ('rh', 'ocorrencia', 'validar', false),
      ('rh', 'menu', 'materiais', false),
      ('rh', 'rota', 'materiais', false),
      ('rh', 'menu', 'materiais_fornecedores', false),
      ('rh', 'rota', 'materiais_fornecedores', false),
      ('rh', 'menu', 'materiais_kit', false),
      ('rh', 'rota', 'materiais_kit', false),
      ('rh', 'materiais', 'editar_kit_uniforme', false),
      ('rh', 'menu', 'vt', false),
      ('rh', 'rota', 'vt', false),
      ('rh', 'vt', 'gerenciar', false),
      ('rh', 'vt', 'visualizar', false);
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
      ('dp1', 'escala', 'editar_dia', true),
      ('dp1', 'menu', 'bi', true),
      ('dp1', 'rota', 'bi', true),
      ('dp1', 'ocorrencia', 'validar', true),
      ('dp1', 'menu', 'materiais', false),
      ('dp1', 'rota', 'materiais', false),
      ('dp1', 'menu', 'materiais_fornecedores', false),
      ('dp1', 'rota', 'materiais_fornecedores', false),
      ('dp1', 'menu', 'materiais_kit', false),
      ('dp1', 'rota', 'materiais_kit', false),
      ('dp1', 'materiais', 'editar_kit_uniforme', false),
      ('dp1', 'menu', 'vt', true),
      ('dp1', 'rota', 'vt', true),
      ('dp1', 'vt', 'gerenciar', true),
      ('dp1', 'vt', 'visualizar', true);
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
      ('dp2', 'escala', 'editar_dia', true),
      ('dp2', 'menu', 'bi', true),
      ('dp2', 'rota', 'bi', true),
      ('dp2', 'ocorrencia', 'validar', true),
      ('dp2', 'ceu', 'emitir_cracha', true),
      ('dp2', 'ceu', 'atender_pedido', true),
      ('dp2', 'menu', 'materiais', false),
      ('dp2', 'rota', 'materiais', false),
      ('dp2', 'materiais', 'gerenciar_fornecedores', true),
      ('dp2', 'menu', 'materiais_fornecedores', true),
      ('dp2', 'rota', 'materiais_fornecedores', true),
      ('dp2', 'menu', 'materiais_kit', true),
      ('dp2', 'rota', 'materiais_kit', true),
      ('dp2', 'materiais', 'editar_kit_uniforme', true),
      ('dp2', 'menu', 'vt', true),
      ('dp2', 'rota', 'vt', true),
      ('dp2', 'vt', 'gerenciar', true),
      ('dp2', 'vt', 'visualizar', true);
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
      ('mesa', 'escala', 'editar_dia', true),
      ('mesa', 'menu', 'bi', true),
      ('mesa', 'rota', 'bi', true),
      ('mesa', 'ocorrencia', 'validar', false),
      ('mesa', 'ceu', 'emitir_cracha', true),
      ('mesa', 'materiais', 'editar_rota', true),
      ('mesa', 'materiais', 'gerenciar_fornecedores', true),
      ('mesa', 'materiais', 'alterar_rota_pedido', true),
      ('mesa', 'materiais', 'solicitar_alteracao_kit', true),
      ('mesa', 'materiais', 'ver_sem_pedido', true),
      ('mesa', 'materiais', 'pedido_extra', true),
      ('mesa', 'materiais', 'reabrir_pedido', true),
      ('mesa', 'menu', 'materiais', true),
      ('mesa', 'rota', 'materiais', true),
      ('mesa', 'menu', 'materiais_fornecedores', true),
      ('mesa', 'rota', 'materiais_fornecedores', true),
      ('mesa', 'menu', 'materiais_kit', true),
      ('mesa', 'rota', 'materiais_kit', true),
      ('mesa', 'materiais', 'editar_kit_uniforme', false),
      ('mesa', 'menu', 'vt', true),
      ('mesa', 'rota', 'vt', true),
      ('mesa', 'vt', 'gerenciar', true),
      ('mesa', 'vt', 'visualizar', true);
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
      ('inspetoria', 'escala', 'visualizar', true),
      ('inspetoria', 'menu', 'bi', true),
      ('inspetoria', 'rota', 'bi', true),
      ('inspetoria', 'ocorrencia', 'validar', false),
      ('inspetoria', 'materiais', 'solicitar_alteracao_kit', true),
      ('inspetoria', 'materiais', 'ver_sem_pedido', true),
      ('inspetoria', 'materiais', 'preencher_pelo_kit', true),
      ('inspetoria', 'materiais', 'validar', true),
      ('inspetoria', 'materiais', 'pedido_extra', true),
      ('inspetoria', 'ceu', 'conferir_pedido', true),
      ('inspetoria', 'menu', 'materiais', true),
      ('inspetoria', 'rota', 'materiais', true),
      ('inspetoria', 'menu', 'materiais_fornecedores', true),
      ('inspetoria', 'rota', 'materiais_fornecedores', true),
      ('inspetoria', 'menu', 'materiais_kit', true),
      ('inspetoria', 'rota', 'materiais_kit', true),
      ('inspetoria', 'materiais', 'editar_kit_uniforme', false),
      ('inspetoria', 'menu', 'vt', false),
      ('inspetoria', 'rota', 'vt', false),
      ('inspetoria', 'vt', 'gerenciar', false),
      ('inspetoria', 'vt', 'visualizar', false);
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
      ('financeiro', 'escala', 'visualizar', true),
      ('financeiro', 'menu', 'bi', true),
      ('financeiro', 'rota', 'bi', true),
      ('financeiro', 'ocorrencia', 'validar', false),
      ('financeiro', 'menu', 'materiais', false),
      ('financeiro', 'rota', 'materiais', false),
      ('financeiro', 'materiais', 'gerenciar_fornecedores', true),
      ('financeiro', 'menu', 'materiais_fornecedores', true),
      ('financeiro', 'rota', 'materiais_fornecedores', true),
      ('financeiro', 'menu', 'materiais_kit', false),
      ('financeiro', 'rota', 'materiais_kit', false),
      ('financeiro', 'materiais', 'editar_kit_uniforme', false),
      ('financeiro', 'menu', 'vt', true),
      ('financeiro', 'rota', 'vt', true),
      ('financeiro', 'vt', 'gerenciar', false),
      ('financeiro', 'vt', 'visualizar', true);
    RETURN;
  END IF;

  -- ============================================================
  -- DP3 (estagiária — SÓ emite crachás; ver migration 117)
  -- ============================================================
  IF p_perfil = 'dp3' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('dp3', 'ceu', 'emitir_cracha', true),
      ('dp3', 'menu', 'crachas', true),
      ('dp3', 'menu', 'dashboard', false),
      ('dp3', 'menu', 'materiais', false),
      ('dp3', 'rota', 'materiais', false),
      ('dp3', 'menu', 'materiais_fornecedores', false),
      ('dp3', 'rota', 'materiais_fornecedores', false),
      ('dp3', 'menu', 'materiais_kit', false),
      ('dp3', 'rota', 'materiais_kit', false),
      ('dp3', 'materiais', 'editar_kit_uniforme', false),
      ('dp3', 'menu', 'vt', false),
      ('dp3', 'rota', 'vt', false),
      ('dp3', 'vt', 'gerenciar', false),
      ('dp3', 'vt', 'visualizar', false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Perfil desconhecido: %', p_perfil;
END;
$$;

commit;
