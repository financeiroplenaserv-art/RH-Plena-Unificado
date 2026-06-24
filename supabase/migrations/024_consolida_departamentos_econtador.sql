-- Migração 024: Consolida departamentos do e-contador com departamentos manuais
-- Associa pelo nome_curto do manual contido no nome completo do e-contador (correspondência de palavra inteira)

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT v.id as valido_id, i.id as invalido_id, v.nome_curto, i.nome
    FROM public.departamentos v
    JOIN public.departamentos i
      ON i.id <> v.id
     AND i.nome ~* ('\y' || v.nome_curto || '\y')
    WHERE v.status = 'Ativo'
      AND v.nome_curto IS NOT NULL
      AND v.nome_curto <> ''
      AND LENGTH(v.nome_curto) >= 4
      AND i.status = 'Ativo'
    ORDER BY v.nome_curto
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

    -- Remove o departamento do e-contador
    DELETE FROM public.departamentos WHERE id = r.invalido_id;
  END LOOP;
END $$;
