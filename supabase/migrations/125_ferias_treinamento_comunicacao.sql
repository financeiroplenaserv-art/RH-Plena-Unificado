-- Migration 125: Férias — treinamento do ferista e checklist de comunicação
-- Decisão da gestão em 13/10/2026, espelhando a planilha "Planejamento Operacional":
-- * Treinamento é por ALOCAÇÃO (pertence ao ferista escalado): posto novo para o
--   ferista => precisa treinar (padrão operacional: 2 dias, em geral seguidos, com
--   compensação depois); se ele já conhece o posto ou está cobrindo a segunda
--   parcela das mesmas férias => não precisa.
-- * Comunicação é por SOLICITAÇÃO (sobrevive à troca de ferista e existe mesmo
--   quando a vaga fica "SEM COBERTURA"): informativo do RH ao cliente, contato com
--   quem vai tirar férias, contato com o ferista e encarregado/líder do posto.
-- Sem tabela nova => sem GRANT. UPDATE já coberto por is_editor() (migration 112).

-- Treinamento (por alocação)
alter table public.ferias_alocacoes
  add column if not exists precisa_treinamento boolean,
  add column if not exists treinamento_detalhe text;

comment on column public.ferias_alocacoes.precisa_treinamento is
  'true = ferista precisa treinar no posto (padrão: 2 dias, compensados depois); false = já conhece o posto / segunda parcela; NULL = não avaliado';
comment on column public.ferias_alocacoes.treinamento_detalhe is
  'Dias e horário do treinamento, texto livre (ex.: "Treina 22 e 23/09 das 07h às 16h")';

-- Checklist de comunicação (por solicitação de férias)
alter table public.ferias_solicitacoes
  add column if not exists informativo_cliente_em date,
  add column if not exists contato_titular_por text,
  add column if not exists contato_titular_em date,
  add column if not exists contato_ferista_por text,
  add column if not exists contato_ferista_em date,
  add column if not exists encarregado_lider text;

comment on column public.ferias_solicitacoes.informativo_cliente_em is
  'Data em que o RH informou o cliente sobre a troca (informativo de férias)';
comment on column public.ferias_solicitacoes.contato_titular_por is
  'Quem do RH/operação falou com o colaborador que vai tirar férias';
comment on column public.ferias_solicitacoes.contato_titular_em is
  'Data do contato com o colaborador que vai tirar férias';
comment on column public.ferias_solicitacoes.contato_ferista_por is
  'Quem do RH/operação falou com o ferista que vai cobrir';
comment on column public.ferias_solicitacoes.contato_ferista_em is
  'Data do contato com o ferista que vai cobrir';
comment on column public.ferias_solicitacoes.encarregado_lider is
  'Encarregado ou líder do posto (referência operacional da cobertura)';
