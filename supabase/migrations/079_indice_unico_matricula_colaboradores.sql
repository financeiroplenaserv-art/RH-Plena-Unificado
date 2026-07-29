-- 079: índice único em colaboradores.matricula
-- Motivo: o lote de ex-colaboradores importado em 25/06/2026 criou 4 matrículas
-- duplicadas (000016, 000017, 000008, 000003) colidindo com o quadro atual —
-- risco de importações por matrícula (férias Flit, escalas) pegarem a pessoa errada.
-- Os registros antigos foram renumerados com prefixo ANT- em 29/07/2026
-- (scripts/renumerar-matriculas-duplicadas.mjs). Este índice impede reincidência.
-- Postgres permite múltiplos NULL em índice único; matrículas vazias não existem
-- (verificado em 29/07/2026: 0 duplicadas, 0 vazias).

CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_matricula_unique
  ON public.colaboradores (matricula);
