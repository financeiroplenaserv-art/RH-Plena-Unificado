-- A revisão escolhida passa a carregar o preço diário confirmado pelo RH.
-- NULL preserva o comportamento dos trajetos legados ainda não revisados.

ALTER TABLE public.vt_trajeto_decisoes
  ADD COLUMN IF NOT EXISTS custo_diario_centavos integer;

ALTER TABLE public.vt_trajeto_decisoes
  DROP CONSTRAINT IF EXISTS vt_trajeto_decisoes_custo_diario_ck;

ALTER TABLE public.vt_trajeto_decisoes
  ADD CONSTRAINT vt_trajeto_decisoes_custo_diario_ck
  CHECK (custo_diario_centavos IS NULL OR custo_diario_centavos > 0);

COMMENT ON COLUMN public.vt_trajeto_decisoes.custo_diario_centavos IS
  'Custo diário ida+volta escolhido na revisão; NULL usa os pacotes legados como fallback.';
