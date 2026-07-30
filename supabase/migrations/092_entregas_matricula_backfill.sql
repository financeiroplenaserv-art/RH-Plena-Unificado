-- ============================================================================
-- Migration 092: entregas.matricula (CEU) + backfill.
--
-- Decisão da gestão em 30/07/2026: o formulário de entrega do CEU sempre
-- enviou o campo `matricula` no payload, mas a tabela não tinha a coluna —
-- o PostgREST descartava o valor silenciosamente. A coluna facilita a
-- auditoria direta por matrícula (sem precisar joinar colaboradores).
--
-- O backfill preenche o histórico a partir de colaboradores.matricula.
-- ============================================================================

ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS matricula text;

UPDATE public.entregas e
SET matricula = c.matricula
FROM public.colaboradores c
WHERE e.colaborador_id = c.id
  AND e.matricula IS NULL
  AND c.matricula IS NOT NULL;
