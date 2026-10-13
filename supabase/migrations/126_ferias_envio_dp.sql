-- Migration 126: Férias — rastreio do envio do agendamento ao DP (e-Contador)
-- Decisão da gestão em 13/10/2026: ao aprovar as férias, o RH envia o
-- agendamento oficial para a Alterdata (POST /api/v1/agendamentos-ferias via
-- Edge Function econtador), que cai no módulo Agendamento de Férias do
-- e-Contador para o DP processar — sem lançamento manual.
-- Sem tabela nova => sem GRANT. UPDATE coberto por is_editor() (migration 112).

alter table public.ferias_solicitacoes
  add column if not exists enviado_dp_em timestamptz,
  add column if not exists enviado_dp_por uuid references auth.users(id) on delete set null,
  add column if not exists dp_agendamento_id text;

comment on column public.ferias_solicitacoes.enviado_dp_em is
  'Quando o agendamento foi enviado ao DP (e-Contador) — NULL = ainda não enviado';
comment on column public.ferias_solicitacoes.enviado_dp_por is
  'Quem enviou o agendamento ao DP';
comment on column public.ferias_solicitacoes.dp_agendamento_id is
  'ID do agendamento criado na Alterdata (agendamentos-ferias)';
