-- Adiciona campos necessários ao dashboard e alertas do módulo CEU

ALTER TABLE itens
  ADD COLUMN IF NOT EXISTS estoque integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_minimo integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_uso_dias integer;

COMMENT ON COLUMN itens.estoque IS 'Quantidade atual em estoque';
COMMENT ON COLUMN itens.estoque_minimo IS 'Quantidade mínima para alerta de estoque baixo';
COMMENT ON COLUMN itens.prazo_uso_dias IS 'Prazo máximo de uso do item em dias (para alerta de prazo de uso)';

-- Adiciona campos de tamanho de uniforme para integração CEU

ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS tamanho_camisa text,
  ADD COLUMN IF NOT EXISTS tamanho_calca text,
  ADD COLUMN IF NOT EXISTS tamanho_calcado text;

COMMENT ON COLUMN colaboradores.tamanho_camisa IS 'Tamanho da camisa/uniforme superior (módulo CEU)';
COMMENT ON COLUMN colaboradores.tamanho_calca IS 'Tamanho da calça/uniforme inferior (módulo CEU)';
COMMENT ON COLUMN colaboradores.tamanho_calcado IS 'Tamanho do calçado (módulo CEU)';
