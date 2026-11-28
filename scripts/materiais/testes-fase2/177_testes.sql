-- ===== testes 177 (depois da 177, na mesma transação; SEMPRE com rollback) =====
-- Atender lança a entrega no CEU (snapshot do item no servidor, idempotente, parcial com
-- motivo, sem permissão recusa, linha não conferida recusa) e "Trocar contrato".
-- Perfis reais lidos por consulta: dp2 (Beth) atende; financeiro não tem permissão.
create temp table t_ctx(k text primary key, v text);
grant all on t_ctx to authenticated;
insert into t_ctx values
 ('dp2', (select id::text from perfis where nivel_acesso = 'dp2' order by id limit 1)),
 ('fin', (select id::text from perfis where nivel_acesso = 'financeiro' order by id limit 1));

-- Fixture: 4 linhas EPI conferidas, de itens ativos, em pedidos diferentes quando possível.
DO $t$ DECLARE r record; i int := 0;
BEGIN
  IF (SELECT v FROM t_ctx WHERE k='dp2') IS NULL OR (SELECT v FROM t_ctx WHERE k='fin') IS NULL THEN
    RAISE EXCEPTION 'FALHOU fixture: perfil dp2/financeiro ausente';
  END IF;
  FOR r IN SELECT c.id FROM ceu_pedido_itens c JOIN itens it ON it.id = c.item_id
            WHERE c.status IN ('conferido','ajustado') AND c.tipo <> 'cracha' AND c.colaborador_id IS NOT NULL
              AND it.situacao IS DISTINCT FROM 'I'
            ORDER BY c.pedido_id, c.id LIMIT 1 LOOP
    INSERT INTO t_ctx VALUES ('parcial', r.id::text);
  END LOOP;
  FOR r IN SELECT c.id FROM ceu_pedido_itens c JOIN itens it ON it.id = c.item_id
            WHERE c.status IN ('conferido','ajustado') AND c.tipo <> 'cracha' AND c.colaborador_id IS NOT NULL
              AND it.situacao IS DISTINCT FROM 'I'
              AND c.id::text NOT IN (SELECT v FROM t_ctx)
            ORDER BY c.id LIMIT 3 LOOP
    i := i + 1;
    INSERT INTO t_ctx VALUES ('l' || i, r.id::text);
  END LOOP;
  IF i < 3 OR (SELECT v FROM t_ctx WHERE k='parcial') IS NULL THEN RAISE EXCEPTION 'FALHOU fixture: linhas conferidas insuficientes'; END IF;
  -- parcial: garante conferido >= 2 (a maioria dos EPIs é 1 unidade)
  UPDATE ceu_pedido_itens SET qtd_conferida = greatest(coalesce(qtd_conferida, qtd_pedida), 2), status = 'ajustado'
   WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='parcial');
  -- l3 vira "pendente" (não conferida) para o teste de recusa.
  UPDATE ceu_pedido_itens SET status = 'pendente' WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='l3');
  -- CA novo no item de l1 (simula o CA digitado na janela antes de lançar).
  UPDATE itens SET ca = 'CA-TESTE-177' WHERE id = (SELECT item_id FROM ceu_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='l1'));
  INSERT INTO t_ctx VALUES ('n_entregas', (SELECT count(*)::text FROM entregas));
END $t$;

-- 1) financeiro (sem permissão) é recusado
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ctx where k='fin'), 'role', 'authenticated')::text, true);
set local role authenticated;
DO $t$ DECLARE ok boolean := false;
BEGIN
  BEGIN
    PERFORM atender_e_lancar_linhas_pedido_ceu(jsonb_build_array(jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='l1'))), date '2026-12-01');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Sem permissão%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: financeiro atendeu'; END IF;
  ok := false;
  BEGIN
    PERFORM trocar_contrato_linha_pedido_ceu((SELECT v::uuid FROM t_ctx WHERE k='l2'), (SELECT id FROM mat_contratos WHERE ativo LIMIT 1), 'teste');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Sem permissão%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: financeiro trocou contrato'; END IF;
END $t$;
reset role;

