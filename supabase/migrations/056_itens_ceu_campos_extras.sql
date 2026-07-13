-- Migração 056: Adiciona campos extras aos itens do CEU
--
-- Campos presentes no arquivo "EPIS e Uniformes para CORH.xlsx":
-- Un. (unidade), Última Compra (ultima_compra), Sit. (situacao).

ALTER TABLE public.itens
ADD COLUMN IF NOT EXISTS unidade TEXT;

ALTER TABLE public.itens
ADD COLUMN IF NOT EXISTS ultima_compra DATE;

ALTER TABLE public.itens
ADD COLUMN IF NOT EXISTS situacao TEXT;

COMMENT ON COLUMN public.itens.unidade IS 'Unidade de medida do item (UN, PA, KG, etc.)';
COMMENT ON COLUMN public.itens.ultima_compra IS 'Data da última compra do item';
COMMENT ON COLUMN public.itens.situacao IS 'Situação do item no cadastro (A=Ativo, I=Inativo)';
