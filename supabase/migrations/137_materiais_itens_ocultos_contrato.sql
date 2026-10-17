-- ============================================================
-- 137 — Materiais: item ESCONDIDO para um contrato no link do líder
-- ============================================================
-- Decisão da gestora (17/10/2026): a CNOOC vê "Esponja dupla face" e
-- "Esponja Scotch Brite" (esta é exclusiva dela, migration 136). A dupla face
-- deve sumir só para a CNOOC; os demais contratos seguem vendo.
--
-- mat_itens.contratos_ocultos uuid[] (ids de mat_contratos; NULL ou vazio =
-- nenhum). O item some da busca e do kit do link desses contratos e o
-- `enviar` da Edge Function pedido-materiais recusa a linha (mesmo caminho
-- do exclusivo de outro contrato). Exceção: se o gestor pôs o item no Kit
-- Mensal do contrato, a escolha dele vale.
--
-- Escrita pelas policies já existentes de mat_itens. Sem tabela nova — sem
-- GRANT. Nenhuma função SQL recriada. Backup: dados-locais/backup_materiais_137_2026-10-17/.
-- ============================================================

ALTER TABLE public.mat_itens
  ADD COLUMN IF NOT EXISTS contratos_ocultos uuid[];
COMMENT ON COLUMN public.mat_itens.contratos_ocultos IS
  'Ids de mat_contratos para os quais o item fica ESCONDIDO no link do líder (exceto se estiver no kit do contrato). NULL ou vazio = nenhum. Migration 137.';

DO $$
DECLARE
  v_cnooc constant uuid := 'cf6db919-c5fd-4021-96c2-c0582a9d5be9';
  v_item constant uuid := '68f2c49e-8bb9-43f0-9394-47cd9e528541'; -- Esponja dupla face UN
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM public.mat_itens
   WHERE id = v_item AND ativo AND nome ILIKE 'Esponja dupla face%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Esponja dupla face: esperava 1 item ativo, achei %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.mat_contratos WHERE id = v_cnooc;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Contrato CNOOC não encontrado';
  END IF;

  UPDATE public.mat_itens SET contratos_ocultos = ARRAY[v_cnooc] WHERE id = v_item;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'UPDATE afetou % linhas (esperava 1)', v_n;
  END IF;
END $$;