-- 2) dp2 atende: lança e marca; parcial exige motivo; não conferida recusa; idempotência
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ctx where k='dp2'), 'role', 'authenticated')::text, true);
set local role authenticated;
DO $t$ DECLARE ok boolean; res jsonb; base int;
BEGIN
  -- não conferida
  ok := false;
  BEGIN
    PERFORM atender_e_lancar_linhas_pedido_ceu(jsonb_build_array(jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='l3'))), date '2026-12-01');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Só linhas conferidas%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: linha pendente foi atendida'; END IF;

  -- parcial sem motivo
  SELECT coalesce(qtd_conferida, qtd_pedida) INTO base FROM ceu_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='parcial');
  ok := false;
  BEGIN
    PERFORM atender_e_lancar_linhas_pedido_ceu(jsonb_build_array(jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='parcial'), 'qtd_atendida', base - 1)), date '2026-12-01');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Informe o motivo%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: parcial sem motivo aceita'; END IF;

  -- acima do conferido
  ok := false;
  BEGIN
    PERFORM atender_e_lancar_linhas_pedido_ceu(jsonb_build_array(jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='parcial'), 'qtd_atendida', base + 1)), date '2026-12-01');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Quantidade entregue inválida%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: acima do conferido aceito'; END IF;

  -- sem data
  ok := false;
  BEGIN
    PERFORM atender_e_lancar_linhas_pedido_ceu(jsonb_build_array(jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='l1'))), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Informe a data%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: sem data aceito'; END IF;

  -- lança l1 (cheia) + parcial (com motivo)
  res := atender_e_lancar_linhas_pedido_ceu(jsonb_build_array(
           jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='l1')),
           jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='parcial'), 'qtd_atendida', base - 1, 'motivo', 'faltou no estoque')),
         date '2026-12-01');
  IF (res->>'atendidas')::int <> 2 OR (res->>'entregas_criadas')::int <> 2 OR (res->>'ja_atendidas')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: retorno inesperado %', res;
  END IF;
  INSERT INTO t_ctx VALUES ('res1', res::text);

  -- 2ª chamada igual: não duplica
  res := atender_e_lancar_linhas_pedido_ceu(jsonb_build_array(
           jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='l1')),
           jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='parcial'), 'qtd_atendida', base - 1, 'motivo', 'faltou no estoque')),
         date '2026-12-01');
  IF (res->>'atendidas')::int <> 0 OR (res->>'entregas_criadas')::int <> 0 OR (res->>'ja_atendidas')::int <> 2 THEN
    RAISE EXCEPTION 'FALHOU: 2a chamada não foi idempotente %', res;
  END IF;

  -- mesma linha duas vezes no payload
  ok := false;
  BEGIN
    PERFORM atender_e_lancar_linhas_pedido_ceu(jsonb_build_array(
      jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='l2')), jsonb_build_object('id', (SELECT v FROM t_ctx WHERE k='l2'))), date '2026-12-01');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'A mesma linha%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: linha duplicada no payload aceita'; END IF;

  -- trocar contrato de linha já atendida: recusa
  ok := false;
  BEGIN
    PERFORM trocar_contrato_linha_pedido_ceu((SELECT v::uuid FROM t_ctx WHERE k='l1'), (SELECT id FROM mat_contratos WHERE ativo LIMIT 1), 'teste');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Só linhas ainda não atendidas%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: trocou contrato de linha atendida'; END IF;
END $t$;
reset role;

