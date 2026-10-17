-- ============================================================
-- 142 — CEU: itens sem o aviso "antes do prazo" (troca mensal)
-- ============================================================
-- Decisão da gestora (17/10/2026): luva látex é entregue praticamente todo
-- mês, então o selo "antes do prazo" da fila CEU → Pedidos vira ruído. A data
-- da última entrega continua aparecendo; só o selo some.
--
-- itens.sem_alerta_prazo (boolean, default false): marcação de DADO, editável
-- em CEU → Itens. `prazo_uso_dias` NÃO foi zerado: ele alimenta a validade
-- mostrada nas entregas, os snapshots e os relatórios do CEU.
--
-- Marcados (itens ATIVOS de LUVA LÁTEX, todos os tamanhos):
--   LUVA LÁTEX EG - Tam. EG   32960193-784f-43a2-81aa-ce31a631edb2
--   LUVA LÁTEX G - Tam. G     bd715ee1-50fb-478b-8262-41bfc4b5ead6
--   LUVA LÁTEX M - Tam. M     e195d9fc-e0da-4c78-9037-e1d4eb44c42a
--   LUVA LÁTEX P - Tam. P     cb86ed83-9a34-4256-b5b1-6136e88a2d5a
--   LUVA LÁTEX VERDE          a532f3fd-1611-4add-982a-6610767d53e1
-- Não marcados: luvas LÁTEX AMARELA (inativas), nitrílica, PVC, malha, corte etc.
-- Sem tabela nova — sem GRANT. Backup: dados-locais/backup_ceu_itens_142_2026-10-17/
-- ============================================================

ALTER TABLE public.itens
  ADD COLUMN IF NOT EXISTS sem_alerta_prazo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.itens.sem_alerta_prazo IS
  'Item de troca frequente: a fila CEU → Pedidos não mostra o selo "antes do prazo". prazo_uso_dias segue valendo nos demais usos. Migration 142.';

DO $$
DECLARE v_n int;
BEGIN
  UPDATE public.itens SET sem_alerta_prazo = true
   WHERE id IN (
     '32960193-784f-43a2-81aa-ce31a631edb2',
     'bd715ee1-50fb-478b-8262-41bfc4b5ead6',
     'e195d9fc-e0da-4c78-9037-e1d4eb44c42a',
     'cb86ed83-9a34-4256-b5b1-6136e88a2d5a',
     'a532f3fd-1611-4add-982a-6610767d53e1');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'Esperava marcar 5 itens, marcou %', v_n;
  END IF;
END $$;
