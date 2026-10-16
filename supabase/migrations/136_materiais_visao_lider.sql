-- ============================================================
-- 136 — Materiais: o que o LÍDER vê no link público
-- ============================================================
-- Decisões da gestora (16/10/2026):
--
-- 1. Variação oculta para o líder (é MARCA): a marca fica no nome dos itens
--    (a diluição muda com a marca) e não se renomeia nada. Exceção: o "Mop
--    Cabeleira Pequena" tem as variações "Max Teck" e "Starclean", que são
--    marcas — o líder vê só "Mop Cabeleira Pequena" e a compra decide.
--    mat_item_variacoes.oculta_lider = true esconde a variação no link
--    (busca, kit do mês e revisão). Se TODAS as variações ativas do item
--    estão ocultas, o líder vê o item uma vez só, sem variação, e a linha é
--    gravada com variacao_id NULL. As telas internas continuam com a marca.
--
-- 2. Nome para o líder: mat_itens.nome_lider (NULL = regra atual do link,
--    nome do cadastro sem a unidade no fim). Itens com o mesmo nome_lider
--    (normalizado) viram UM resultado na busca do líder — preferência para o
--    que está no kit do contrato. Os itens NÃO são fundidos (preço, kit e
--    histórico próprios). Preenchido: "Removedor desengraxante Mágico Start
--    5L" e "Removedor desengraxante Removic 5L" → "Removedor desengraxante 5L".
--
-- 3. Itens exclusivos de contratos: mat_itens.contratos_exclusivos uuid[]
--    (ids de mat_contratos; NULL ou vazio = todos os contratos). Item
--    exclusivo não aparece na busca nem no kit do link de outro contrato e o
--    `enviar` da Edge Function pedido-materiais recusa (422) a linha de item
--    exclusivo de outro contrato. Exceção: item que o gestor pôs no kit do
--    contrato (a tela interna avisa, sem bloquear) continua valendo para
--    aquele contrato. Preenchido: os 9 itens marcados pelo Maciel como
--    "exclusivo da Cnooc" (autorizado pela gestora) → contrato CNOOC
--    cf6db919-c5fd-4021-96c2-c0582a9d5be9.
--
-- Escrita pelas policies já existentes de mat_itens/mat_item_variacoes (as
-- mesmas que editam o item). Sem tabela nova — sem GRANT de tabela. Nenhuma
-- função SQL lê o catálogo para o link (a Edge Function usa service_role),
-- então nenhuma função é recriada.
-- Backup: dados-locais/backup_materiais_136_2026-10-16/ (mat_itens e
-- mat_item_variacoes completas).
-- ============================================================

ALTER TABLE public.mat_item_variacoes
  ADD COLUMN IF NOT EXISTS oculta_lider boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.mat_item_variacoes.oculta_lider IS
  'Variação escondida no link do líder (é marca; a compra decide). Todas ocultas = o líder vê o item sem variação e a linha grava variacao_id NULL. Migration 136.';

ALTER TABLE public.mat_itens
  ADD COLUMN IF NOT EXISTS nome_lider text;
COMMENT ON COLUMN public.mat_itens.nome_lider IS
  'Nome de exibição no link do líder. NULL = nome do cadastro sem a unidade no fim. Itens com o mesmo nome_lider viram um resultado na busca. Migration 136.';

ALTER TABLE public.mat_itens
  ADD COLUMN IF NOT EXISTS contratos_exclusivos uuid[];
COMMENT ON COLUMN public.mat_itens.contratos_exclusivos IS
  'Ids de mat_contratos que podem pedir o item pelo link do líder. NULL ou vazio = todos. Migration 136.';

-- ---------- Dados (UPDATE por id; o bloco confere cada alvo) ----------
DO $$
DECLARE
  v_cnooc constant uuid := 'cf6db919-c5fd-4021-96c2-c0582a9d5be9';
  v_n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mat_contratos WHERE id = v_cnooc AND nome = 'CNOOC') THEN
    RAISE EXCEPTION 'Contrato CNOOC não encontrado pelo id esperado';
  END IF;

  -- (1) Mop Cabeleira Pequena: Max Teck e Starclean são marcas.
  UPDATE public.mat_item_variacoes SET oculta_lider = true
   WHERE item_id = 'd1b5289c-b7ac-487a-93d5-bdfb7bcd0812'
     AND id IN ('9c93d8f0-db6a-42e8-a61d-f4e94da5cc87', '95c2087c-2869-400c-9a5f-da1b74f305ab');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN RAISE EXCEPTION 'Mop Cabeleira Pequena: esperadas 2 variações, atualizadas %', v_n; END IF;

  -- (2) Removedor desengraxante: um item só para o líder.
  UPDATE public.mat_itens SET nome_lider = 'Removedor desengraxante 5L'
   WHERE id IN ('41959f96-9b17-494b-920e-a8dcbdfc3602', 'a86f64f1-2435-4d9a-b3cf-0e5ac54679f8')
     AND nome LIKE 'Removedor desengraxante %';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN RAISE EXCEPTION 'Removedor desengraxante: esperados 2 itens, atualizados %', v_n; END IF;

  -- (3) Exclusivos da CNOOC (9 itens).
  UPDATE public.mat_itens SET contratos_exclusivos = ARRAY[v_cnooc]
   WHERE id IN (
     '0ae463d1-b0ab-413c-aecc-53cee8a6a04a',  -- Esponja Scotch Brite
     'c1251298-6997-4195-9255-a441490feb9a',  -- Casa e Perfume Agradable 500mL
     'a5005ee6-f0a5-4c3a-b7d8-077034c03e79',  -- Diabo Verde 1L
     '0d42e95b-c289-4451-9534-064922b844d5',  -- Pano de chão especial UN
     'f71b46c2-6e51-4f12-bcdb-1e895aa88feb',  -- Pano multiuso Inoven c/ 5 PCT
     'a78f410b-045d-4c6e-9080-8b4bad501b38',  -- Papel toalha Nobre folha dupla 23x21 c/ 2000 CAIXA
     '7d7d1068-4612-4ab8-b05d-0abe51e88fc5',  -- Sapólio cremoso Cif 250mL
     'e367f355-054d-4aa4-b638-98fbc574454f',  -- Veja Multiuso 500mL
     'a5726706-4923-4fd9-9502-91d9b8401aa3'   -- Pano de microfibra 30x30 azul c/ 2 PCT
   );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 9 THEN RAISE EXCEPTION 'Exclusivos da CNOOC: esperados 9 itens, atualizados %', v_n; END IF;
END $$;
