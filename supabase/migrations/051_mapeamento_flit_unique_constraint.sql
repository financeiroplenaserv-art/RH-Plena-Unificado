-- Migração 051: Adiciona constraint única em mapeamento_flit_local_trabalho
-- Evita mapeamentos duplicados para o mesmo tipo_match + valor_flit.

ALTER TABLE public.mapeamento_flit_local_trabalho
ADD CONSTRAINT mapeamento_flit_local_trabalho_tipo_valor_unique
UNIQUE (tipo_match, valor_flit);