-- 3) conferências como dono: entregas, snapshot, CA, status
DO $t$ DECLARE l record; en record; it record; n int;
BEGIN
  SELECT count(*) INTO n FROM entregas;
  IF n <> (SELECT v::int FROM t_ctx WHERE k='n_entregas') + 2 THEN RAISE EXCEPTION 'FALHOU: esperadas +2 entregas, veio %', n - (SELECT v::int FROM t_ctx WHERE k='n_entregas'); END IF;

  FOR l IN SELECT c.* FROM ceu_pedido_itens c WHERE c.id IN ((SELECT v::uuid FROM t_ctx WHERE k='l1'), (SELECT v::uuid FROM t_ctx WHERE k='parcial')) LOOP
    IF l.status <> 'atendido' OR l.entrega_id IS NULL THEN RAISE EXCEPTION 'FALHOU: linha % não marcada com entrega', l.id; END IF;
    SELECT * INTO en FROM entregas WHERE id = l.entrega_id;
    SELECT * INTO it FROM itens WHERE id = l.item_id;
    IF en.colaborador_id <> l.colaborador_id OR en.item_id <> l.item_id OR en.data_entrega <> date '2026-12-01'
       OR en.quantidade <> l.qtd_atendida OR en.situacao <> 'Troca' OR coalesce(en.recibo_emitido, false)
       OR en.usuario_id <> (SELECT v::uuid FROM t_ctx WHERE k='dp2') THEN
      RAISE EXCEPTION 'FALHOU: entrega % com campos errados', en.id;
    END IF;
    IF en.snapshot_item->>'nome' <> it.nome OR en.snapshot_item->>'ca' <> coalesce(it.ca, '')
       OR en.snapshot_item->>'tipo' <> it.tipo OR en.snapshot_item->>'codigo' <> coalesce(it.codigo, '') THEN
      RAISE EXCEPTION 'FALHOU: snapshot não é a foto do item (%)', en.snapshot_item;
    END IF;
    IF en.matricula IS DISTINCT FROM (SELECT matricula FROM colaboradores WHERE id = l.colaborador_id) THEN
      RAISE EXCEPTION 'FALHOU: matrícula da entrega';
    END IF;
  END LOOP;
  -- CA digitado antes de lançar sai no snapshot
  IF (SELECT en2.snapshot_item->>'ca' FROM entregas en2 JOIN ceu_pedido_itens c ON c.entrega_id = en2.id
       WHERE c.id = (SELECT v::uuid FROM t_ctx WHERE k='l1')) <> 'CA-TESTE-177' THEN
    RAISE EXCEPTION 'FALHOU: CA novo não foi para o snapshot';
  END IF;
  -- parcial guardou motivo
  IF (SELECT motivo_atendimento FROM ceu_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='parcial')) <> 'faltou no estoque' THEN
    RAISE EXCEPTION 'FALHOU: motivo do parcial';
  END IF;
  -- índice único: a mesma entrega não serve a duas linhas
  BEGIN
    UPDATE ceu_pedido_itens SET entrega_id = (SELECT entrega_id FROM ceu_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='l1'))
     WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='l2');
    RAISE EXCEPTION 'FALHOU: mesma entrega em duas linhas aceita';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  -- status do pedido de l1 recalculado
  IF (SELECT p.status_ceu FROM mat_pedidos p JOIN ceu_pedido_itens c ON c.pedido_id = p.id WHERE c.id = (SELECT v::uuid FROM t_ctx WHERE k='l1'))
     NOT IN ('em_atendimento', 'atendido') THEN
    RAISE EXCEPTION 'FALHOU: status_ceu do pedido não recalculado';
  END IF;
  -- contrato sem pedido mensal em 2026-12 (para a troca criar)
  INSERT INTO t_ctx VALUES ('sem_ped', (SELECT c.id::text FROM mat_contratos c WHERE c.ativo
     AND NOT EXISTS (SELECT 1 FROM mat_pedidos p WHERE p.contrato_id = c.id AND p.competencia = '2026-12-01') ORDER BY c.nome LIMIT 1));
  -- contrato COM pedido mensal em 2026-12 diferente do da l2
  INSERT INTO t_ctx VALUES ('com_ped', (SELECT p.contrato_id::text FROM mat_pedidos p WHERE p.competencia = '2026-12-01' AND p.tipo = 'mensal'
     AND p.status_produtos <> 'cancelado'
     AND p.id <> (SELECT pedido_id FROM ceu_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='l2')) ORDER BY p.id LIMIT 1));
  INSERT INTO t_ctx VALUES ('ped_l2_orig', (SELECT pedido_id::text FROM ceu_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='l2')));
  IF (SELECT v FROM t_ctx WHERE k='sem_ped') IS NULL OR (SELECT v FROM t_ctx WHERE k='com_ped') IS NULL THEN
    RAISE EXCEPTION 'FALHOU fixture: contratos para a troca';
  END IF;
