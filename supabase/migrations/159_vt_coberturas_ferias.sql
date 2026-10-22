-- 159_vt_coberturas_ferias.sql
-- Módulo VT (Vale-Transporte) — carga dirigida pelas férias do mês (decisão da
-- gestora, 21/10/2026 — docs/PLANO_MODULO_VT.md §6): a fonte oficial da carga
-- é o relatório "Gestão de escalas" do Flit (Excel, gerado ~dia 25 com o mês
-- seguinte); os blocos [FR] do relatório são as férias do mês. Para cada uma
-- o RH dá um DESTINO: quem cobre (ferista) ou a declaração "sem cobertura".
-- Enquanto houver férias sem destino, a gravação da carga fica bloqueada
-- (portão na tela). O titular tem os dias de gozo fora da carga porque o
-- relatório os marca [FR] (não trabalhou → não recebe — nunca entram).
-- NÃO aplicada — a gestora aplica via Management API (script de ARQUIVO, nunca
-- inline — regra da migration 131).
--
--  A) vt_coberturas.ferias_colaborador_id: de quem são as férias cobertas
--     (NULL = cobertura avulsa registrada pela tela, ex.: transferência).
--  B) colaborador_id (o ferista) passa a aceitar NULL: ferista NULL + férias
--     preenchida = declaração "sem cobertura". CHECK: pelo menos um dos dois.
--  C) UNIQUE parcial (ferias_colaborador_id, data_inicio): não duplicar
--     destino da mesma férias.
--
-- Sem tabela nova — sem GRANT de tabela. Sem seeds de permissão. Idempotente.

begin;

ALTER TABLE public.vt_coberturas
  ADD COLUMN IF NOT EXISTS ferias_colaborador_id uuid REFERENCES public.colaboradores(id);

ALTER TABLE public.vt_coberturas
  ALTER COLUMN colaborador_id DROP NOT NULL;

ALTER TABLE public.vt_coberturas
  DROP CONSTRAINT IF EXISTS vt_coberturas_algum_vinculo_ck;
ALTER TABLE public.vt_coberturas
  ADD CONSTRAINT vt_coberturas_algum_vinculo_ck
  CHECK (colaborador_id IS NOT NULL OR ferias_colaborador_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS vt_coberturas_ferias_dia_uidx
  ON public.vt_coberturas (ferias_colaborador_id, data_inicio)
  WHERE ferias_colaborador_id IS NOT NULL;

commit;
