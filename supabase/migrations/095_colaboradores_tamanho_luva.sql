-- ============================================================================
-- Migration 095: tamanho de luva no cadastro do colaborador
--
-- Contexto: o cadastro já tinha tamanho_camisa/calca/calcado (exibidos no
-- Lançamento Rápido do CEU), mas não havia onde registrar o tamanho de luva
-- (P, M, G, GG, XG, XGG). A coluna alimenta o resumo 📏 e a coluna "Tam."
-- informativa da grade de lançamento (apenas referência visual — o tamanho
-- não é gravado na entrega nem no recibo, pois o código do item já o contém).
-- ============================================================================

ALTER TABLE public.colaboradores
ADD COLUMN IF NOT EXISTS tamanho_luva text;

COMMENT ON COLUMN public.colaboradores.tamanho_luva IS 'Tamanho de luva do colaborador (P, M, G, GG, XG, XGG) — referência para entrega de EPI.';
