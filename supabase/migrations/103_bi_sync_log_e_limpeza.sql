-- Migração 103: BI PerformanceLab — log de sincronização e limpeza de dados antigos
--
-- Contexto (20/08/2026): a Edge Function `sync-performancelab` roda 1x ao dia
-- via pg_cron. Se a API do PerformanceLab ficar fora do ar (ou a senha mudar),
-- o cron falhava em silêncio e a aba PerformanceLab mostrava dados velhos sem
-- aviso. Esta migration cria:
--
-- 1. `bi_sync_log` — um registro por execução do sync (sucesso ou erro), lido
--    pela página para mostrar "Atualizado em ..." e alertar quando o sync está
--    atrasado (> 26h sem sucesso) ou falhou.
-- 2. `bi_limpar_dados_antigos()` — limpeza chamada pela Edge Function ao fim
--    do sync: o sync só atualiza os últimos 35 dias, então registros mais
--    velhos se acumulavam para sempre. Retém 90 dias de histórico.
--
-- RLS: leitura do log segue `pode_ver_bi_performancelab()` (migration 102);
-- escrita só via service_role (a Edge Function bypassa RLS — sem policies de
-- INSERT/UPDATE/DELETE para autenticados).

-- ============================================================
-- Tabela de log de sincronização
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bi_sync_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  executado_em timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  locais int, checklists int, coletas int, eventos int, analises int,
  erro text
);

ALTER TABLE public.bi_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bi_sync_log_select" ON public.bi_sync_log
  FOR SELECT TO authenticated USING (public.pode_ver_bi_performancelab());

-- ============================================================
-- Limpeza de dados antigos (retém 90 dias; o sync cobre 35)
-- ============================================================

CREATE OR REPLACE FUNCTION public.bi_limpar_dados_antigos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limite timestamptz := now() - interval '90 days';
  n_ck int; n_qa int; n_co int; n_ev int; n_an int; n_log int;
BEGIN
  DELETE FROM bi_checklists WHERE COALESCE(data_inicio, data_planejada) < limite;
  GET DIAGNOSTICS n_ck = ROW_COUNT;
  -- QAs órfãos (o id do QA é o mesmo do checklist respondido)
  DELETE FROM bi_checklist_qas WHERE id NOT IN (SELECT id FROM bi_checklists);
  GET DIAGNOSTICS n_qa = ROW_COUNT;
  DELETE FROM bi_coletas WHERE data_local < limite;
  GET DIAGNOSTICS n_co = ROW_COUNT;
  DELETE FROM bi_eventos WHERE data_evento < limite;
  GET DIAGNOSTICS n_ev = ROW_COUNT;
  DELETE FROM bi_eventos_analises WHERE data_analise < limite;
  GET DIAGNOSTICS n_an = ROW_COUNT;
  DELETE FROM bi_sync_log WHERE executado_em < limite;
  GET DIAGNOSTICS n_log = ROW_COUNT;
  RETURN jsonb_build_object(
    'checklists', n_ck, 'qas', n_qa, 'coletas', n_co,
    'eventos', n_ev, 'analises', n_an, 'log', n_log
  );
END;
$$;

-- Só a Edge Function (service_role) pode chamar; autenticados não.
REVOKE ALL ON FUNCTION public.bi_limpar_dados_antigos() FROM PUBLIC, authenticated;