END $t$;

-- 4) trocar contrato (dp2): motivo obrigatório; cria pedido; move para pedido existente
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ctx where k='dp2'), 'role', 'authenticated')::text, true);
set local role authenticated;
DO $t$ DECLARE ok boolean; res jsonb;
BEGIN
  ok := false;
  BEGIN
    PERFORM trocar_contrato_linha_pedido_ceu((SELECT v::uuid FROM t_ctx WHERE k='l2'), (SELECT v::uuid FROM t_ctx WHERE k='sem_ped'), '   ');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'Informe o motivo%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: troca sem motivo aceita'; END IF;

  res := trocar_contrato_linha_pedido_ceu((SELECT v::uuid FROM t_ctx WHERE k='l2'), (SELECT v::uuid FROM t_ctx WHERE k='sem_ped'), 'trabalha no outro posto', false);
  IF NOT (res->>'pedido_criado')::boolean THEN RAISE EXCEPTION 'FALHOU: pedido não foi criado %', res; END IF;
  INSERT INTO t_ctx VALUES ('ped_novo', res->>'pedido_id');

  ok := false;
  BEGIN
    PERFORM trocar_contrato_linha_pedido_ceu((SELECT v::uuid FROM t_ctx WHERE k='l2'), (SELECT v::uuid FROM t_ctx WHERE k='sem_ped'), 'de novo');
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE 'A linha já está%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU: troca para o mesmo contrato aceita'; END IF;

  res := trocar_contrato_linha_pedido_ceu((SELECT v::uuid FROM t_ctx WHERE k='l2'), (SELECT v::uuid FROM t_ctx WHERE k='com_ped'), 'na verdade é deste');
  IF (res->>'pedido_criado')::boolean THEN RAISE EXCEPTION 'FALHOU: criou 2o pedido mensal %', res; END IF;
  INSERT INTO t_ctx VALUES ('ped_com', res->>'pedido_id');
END $t$;
reset role;

DO $t$ DECLARE p record;
BEGIN
  SELECT * INTO p FROM mat_pedidos WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='ped_novo');
  IF p.tipo <> 'mensal' OR p.competencia <> date '2026-12-01' OR p.status_produtos <> 'nao_se_aplica'
     OR p.contrato_id <> (SELECT v::uuid FROM t_ctx WHERE k='sem_ped') THEN
    RAISE EXCEPTION 'FALHOU: formato do pedido criado';
  END IF;
  -- ficou sem linhas depois da 2ª troca
  IF p.status_ceu <> 'nao_se_aplica' THEN RAISE EXCEPTION 'FALHOU: pedido vazio com status_ceu %', p.status_ceu; END IF;
  IF (SELECT pedido_id FROM ceu_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='l2')) <> (SELECT v::uuid FROM t_ctx WHERE k='ped_com') THEN
    RAISE EXCEPTION 'FALHOU: linha não está no pedido existente';
  END IF;
  IF (SELECT status_ceu FROM mat_pedidos WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='ped_com')) NOT IN ('conferido', 'em_atendimento') THEN
    RAISE EXCEPTION 'FALHOU: status do pedido destino';
  END IF;
  IF (SELECT count(*) FROM mat_comentarios WHERE linha_tabela = 'ceu_pedido_itens' AND linha_id = (SELECT v::uuid FROM t_ctx WHERE k='l2')) <> 4 THEN
    RAISE EXCEPTION 'FALHOU: comentários da troca (esperados 4)';
  END IF;
  IF (SELECT fora_da_equipe FROM ceu_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='l2')) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FALHOU: fora_da_equipe';
  END IF;
  -- permissões das funções
  IF has_function_privilege('anon', 'public.atender_e_lancar_linhas_pedido_ceu(jsonb, date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.trocar_contrato_linha_pedido_ceu(uuid, uuid, text, boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ceu_recalcular_status_pedido(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: EXECUTE indevido para anon/authenticated';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.atender_e_lancar_linhas_pedido_ceu(jsonb, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated sem EXECUTE';
  END IF;
  RAISE NOTICE 'TUDO OK (177)';
END $t$;

select 'TUDO OK (177)' as resultado;
