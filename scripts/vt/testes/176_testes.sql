-- Testes da migration 176, na MESMA transação (o .ps1 monta migration + testes + ROLLBACK).
DO $$
DECLARE
  v_col uuid;
  v_id uuid;
  v_grants text;
BEGIN
  SELECT id INTO v_col FROM public.colaboradores LIMIT 1;
  IF v_col IS NULL THEN RAISE EXCEPTION 'FALHOU: sem colaborador para o teste'; END IF;

  INSERT INTO public.vt_extras_mensais (colaborador_id, competencia, valor_centavos, motivo)
  VALUES (v_col, '2026-12', 1500, 'Foi a outro contrato no mesmo dia')
  RETURNING id INTO v_id;

  BEGIN
    INSERT INTO public.vt_extras_mensais (colaborador_id, competencia, valor_centavos, motivo)
    VALUES (v_col, '2026-12', 100, 'duplicado');
    RAISE EXCEPTION 'FALHOU: extra duplicado na mesma competência foi aceito';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.vt_extras_mensais (colaborador_id, competencia, valor_centavos, motivo)
    VALUES (v_col, '2027-01', 100, '   ');
    RAISE EXCEPTION 'FALHOU: motivo em branco foi aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.vt_extras_mensais (colaborador_id, competencia, valor_centavos, motivo)
    VALUES (v_col, '2027-01', 0, 'zero');
    RAISE EXCEPTION 'FALHOU: valor zero foi aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.vt_extras_mensais (colaborador_id, competencia, valor_centavos, motivo)
    VALUES (v_col, '2027-13', 100, 'mês inválido');
    RAISE EXCEPTION 'FALHOU: competência inválida foi aceita';
  EXCEPTION WHEN check_violation THEN NULL; END;

  IF NOT EXISTS (
    SELECT 1 FROM public.log_auditoria WHERE tabela = 'vt_extras_mensais' AND registro_id = v_id::text
  ) THEN
    RAISE EXCEPTION 'FALHOU: inserção não gerou auditoria';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE tablename = 'vt_extras_mensais') <> 4 THEN
    RAISE EXCEPTION 'FALHOU: esperadas 4 policies';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.vt_extras_mensais', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.vt_extras_mensais', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: faltam grants de authenticated/service_role';
  END IF;

  SELECT string_agg(privilege_type, ',') INTO v_grants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'vt_extras_mensais' AND grantee = 'anon';
  IF v_grants IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: anon ainda tem privilégios (%)', v_grants;
  END IF;

  RAISE NOTICE 'TUDO OK — tabela, checks, unique, auditoria, policies e grants';
END $$;
