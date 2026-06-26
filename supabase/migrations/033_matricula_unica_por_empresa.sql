-- Migração 033: Torna a matrícula única por empresa, não global
--
-- Contexto: com duas empresas no e-Contador (Plena Tech e Plena EA),
-- funcionários diferentes podem ter a mesma matrícula em empresas diferentes.
-- A constraint global "colaboradores_matricula_key" impedia a importação.

-- 1. Remove a constraint única global de matrícula, se existir
alter table public.colaboradores
  drop constraint if exists colaboradores_matricula_key;

-- 2. Remove índice único global de matrícula, se existir
drop index if exists colaboradores_matricula_key;

-- 3. Cria índice não-único para manter performance nas buscas por matrícula
create index if not exists idx_colaboradores_matricula
  on public.colaboradores (matricula);

-- 4. Tenta criar unicidade por empresa. Se houver duplicatas dentro da mesma empresa,
--    apenas cria um índice normal por empresa e registra o problema.
DO $$
DECLARE
  duplicatas integer;
BEGIN
  SELECT count(*) INTO duplicatas
  FROM (
    SELECT matricula, empresa_id, count(*) as total
    FROM public.colaboradores
    WHERE matricula IS NOT NULL
      AND matricula <> ''
    GROUP BY matricula, empresa_id
    HAVING count(*) > 1
  ) d;

  IF duplicatas = 0 THEN
    -- Seguro criar constraint única por empresa
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT colaboradores_matricula_empresa_key
      UNIQUE (empresa_id, matricula);
  ELSE
    -- Há duplicatas dentro da mesma empresa; não podemos forçar unicidade agora.
    -- Cria índice normal por empresa para performance.
    CREATE INDEX IF NOT EXISTS idx_colaboradores_matricula_empresa
      ON public.colaboradores (empresa_id, matricula);
    RAISE NOTICE 'Existem % matrículas duplicadas dentro da mesma empresa. Unicidade por empresa não foi aplicada.', duplicatas;
  END IF;
END $$;
