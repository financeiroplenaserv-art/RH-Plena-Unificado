-- 160_vt_coberturas_treinamento.sql
-- Módulo VT (Vale-Transporte) — treinamento com VT (decisão da gestora,
-- 22/10/2026): quando um colaborador vai cobrir férias e precisa TREINAR no
-- posto antes (padrão operacional: 2 dias), esses dias de treinamento também
-- geram VT. O mesmo vale para o admitido que treina em posto novo. Os dias de
-- treinamento são registrados como linhas de vt_coberturas com tipo
-- 'treinamento': na carga do mês eles sintetizam dias de trabalho no posto
-- (mesma regra da cobertura de férias — inclusive em folga do relatório, nunca
-- sobre [FR]/[AF]/[AT]) e recebem o custo/dia do trajeto daquele posto.
-- Treinamento NÃO é destino de férias (o portão de gravação continua exigindo
-- uma linha tipo 'ferias' ou a declaração "sem cobertura").
-- NÃO aplicada — a gestora aplica via Management API (script de ARQUIVO, nunca
-- inline — regra da migration 131).
--
--  A) vt_coberturas.tipo: 'ferias' (cobertura de férias, padrão — linhas
--     existentes) ou 'treinamento' (dias de treinamento com VT).
--  B) UNIQUE parcial recriada com tipo: (ferias_colaborador_id, data_inicio,
--     tipo) — permite a cobertura e o treinamento da mesma férias começarem
--     no mesmo dia sem conflitar.
--
-- Sem tabela nova — sem GRANT de tabela. Sem seeds de permissão. Idempotente.

begin;

ALTER TABLE public.vt_coberturas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'ferias';

ALTER TABLE public.vt_coberturas
  DROP CONSTRAINT IF EXISTS vt_coberturas_tipo_ck;
ALTER TABLE public.vt_coberturas
  ADD CONSTRAINT vt_coberturas_tipo_ck CHECK (tipo IN ('ferias', 'treinamento'));

DROP INDEX IF EXISTS public.vt_coberturas_ferias_dia_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS vt_coberturas_ferias_dia_tipo_uidx
  ON public.vt_coberturas (ferias_colaborador_id, data_inicio, tipo)
  WHERE ferias_colaborador_id IS NOT NULL;

comment on column public.vt_coberturas.tipo is
  'ferias = cobertura de férias (destino da férias); treinamento = dias de treinamento com VT (ferista antes de cobrir, ou admitido em posto novo) — não é destino de férias.';

commit;
