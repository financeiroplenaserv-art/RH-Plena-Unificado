-- 074_extras_falta_sem_extra_reforco.sql
-- Extras: faltas de controle interno (sem pagamento) + marcação de Reforço Contratual.
--
-- Contexto: a mesma aba de Extras passa a registrar faltas que NÃO geram
-- pagamento (controle interno). Elas aparecem no relatório diário de
-- WhatsApp, mas não entram no balanço/recibos de pagamento.
--
--   1. extras.gera_extra (default true) — false = falta de controle interno;
--      excluída do agrupamento de recibos/pagamento.
--   2. extras.reforco_contratual (default false) — marcador exibido no
--      relatório diário de WhatsApp com emoji próprio (🪙).
--
-- Nenhuma policy é alterada; registros existentes ficam com gera_extra=true.

alter table public.extras
  add column if not exists gera_extra boolean not null default true,
  add column if not exists reforco_contratual boolean not null default false;
