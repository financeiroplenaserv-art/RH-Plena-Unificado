-- Migração 022: Remove departamentos sem nome_curto que têm um correspondente válido

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Para cada departamento inválido (sem nome_curto), procura um válido com mesmo nome
  FOR r IN
    SELECT i.id as invalido_id, v.id as valido_id
    FROM public.departamentos i
    JOIN public.departamentos v
      ON LOWER(TRIM(i.nome)) = LOWER(TRIM(v.nome))
     AND (v.nome_curto IS NOT NULL AND v.nome_curto <> '')
    WHERE (i.nome_curto IS NULL OR i.nome_curto = '')
  LOOP
    -- Atualiza referências nas tabelas filhas
    UPDATE public.colaboradores
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.contratos_adicionais
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    UPDATE public.extras
    SET departamento_id = r.valido_id
    WHERE departamento_id = r.invalido_id;

    -- Remove o departamento inválido
    DELETE FROM public.departamentos WHERE id = r.invalido_id;
  END LOOP;
END $$;
