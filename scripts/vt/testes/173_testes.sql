DO $$
DECLARE
  v_decisao_id uuid;
BEGIN
  SELECT id INTO v_decisao_id
  FROM public.vt_trajeto_decisoes
  WHERE status = 'sugerida'
  LIMIT 1;

  IF v_decisao_id IS NULL THEN
    RAISE EXCEPTION 'FALHOU: nenhuma decisão sugerida disponível para o teste';
  END IF;

  UPDATE public.vt_trajeto_decisoes
  SET custo_diario_centavos = 2940
  WHERE id = v_decisao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FALHOU: não foi possível gravar preço confirmável';
  END IF;

  BEGIN
    UPDATE public.vt_trajeto_decisoes
    SET custo_diario_centavos = 0
    WHERE id = v_decisao_id;
    RAISE EXCEPTION 'FALHOU: preço zero foi aceito';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  RAISE NOTICE 'TUDO OK — preço positivo aceito e preço zero recusado';
END $$;
