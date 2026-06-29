-- Migração 052: Adiciona código e garante valor na tabela de itens do CEU
--
-- O campo codigo permite autocomplete por código interno/produto no lançamento rápido
-- e na nova entrega. O campo valor já existia, mas a importação não o populava.

-- Adiciona campo codigo se ainda não existir
ALTER TABLE public.itens
ADD COLUMN IF NOT EXISTS codigo TEXT;

-- Garante que o campo valor existe (já deveria existir, mas por segurança)
ALTER TABLE public.itens
ADD COLUMN IF NOT EXISTS valor INTEGER;

COMMENT ON COLUMN public.itens.codigo IS 'Código interno/produto do item CEU';
COMMENT ON COLUMN public.itens.valor IS 'Valor unitário do item em centavos';

-- Índice único para código, permitindo múltiplos NULLs mas evitando duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_itens_codigo_unico
  ON public.itens(codigo)
  WHERE codigo IS NOT NULL AND codigo <> '';

-- Índice para busca rápida por código
CREATE INDEX IF NOT EXISTS idx_itens_codigo_busca
  ON public.itens USING btree (codigo);
