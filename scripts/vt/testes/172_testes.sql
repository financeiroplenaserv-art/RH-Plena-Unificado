DO $$
DECLARE
  v_id uuid;
  v_total integer;
BEGIN
  SELECT id INTO v_id FROM public.vt_trajetos WHERE escopo = 'desconhecido' LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'FALHOU: nenhum trajeto com escopo desconhecido foi marcado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vt_trajetos t
    JOIN public.departamentos d ON d.id = t.departamento_id
    WHERE d.cidade IS NULL AND t.escopo = 'intermunicipal'
  ) THEN
    RAISE EXCEPTION 'FALHOU: posto sem cidade ainda gera intermunicipal';
  END IF;

  BEGIN
    UPDATE public.vt_trajetos SET escopo = 'desconhecido' WHERE id = v_id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'FALHOU: escopo desconhecido foi recusado pelo CHECK';
  END;

  SELECT count(*) INTO v_total FROM public.vt_trajetos WHERE escopo = 'desconhecido';
  IF v_total < 2 THEN
    RAISE EXCEPTION 'FALHOU: esperava ao menos 2 registros desconhecidos, encontrados %', v_total;
  END IF;

  RAISE NOTICE 'TUDO OK — escopo desconhecido aceito e ausência de cidade não vira intermunicipal';
END $$;
