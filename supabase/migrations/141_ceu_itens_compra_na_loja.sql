-- ============================================================
-- 141 — CEU: itens "compra na loja com autorização" (sem tamanho no pedido)
-- ============================================================
-- Decisão da gestora (17/10/2026): calça social, camisa branca social de
-- porteiro e blazer não têm estoque — o colaborador vai à loja comprar com a
-- autorização da empresa. O líder não precisa informar tamanho dessas peças.
--
-- itens.compra_na_loja (boolean, default false): marcação de DADO, editável na
-- tela CEU → Itens por quem já edita itens. No link do líder, a peça é "compra
-- na loja" quando TODOS os seus itens ativos estão marcados (pecasCeu agrupa
-- os itens pelo nome base). A marca viaja no `carregar` (não é dado pessoal).
--
-- Marcados (confirmados pela gestora em 17/10/2026):
--   BLAZER                                           4dee8098-4b41-48b5-a957-c505a89b9bcf
--   CALÇA SOCIAL (todas as funções)                  b24e610f-bdda-4275-aefe-c2cb52cf1127
--   CAMISA SOCIAL EM TECIDO BRANCA COM LOGO BORDADO  54a60236-6fe7-4711-b138-d326e5a92a82
-- NÃO marcados: CAMISA SOCIAL BRANCA (64b2ceca, ASG segue com tamanho), CALÇA
-- SOCIAL ESPECIAL, CALÇA SOCIAL ELÁSTICA, TERNO OXFORD.
--
-- ceu_pedido_itens.tamanho já é nullable e mat_registrar_envio já grava
-- tamanho vazio como NULL: nenhuma função precisa mudar. Sem tabela nova —
-- sem GRANT de tabela. Backup: dados-locais/backup_ceu_itens_141_2026-10-17/
-- ============================================================

ALTER TABLE public.itens
  ADD COLUMN IF NOT EXISTS compra_na_loja boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.itens.compra_na_loja IS
  'Item sem estoque: o colaborador compra na loja com autorização. O link do líder não pede tamanho. Migration 141.';

DO $$
DECLARE v_n int;
BEGIN
  UPDATE public.itens SET compra_na_loja = true
   WHERE id IN (
     '4dee8098-4b41-48b5-a957-c505a89b9bcf',
     'b24e610f-bdda-4275-aefe-c2cb52cf1127',
     '54a60236-6fe7-4711-b138-d326e5a92a82');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'Esperava marcar 3 itens, marcou %', v_n;
  END IF;
END $$;
