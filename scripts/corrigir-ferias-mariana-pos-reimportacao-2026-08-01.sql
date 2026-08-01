-- ============================================================================
-- Correção de dados nº 2 (01/08/2026): férias da Mariana Ribeiro da Silva
-- (vínculo 20/06–19/07, contrato "Insalub. Quatre", 12x36) após REIMPORTAÇÃO
-- do espelho de ponto feita pela usuária.
--
-- Diagnóstico: a importação unificada regrava os dias a partir do PDF, que
-- NÃO tem conceito de substituto. Efeitos observados:
--   1. 30/06 e 01–07/07 voltaram como 'ferias' SEM o substituto (estavam
--      com MARCELO RAMOS RUFINO desde 31/07);
--   2. 23/06 e 29/06 foram apagados e não recriados (caem no fallback).
--
-- Estado correto confirmado com a gestão: férias 20/06–07/07 (18 dias),
-- TODAS com Marcelo como substituto → titular recebe 12 (8–19/07) e o
-- substituto 18, pela regra de insalubridade de 01/08/2026.
--
-- Backup do estado anterior: dados-locais/backup_mariana_pos_reimportacao_2026-08-01.json
-- Idempotente (UPDATE só onde falta o substituto; INSERT com NOT EXISTS).
-- ============================================================================

-- (1) Dias que existem como férias mas perderam o substituto na reimportação
UPDATE public.calendario_adicionais
SET substituto_colaborador_id = '3e3abc6a-f92d-4459-8302-17c4285d111f',
    substituto_colaborador_nome = 'MARCELO RAMOS RUFINO',
    updated_at = now()
WHERE vinculo_id = '9e195212-fa46-48f7-8bb4-b57c7fcff9da'
  AND data IN ('2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03',
               '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07')
  AND status = 'ferias'
  AND substituto_colaborador_id IS NULL;

-- (2) Dias apagados pela reimportação: recria como férias com o substituto
INSERT INTO public.calendario_adicionais
  (vinculo_id, data, status, intrajornada, substituto_colaborador_id, substituto_colaborador_nome)
SELECT
  '9e195212-fa46-48f7-8bb4-b57c7fcff9da',
  d::date,
  'ferias',
  false,
  '3e3abc6a-f92d-4459-8302-17c4285d111f',
  'MARCELO RAMOS RUFINO'
FROM (VALUES ('2026-06-23'), ('2026-06-29')) AS v(d)
WHERE NOT EXISTS (
  SELECT 1 FROM public.calendario_adicionais c
  WHERE c.vinculo_id = '9e195212-fa46-48f7-8bb4-b57c7fcff9da'
    AND c.data = d::date
);
