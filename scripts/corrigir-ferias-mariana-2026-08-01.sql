-- ============================================================================
-- Correção de dados (01/08/2026): férias da Mariana Ribeiro da Silva no
-- contrato "Insalub. Quatre" (vínculo 20/06–19/07, 12x36).
--
-- Problema: o bloco de férias 20/06–07/07 (coberto por Marcelo Ramos Rufino)
-- estava registrado só em 13 dias; os dias de escala dela 20, 22, 24, 26 e
-- 28/06 não tinham linha no calendário e caiam no fallback "trabalhou",
-- inflando a titular (17 em vez de 12) e roubando do substituto (13 em vez
-- de 18) na nova regra de insalubridade.
--
-- Correção confirmada com a gestão em 01/08/2026: Mariana voltou de férias
-- em 08/07 (direito = 8–19/07 = 12 dias); Marcelo cobriu 20/06–07/07 (18).
--
-- Backup do estado anterior: dados-locais/backup_mariana_correcao_ferias_2026-08-01.json
-- Idempotente: só insere se ainda não existir linha para (vinculo_id, data).
-- ============================================================================

INSERT INTO public.calendario_adicionais
  (vinculo_id, data, status, intrajornada, substituto_colaborador_id, substituto_colaborador_nome)
SELECT
  '9e195212-fa46-48f7-8bb4-b57c7fcff9da',
  d::date,
  'ferias',
  false,
  '3e3abc6a-f92d-4459-8302-17c4285d111f',
  'MARCELO RAMOS RUFINO'
FROM (VALUES
  ('2026-06-20'),
  ('2026-06-22'),
  ('2026-06-24'),
  ('2026-06-26'),
  ('2026-06-28')
) AS v(d)
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendario_adicionais c
  WHERE c.vinculo_id = '9e195212-fa46-48f7-8bb4-b57c7fcff9da'
    AND c.data = d::date
);
