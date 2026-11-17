-- Testes da migration 171, executados depois de 169 e 170 na MESMA transação.
-- scripts/vt/testar-171-transacao.ps1 monta 169 + 170 + 171 + estes testes + ROLLBACK.

DO $$
DECLARE
  v_pessoa uuid;
  v_posto uuid;
  v_usuario uuid;
  v_itinerario uuid := '10000000-0000-4000-8000-000000000171';
  v_itinerario_2 uuid := '10000000-0000-4000-8000-000000000172';
  v_decisao uuid := '10000000-0000-4000-8000-000000000173';
  ok boolean;
BEGIN
  SELECT id INTO v_usuario FROM public.perfis
   WHERE nivel_acesso IN ('admin', 'adm') ORDER BY id LIMIT 1;
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'FALHOU: nenhum admin para o teste de escrita';
  END IF;

  SELECT c.id, d.id INTO v_pessoa, v_posto
    FROM public.colaboradores c
    CROSS JOIN public.departamentos d
   ORDER BY c.id, d.id LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- 1) Evidência completa e idempotência.
  INSERT INTO public.vt_itinerarios (
    id, colaborador_id, departamento_id, provedor, alternativa_id,
    itinerario, distancia_metros, duracao_segundos, consultado_em,
    evidencia_hash, chave_idempotencia, created_by
  ) VALUES (
    v_itinerario, v_pessoa, v_posto, 'google_routes', 'google-4',
    jsonb_build_object(
      'pernas', jsonb_build_array(jsonb_build_object('sequencia', 1, 'linha', '39A')),
      'provedor', 'google_routes', 'consultadoEm', '2026-11-16T12:00:00Z',
      'precisao', 'exata', 'evidenciaHash', 'hash-171'
    ),
    15204, 3574, '2026-11-16T12:00:00Z', 'hash-171', 'pessoa-posto-google-4-hash-171', v_usuario
  );

  ok := false;
  BEGIN
    INSERT INTO public.vt_itinerarios (
      colaborador_id, departamento_id, provedor, alternativa_id,
      itinerario, consultado_em, evidencia_hash, chave_idempotencia
    ) VALUES (
      v_pessoa, v_posto, 'google_routes', 'google-4',
      jsonb_build_object('pernas', jsonb_build_array(jsonb_build_object('sequencia', 1, 'linha', '39A'))),
      '2026-11-16T12:00:00Z', 'hash-171', 'pessoa-posto-google-4-hash-171'
    );
  EXCEPTION WHEN unique_violation THEN
    ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: duplicidade de evidência foi aceita'; END IF;

  ok := false;
  BEGIN
    INSERT INTO public.vt_itinerarios (
      colaborador_id, departamento_id, provedor, alternativa_id,
      itinerario, consultado_em, evidencia_hash, chave_idempotencia
    ) VALUES (
      v_pessoa, v_posto, 'google_routes', 'google-vazia',
      jsonb_build_object('pernas', '[]'::jsonb),
      '2026-11-16T12:00:00Z', 'hash-vazia', 'rota-vazia'
    );
  EXCEPTION WHEN check_violation THEN
    ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: itinerário sem pernas foi aceito'; END IF;

  -- 2) Evidência pode ser revisada enquanto a decisão é sugerida.
  INSERT INTO public.vt_itinerarios (
    id, colaborador_id, departamento_id, provedor, alternativa_id,
    itinerario, consultado_em, evidencia_hash, chave_idempotencia, created_by
  ) VALUES (
    v_itinerario_2, v_pessoa, v_posto, 'manual', 'manual-1',
    jsonb_build_object('pernas', jsonb_build_array(jsonb_build_object('sequencia', 1, 'linha', '46'))),
    '2026-11-16T12:00:00Z', 'hash-172', 'pessoa-posto-manual-1-hash-172', v_usuario
  );

  INSERT INTO public.vt_trajeto_decisoes (
    id, colaborador_id, departamento_id, revisao, status,
    vigente_desde, origem, itinerario_id
  ) VALUES (
    v_decisao, v_pessoa, v_posto, 999, 'sugerida', '2026-11-16', 'manual', v_itinerario
  );

  UPDATE public.vt_trajeto_decisoes SET itinerario_id = v_itinerario_2 WHERE id = v_decisao;
  IF (SELECT itinerario_id FROM public.vt_trajeto_decisoes WHERE id = v_decisao) <> v_itinerario_2 THEN
    RAISE EXCEPTION 'FALHOU: revisão da evidência em decisão sugerida não foi aceita';
  END IF;

  UPDATE public.vt_trajeto_decisoes
    SET status = 'confirmada', confirmado_por = v_usuario, confirmado_em = now()
   WHERE id = v_decisao;

  ok := false;
  BEGIN
    UPDATE public.vt_trajeto_decisoes SET itinerario_id = v_itinerario WHERE id = v_decisao;
  EXCEPTION WHEN others THEN
    ok := SQLERRM LIKE '%nova revisão%';
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'FALHOU: decisão confirmada trocou a evidência';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.log_auditoria
     WHERE tabela = 'vt_itinerarios' AND registro_id = v_itinerario::text
  ) THEN
    RAISE EXCEPTION 'FALHOU: inclusão da evidência não gerou auditoria';
  END IF;

  -- 3) Grants: authenticated lê, inclui e exclui por admin, mas não atualiza.
  IF NOT has_table_privilege('authenticated', 'public.vt_itinerarios', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: SELECT de authenticated ausente';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.vt_itinerarios', 'INSERT') THEN
    RAISE EXCEPTION 'FALHOU: INSERT de authenticated ausente';
  END IF;
  IF has_table_privilege('authenticated', 'public.vt_itinerarios', 'UPDATE') THEN
    RAISE EXCEPTION 'FALHOU: UPDATE de authenticated foi concedido';
  END IF;
  IF has_table_privilege('anon', 'public.vt_itinerarios', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU: anon recebeu acesso à evidência';
  END IF;

  PERFORM set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  ok := false;
  BEGIN
    UPDATE public.vt_itinerarios SET evidencia_hash = 'adulterado' WHERE id = v_itinerario;
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: atualização da evidência foi aceita'; END IF;

  DELETE FROM public.vt_itinerarios WHERE id = v_itinerario;
  IF NOT EXISTS (SELECT 1 FROM public.vt_itinerarios WHERE id = v_itinerario) THEN
    RAISE EXCEPTION 'FALHOU: exclusão sem admin foi aceita';
  END IF;
END $$;
