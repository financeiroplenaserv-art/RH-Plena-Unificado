-- 162_vt_fechamentos_credito.sql
-- Módulo VT (Vale-Transporte) — Fase 2b, fechamento com CRÉDITO (decisão da
-- gestora, 23/10/2026 — "nem a mais, nem a menos"). A simulação com dados
-- reais de outubro/2026 mostrou que o fechamento (migration 161) só
-- descontava. Agora o dia que o espelho de ponto classifica como TRABALHADO e
-- que não estava planejado em nenhum posto da carga (ex.: troca de plantão —
-- folga na escala, trabalhou no ponto) é CREDITADO na carga seguinte, ao
-- custo/dia do posto de referência (o posto com mais dias planejados no mês;
-- empate → o primeiro do detalhe). Sem nenhum dia planejado não há posto de
-- referência: o dia NÃO é creditado por palpite — conta em
-- dias_fora_sem_posto para o RH conferir.
--
-- Ajuste da carga seguinte (vt_cargas.ajuste_centavos) = credito − desconto
-- (pode ser positivo); valor = max(0, necessidade + ajuste). A sobra de
-- desconto acima da carga NÃO vira saldo (decisão da gestora).
--
-- Sem tabela nova — sem GRANT (os da 161 valem para as colunas novas).
-- Tabela vazia na data (backup trivial em
-- dados-locais/backup_vt_fechamentos_162_2026-10-23.json).
-- Aplicada via Management API em 23/10/2026.

begin;

ALTER TABLE public.vt_fechamentos
  ADD COLUMN IF NOT EXISTS credito_centavos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_creditados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_fora_sem_posto integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vt_fechamentos_credito_ck') THEN
    ALTER TABLE public.vt_fechamentos
      ADD CONSTRAINT vt_fechamentos_credito_ck
      CHECK (credito_centavos >= 0 AND dias_creditados >= 0 AND dias_fora_sem_posto >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.vt_fechamentos.credito_centavos IS
  'Soma do custo/dia dos dias trabalhados no ponto fora da carga (positivo; ajuste da carga seguinte = credito - desconto).';
COMMENT ON COLUMN public.vt_fechamentos.dias_creditados IS
  'Dias trabalhados no ponto que não estavam planejados na carga, creditados no posto de referência.';
COMMENT ON COLUMN public.vt_fechamentos.dias_fora_sem_posto IS
  'Dias trabalhados fora da carga SEM posto de referência (nenhum dia planejado) — não creditados, conferir.';

commit;
