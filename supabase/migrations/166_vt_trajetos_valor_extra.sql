-- 166_vt_trajetos_valor_extra.sql
-- Decisão da gestora em 27/10/2026: o trajeto pode ter um VALOR EXTRA MANUAL
-- por dia (caso real: valor a mais para uma colaboradora específica, dado
-- manualmente). O custo do dia passa a ser bilhete 1 + bilhete 2 + extra; o
-- extra entra na carga e no fechamento pelo custo do dia, sem nenhuma regra
-- nova de cálculo.
--
-- **Preparada, NÃO aplicada** — a gestora aplica via Management API (script
-- de ARQUIVO, nunca inline — regra da migration 131: SQL com acento só via
-- arquivo UTF-8). **Aplicar ANTES do deploy do frontend desta mudança** — a
-- aba Trajetos passa a gravar a coluna nova.
--
--  A) vt_trajetos ganha valor_extra_centavos (integer, padrão 0 = nada muda),
--     com teto de sanidade de R$ 1.000,00/dia (100000 centavos) — valor acima
--     disso é erro de digitação, não tarifa.
--
-- Sem tabela nova — sem GRANT. Idempotente: coluna com IF NOT EXISTS,
-- constraint com DROP IF EXISTS + ADD (rodar 2× é no-op).

begin;

ALTER TABLE public.vt_trajetos
  ADD COLUMN IF NOT EXISTS valor_extra_centavos integer NOT NULL DEFAULT 0;
ALTER TABLE public.vt_trajetos
  DROP CONSTRAINT IF EXISTS vt_trajetos_valor_extra_ck;
ALTER TABLE public.vt_trajetos
  ADD CONSTRAINT vt_trajetos_valor_extra_ck
  CHECK (valor_extra_centavos >= 0 AND valor_extra_centavos <= 100000);

commit;
