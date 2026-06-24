-- Migração 025: Corrige vínculos de colaboradores com departamentos
-- Causa: migration 024 falhou para nomes acentuados e deixou departamento_id nulos

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalizar_match(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(unaccent(coalesce(texto, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

-- 1. Consolida departamentos do e-contador restantes usando comparação normalizada
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (i.id)
      v.id AS valido_id,
      i.id AS invalido_id
    FROM public.departamentos v
    JOIN public.departamentos i
      ON i.id <> v.id
      AND i.status = 'Ativo'
      AND v.status = 'Ativo'
      AND v.nome_curto IS NOT NULL
      AND v.nome_curto <> ''
      AND public.normalizar_match(i.nome) ~ ('\m' || public.normalizar_match(v.nome_curto) || '\M')
    ORDER BY i.id, length(v.nome_curto) DESC
  LOOP
    UPDATE public.colaboradores
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.contratos_adicionais
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.extras
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    DELETE FROM public.departamentos WHERE id = r.invalido_id;
  END LOOP;
END $$;

-- 2. Preenche colaboradores com departamento_id nulo mas campo departamento preenchido
UPDATE public.colaboradores c
SET departamento_id = d.id
FROM public.departamentos d
WHERE c.departamento_id IS NULL
  AND c.departamento IS NOT NULL
  AND c.departamento <> ''
  AND d.status = 'Ativo'
  AND d.nome_curto IS NOT NULL
  AND d.nome_curto <> ''
  AND public.normalizar_match(c.departamento) ~ ('\m' || public.normalizar_match(d.nome_curto) || '\M');
