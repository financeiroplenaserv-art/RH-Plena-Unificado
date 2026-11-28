-- Testes da migration 178, na MESMA transação (o .ps1 monta migration + testes + ROLLBACK).
DO $$
DECLARE
  v_col uuid;
  v_id uuid;
  v_grants text;
  v_dias jsonb := '{"2026-12-01": {"marca": "T", "local": "CONDOMINIO TESTE", "horario": "07:00 - 19:00"},
                    "2026-12-02": {"marca": "F", "local": "CONDOMINIO TESTE"},
                    "2026-12-03": {"marca": "", "local": "CONDOMINIO TESTE"}}'::jsonb;
BEGIN
  SELECT id INTO v_col FROM public.colaboradores LIMIT 1;
  IF v_col IS NULL THEN RAISE EXCEPTION 'FALHOU: sem colaborador para o teste'; END IF;

  INSERT INTO public.vt_escala_dias (colaborador_id, competencia, dias, nome_arquivo)
  VALUES (v_col, '2026-12', v_dias, 'teste.xlsx')
  RETURNING id INTO v_id;

  -- Upsert (reimportação) substitui a linha da competência
  INSERT INTO public.vt_escala_dias (colaborador_id, competencia, dias, nome_arquivo)
  VALUES (v_col, '2026-12', '{"2026-12-01": {"marca": "FR", "local": "X"}}'::jsonb, 'novo.xlsx')
  ON CONFLICT (colaborador_id, competencia) DO UPDATE
    SET dias = excluded.dias, nome_arquivo = excluded.nome_arquivo, importado_em = now();
  IF (SELECT dias->'2026-12-01'->>'marca' FROM public.vt_escala_dias WHERE id = v_id) <> 'FR' THEN
    RAISE EXCEPTION 'FALHOU: upsert não substituiu as marcas';
  END IF;
  IF (SELECT count(*) FROM public.vt_escala_dias WHERE colaborador_id = v_col AND competencia = '2026-12') <> 1 THEN
    RAISE EXCEPTION 'FALHOU: upsert duplicou a linha';
  END IF;

  BEGIN
    INSERT INTO public.vt_escala_dias (colaborador_id, competencia, dias)
    VALUES (v_col, '2026-12', '{}'::jsonb);
    RAISE EXCEPTION 'FALHOU: duplicado na mesma competência foi aceito';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.vt_escala_dias (colaborador_id, competencia, dias)
    VALUES (v_col, '2027-13', '{}'::jsonb);
    RAISE EXCEPTION 'FALHOU: competência inválida foi aceita';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    INSERT INTO public.vt_escala_dias (colaborador_id, competencia, dias)
    VALUES (v_col, '2027-01', '[1, 2]'::jsonb);
    RAISE EXCEPTION 'FALHOU: dias que não é objeto foi aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;

  IF NOT EXISTS (
    SELECT 1 FROM public.log_auditoria WHERE tabela = 'vt_escala_dias' AND registro_id = v_id::text
  ) THEN
    RAISE EXCEPTION 'FALHOU: inserção não gerou auditoria';
  END IF;

  DELETE FROM public.vt_escala_dias WHERE id = v_id;
  IF EXISTS (SELECT 1 FROM public.vt_escala_dias WHERE id = v_id) THEN
    RAISE EXCEPTION 'FALHOU: delete não removeu a linha';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.vt_escala_dias'::regclass) THEN
    RAISE EXCEPTION 'FALHOU: RLS desligado';
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE tablename = 'vt_escala_dias') <> 4 THEN
    RAISE EXCEPTION 'FALHOU: esperadas 4 policies';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vt_escala_dias'
                  AND policyname = 'vt_escala_dias_delete' AND qual LIKE '%is_editor%') THEN
    RAISE EXCEPTION 'FALHOU: DELETE deveria exigir is_editor()';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.vt_escala_dias', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.vt_escala_dias', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.vt_escala_dias', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: faltam grants de authenticated/service_role';
  END IF;

  SELECT string_agg(privilege_type, ',') INTO v_grants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'vt_escala_dias' AND grantee = 'anon';
  IF v_grants IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU: anon ainda tem privilégios (%)', v_grants;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auditoria_vt_escala_dias' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'FALHOU: trigger de auditoria ausente';
  END IF;

  RAISE NOTICE 'TUDO OK — tabela, checks, unique, upsert, auditoria, RLS, policies e grants';
END $$;

-- Idempotência: rodar a migration de novo na mesma transação não pode falhar.
-- (o .ps1 inclui o corpo da migration uma segunda vez depois deste bloco)
