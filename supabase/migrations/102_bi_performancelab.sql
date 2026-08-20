-- Migração 102: BI PerformanceLab
--
-- Novo módulo "PerformanceLab" (grupo Operacional): dashboard com dados da API
-- pública do PerformanceLab (checklists, visitas dos inspetores e eventos),
-- sincronizado 1x ao dia pela Edge Function `sync-performancelab`.
--
-- Decisões (19/08/2026):
-- - RLS restrita: leitura apenas para admin/adm/gestor/inspetoria/mesa
--   (função pode_ver_bi_performancelab). Nada de policy aberta `using (true)`.
-- - Escrita somente via service_role (Edge Function) — sem policies de
--   INSERT/UPDATE/DELETE para autenticados.
-- - Permissões de menu/rota seguem o padrão da migration 047.

-- ============================================================
-- Função de acesso
-- ============================================================

CREATE OR REPLACE FUNCTION public.pode_ver_bi_performancelab()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'inspetoria', 'mesa')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_ver_bi_performancelab() TO authenticated;

-- ============================================================
-- Tabelas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bi_locais (
  id bigint PRIMARY KEY,
  nome text, sigla text, cidade text, uf text, regional text,
  grupos_nomes text, status int, data_criacao timestamptz
);

CREATE TABLE IF NOT EXISTS public.bi_checklists (
  id bigint PRIMARY KEY,
  numero int, ano int, checklist_id bigint, checklist_nome text,
  local_id bigint, site_nome text, responsavel_id bigint, responsavel_nome text,
  data_planejada timestamptz, data_inicio timestamptz, data_termino timestamptz,
  conclusao_nome text, url text
);

CREATE TABLE IF NOT EXISTS public.bi_checklist_qas (
  id bigint PRIMARY KEY,           -- mesmo id do checklist respondido
  qas jsonb                        -- {id_pergunta: {grupo_perguntas, pergunta, respostas, observacoes}}
);

CREATE TABLE IF NOT EXISTS public.bi_coletas (
  id bigint PRIMARY KEY,
  local_id bigint, funcionario text, usuario_id bigint,
  data_local timestamptz, data_termino timestamptz,
  area text, site_nome text, site_cidade text, site_uf text,
  motivo_visita text, observacao text, tipo_coleta text,
  tempo_minutos int
);

CREATE TABLE IF NOT EXISTS public.bi_eventos (
  id bigint PRIMARY KEY,
  numero int, ano int, local_id bigint, evento_id bigint,
  evento_nome text, subtipo_nome text, site_nome text, site_cidade text, site_uf text,
  usuario_nome text,               -- quem abriu
  usuario_ultimo_nome text,        -- responsável atual (quem está tratando)
  data_evento timestamptz, data_finalizacao timestamptz,
  status_texto text, sla text,     -- SLA oficial do PerformanceLab (DENTRO/FORA)
  observacao text, acoes_realizadas text, acoes_realizadas_finalizacao text
);

CREATE TABLE IF NOT EXISTS public.bi_eventos_analises (
  id bigint PRIMARY KEY,
  evento_id bigint, responsavel_nome text, tipo_analise_nome text,
  descricao text, data_analise timestamptz
);

CREATE INDEX IF NOT EXISTS ix_bi_coletas_data ON public.bi_coletas(data_local);
CREATE INDEX IF NOT EXISTS ix_bi_eventos_data ON public.bi_eventos(data_evento);
CREATE INDEX IF NOT EXISTS ix_bi_checklists_data ON public.bi_checklists(data_inicio);
CREATE INDEX IF NOT EXISTS ix_bi_analises_evento ON public.bi_eventos_analises(evento_id);

-- ============================================================
-- RLS: leitura restrita; escrita só via service_role
-- ============================================================

ALTER TABLE public.bi_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_checklist_qas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_coletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bi_eventos_analises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_locais_select" ON public.bi_locais
  FOR SELECT TO authenticated USING (public.pode_ver_bi_performancelab());
CREATE POLICY "bi_checklists_select" ON public.bi_checklists
  FOR SELECT TO authenticated USING (public.pode_ver_bi_performancelab());
CREATE POLICY "bi_checklist_qas_select" ON public.bi_checklist_qas
  FOR SELECT TO authenticated USING (public.pode_ver_bi_performancelab());
CREATE POLICY "bi_coletas_select" ON public.bi_coletas
  FOR SELECT TO authenticated USING (public.pode_ver_bi_performancelab());
CREATE POLICY "bi_eventos_select" ON public.bi_eventos
  FOR SELECT TO authenticated USING (public.pode_ver_bi_performancelab());
CREATE POLICY "bi_eventos_analises_select" ON public.bi_eventos_analises
  FOR SELECT TO authenticated USING (public.pode_ver_bi_performancelab());

-- ============================================================
-- Permissões de menu/rota (padrão da migration 047)
-- ============================================================

INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
('gestor', 'menu', 'bi', true),
('inspetoria', 'menu', 'bi', true),
('mesa', 'menu', 'bi', true),
('rh', 'menu', 'bi', false),
('dp1', 'menu', 'bi', false),
('dp2', 'menu', 'bi', false),
('financeiro', 'menu', 'bi', false),
('visualizador', 'menu', 'bi', false),
('gestor', 'rota', 'bi', true),
('inspetoria', 'rota', 'bi', true),
('mesa', 'rota', 'bi', true),
('rh', 'rota', 'bi', false),
('dp1', 'rota', 'bi', false),
('dp2', 'rota', 'bi', false),
('financeiro', 'rota', 'bi', false),
('visualizador', 'rota', 'bi', false)
ON CONFLICT DO NOTHING;
