-- 172_vt_escopo_desconhecido.sql
-- Ausência de cidade é ausência de evidência, nunca intermunicipal presumido.
-- Backup antes da aplicação: dados-locais/backup_vt_172_2026-11-17/vt_dados.json

begin;

ALTER TABLE public.vt_trajetos
  DROP CONSTRAINT IF EXISTS vt_trajetos_escopo_check;
ALTER TABLE public.vt_trajetos
  ADD CONSTRAINT vt_trajetos_escopo_check
  CHECK (escopo IN ('niteroi_municipal', 'intermunicipal', 'municipal_outra', 'desconhecido'));

UPDATE public.vt_trajetos AS t
  SET escopo = 'desconhecido'
WHERE t.escopo = 'intermunicipal'
  AND NOT EXISTS (
    SELECT 1
    FROM public.colaboradores AS c
    JOIN public.departamentos AS d ON d.id = t.departamento_id
    WHERE c.id = t.colaborador_id
      AND c.cidade IS NOT NULL AND btrim(c.cidade) <> ''
      AND d.cidade IS NOT NULL AND btrim(d.cidade) <> ''
      AND lower(c.cidade) <> lower(d.cidade)
  );

commit;
