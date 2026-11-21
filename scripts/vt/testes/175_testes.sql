DO $$
DECLARE
  v_col uuid;
  v_dep uuid;
  v_id uuid;
BEGIN
  SELECT c.id, d.id INTO v_col, v_dep
  FROM public.colaboradores c, public.departamentos d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.vt_trajetos t WHERE t.colaborador_id = c.id AND t.departamento_id = d.id
  )
  LIMIT 1;

  IF v_col IS NULL THEN
    RAISE EXCEPTION 'FALHOU: nenhum par colaborador x posto livre para o teste';
  END IF;

  INSERT INTO public.vt_trajetos (colaborador_id, departamento_id, bilhete_id, escopo, precisao_origem, origem, status)
  VALUES (v_col, v_dep, NULL, 'desconhecido', 'bairro', 'manual', 'sugerido')
  RETURNING id INTO v_id;

  BEGIN
    UPDATE public.vt_trajetos SET status = 'confirmado' WHERE id = v_id;
    RAISE EXCEPTION 'FALHOU: trajeto confirmado sem bilhete foi aceito';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  RAISE NOTICE 'TUDO OK — trajeto sem bilhete aceito como sugerido e recusado como confirmado';
END $$;
