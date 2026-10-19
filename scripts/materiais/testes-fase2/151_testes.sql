-- ===== testes 151 (depois da 151, na mesma transação; SEMPRE com rollback) =====
-- Remanejado de outro posto, confirmação na tela Chegadas, cancelamento, desfazer destino
-- e pedido de implantação. Perfis reais: 6e49ec30 = gestor, 7619cc8f = mesa.
create temp table t_ctx(k text primary key, v text);
grant all on t_ctx to authenticated;
insert into t_ctx values
 ('forn', (select id::text from fornecedores where nome ilike 'compra avulsa%' limit 1)),
 ('ped', (select p.id::text from mat_pedidos p join mat_pedido_itens i on i.pedido_id=p.id
           where p.status_produtos='em_validacao' and p.competencia='2026-10-01' and i.item_id is not null
             and not exists (select 1 from mat_pedido_itens j where j.pedido_id=p.id and j.item_id is null)
             and not exists (select 1 from mat_pedido_itens j join mat_itens it on it.id=j.item_id where j.pedido_id=p.id and it.preparo_escritorio)
           group by p.id having count(*) >= 3 order by count(*) desc limit 1));
insert into t_ctx values
 ('ped2', (select p.id::text from mat_pedidos p join mat_pedido_itens i on i.pedido_id=p.id
           where p.status_produtos='em_validacao' and p.competencia='2026-10-01' and i.item_id is not null
             and p.id <> (select v::uuid from t_ctx where k='ped')
             and not exists (select 1 from mat_pedido_itens j where j.pedido_id=p.id and j.item_id is null)
             and not exists (select 1 from mat_pedido_itens j join mat_itens it on it.id=j.item_id where j.pedido_id=p.id and it.preparo_escritorio)
           group by p.id having count(*) >= 3 order by count(*) desc limit 1));
insert into t_ctx values
 ('origem', (select c.id::text from mat_contratos c where c.ativo
              and c.id not in (select contrato_id from mat_pedidos where id in (select v::uuid from t_ctx where k in ('ped', 'ped2')))
              order by c.nome limit 1));

-- 1) gestor valida e aprova o pedido
select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE p uuid := (select v::uuid from t_ctx where k='ped'); p2 uuid := (select v::uuid from t_ctx where k='ped2');
BEGIN
  IF p IS NULL OR p2 IS NULL THEN RAISE EXCEPTION 'FALHOU sem pedido de teste'; END IF;
  PERFORM validar_pedido_materiais(p, '[]'::jsonb, null);
  PERFORM aprovar_pedido_materiais(p, '[]'::jsonb);
  PERFORM validar_pedido_materiais(p2, '[]'::jsonb, null);
  PERFORM aprovar_pedido_materiais(p2, '[]'::jsonb);
  IF (SELECT status_produtos FROM mat_pedidos WHERE id = p) <> 'aprovado' THEN RAISE EXCEPTION 'FALHOU pedido nao aprovado'; END IF;
END $t$;
reset role;

-- 2) mesa: travas do remanejado e geração (linha A só remanejada; linha B dividida; resto fornecedor)
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$
DECLARE p uuid := (select v::uuid from t_ctx where k='ped'); f uuid := (select v::uuid from t_ctx where k='forn');
        o uuid := (select v::uuid from t_ctx where k='origem'); proprio uuid; a record; b record; r jsonb; ok boolean;
BEGIN
  SELECT contrato_id INTO proprio FROM mat_pedidos WHERE id = p;
  SELECT id, qtd_aprovada INTO a FROM mat_pedido_itens WHERE pedido_id = p AND qtd_aprovada > 0 ORDER BY id LIMIT 1;
  SELECT id, qtd_aprovada INTO b FROM mat_pedido_itens WHERE pedido_id = p AND qtd_aprovada > 0 AND id <> a.id ORDER BY qtd_aprovada DESC, id LIMIT 1;
  INSERT INTO t_ctx VALUES ('a', a.id::text), ('b', b.id::text);

  -- sem origem
  ok := false;
  BEGIN PERFORM mat_gerar_compras('2026-10-01','mensal', jsonb_build_array(jsonb_build_object('id', a.id, 'qtd_remanejada', a.qtd_aprovada)), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%de qual posto%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU remanejado sem origem aceito'; END IF;
  -- origem = o próprio posto
  ok := false;
  BEGIN PERFORM mat_gerar_compras('2026-10-01','mensal', jsonb_build_array(jsonb_build_object('id', a.id, 'qtd_remanejada', a.qtd_aprovada, 'remanejado_de_contrato_id', proprio)), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%próprio posto%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU remanejado do proprio posto aceito'; END IF;
  -- passa do aprovado
  ok := false;
  BEGIN PERFORM mat_gerar_compras('2026-10-01','mensal', jsonb_build_array(jsonb_build_object('id', a.id, 'qtd_remanejada', a.qtd_aprovada + 1, 'remanejado_de_contrato_id', o)), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%passa da quantidade aprovada%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU remanejado acima do aprovado aceito'; END IF;

  SELECT jsonb_agg(CASE
      WHEN l.id = a.id THEN jsonb_build_object('id', l.id, 'qtd_remanejada', l.qtd_aprovada, 'remanejado_de_contrato_id', o, 'remanejamento_obs', 'sobrou no posto')
      WHEN l.id = b.id AND l.qtd_aprovada >= 2 THEN jsonb_build_object('id', l.id, 'qtd_remanejada', 1, 'remanejado_de_contrato_id', o, 'qtd_compra', l.qtd_aprovada - 1, 'fornecedor_id', f)
      WHEN l.id = b.id THEN jsonb_build_object('id', l.id, 'qtd_remanejada', l.qtd_aprovada, 'remanejado_de_contrato_id', o)
      ELSE jsonb_build_object('id', l.id, 'qtd_compra', l.qtd_aprovada, 'fornecedor_id', f) END)
    INTO r FROM mat_pedido_itens l WHERE l.pedido_id = p AND l.qtd_aprovada > 0 AND l.atendimento IS NULL;
  r := mat_gerar_compras('2026-10-01', 'mensal', r, 'teste 151');
  INSERT INTO t_ctx VALUES ('ger', r::text);
  IF (SELECT atendimento FROM mat_pedido_itens WHERE id = a.id) <> 'remanejado' THEN RAISE EXCEPTION 'FALHOU linha A nao ficou remanejado'; END IF;
  IF (SELECT remanejado_de_contrato_id FROM mat_pedido_itens WHERE id = a.id) <> o THEN RAISE EXCEPTION 'FALHOU origem nao gravada'; END IF;
  IF (SELECT compra_item_id FROM mat_pedido_itens WHERE id = a.id) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU remanejado foi a compra'; END IF;
  -- remanejado nunca vira célula de compra: a soma das células do pedido = soma de qtd_compra
  IF (SELECT coalesce(sum(qtd_compra),0) FROM mat_pedido_itens WHERE pedido_id = p)
     <> (SELECT coalesce(sum(ci.quantidade),0) FROM mat_compra_itens ci WHERE ci.id IN (SELECT compra_item_id FROM mat_pedido_itens WHERE pedido_id = p)) THEN
    RAISE EXCEPTION 'FALHOU celulas de compra incluem remanejado'; END IF;
  -- estoque central não mexe
  IF EXISTS (SELECT 1 FROM mat_estoque_movimentos WHERE pedido_item_id IN (a.id, b.id)) THEN RAISE EXCEPTION 'FALHOU remanejado mexeu no estoque'; END IF;
  -- tentar mudar o destino direto (guarda)
  -- (RLS pode filtrar a linha sem erro; o que importa é o valor não mudar)
  BEGIN UPDATE mat_pedido_itens SET qtd_remanejada = NULL, remanejado_de_contrato_id = NULL WHERE id = a.id;
  EXCEPTION WHEN others THEN NULL; END;
  IF (SELECT qtd_remanejada FROM mat_pedido_itens WHERE id = a.id) IS NULL THEN RAISE EXCEPTION 'FALHOU update direto do remanejado aceito'; END IF;
  -- envia as compras desta geração
  FOR r IN SELECT * FROM jsonb_array_elements((SELECT v::jsonb FROM t_ctx WHERE k='ger')->'compras') LOOP
    PERFORM mat_enviar_compra((r->>'id')::uuid, null);
  END LOOP;
  IF (SELECT status_produtos FROM mat_pedidos WHERE id = p) <> 'em_compra' THEN RAISE EXCEPTION 'FALHOU nao foi em_compra'; END IF;
  -- leitura da tela Chegadas
  r := mat_chegadas('2026-10-01');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'remanejamentos') x WHERE (x->>'linha_id')::uuid = a.id AND x->>'origem_id' = o::text) THEN
    RAISE EXCEPTION 'FALHOU mat_chegadas sem o remanejamento'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'pedidos') x WHERE (x->>'pedido_id')::uuid = p) THEN
    RAISE EXCEPTION 'FALHOU mat_chegadas sem o pedido'; END IF;
  -- chegada completa das células deste pedido: o pedido continua em_compra (remanejado não confirmado)
  FOR r IN SELECT jsonb_build_object('compra', ci.compra_id, 'itens', jsonb_agg(jsonb_build_object('id', ci.id, 'qtd_recebida', ci.quantidade)))
             FROM mat_compra_itens ci WHERE ci.id IN (SELECT compra_item_id FROM mat_pedido_itens WHERE pedido_id = p) GROUP BY ci.compra_id LOOP
    PERFORM mat_registrar_chegada((r->>'compra')::uuid, r->'itens', null);
  END LOOP;
  IF (SELECT status_produtos FROM mat_pedidos WHERE id = p) <> 'em_compra' THEN
    RAISE EXCEPTION 'FALHOU pedido fechou sem confirmar o remanejamento (%)', (SELECT status_produtos FROM mat_pedidos WHERE id = p); END IF;
  -- confirmar menos sem motivo: recusa
  ok := false;
  BEGIN PERFORM mat_confirmar_remanejamento(jsonb_build_array(jsonb_build_object('id', a.id, 'qtd', 0)), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%motivo%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU confirmacao menor sem motivo aceita'; END IF;
  -- confirmar acima: recusa
  ok := false;
  BEGIN PERFORM mat_confirmar_remanejamento(jsonb_build_array(jsonb_build_object('id', a.id, 'qtd', 999)), null);
  EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU confirmacao acima aceita'; END IF;
  -- confirma tudo: entregue
  PERFORM mat_confirmar_remanejamento(
    (SELECT jsonb_agg(jsonb_build_object('id', id)) FROM mat_pedido_itens WHERE pedido_id = p AND qtd_remanejada > 0), null);
  IF (SELECT qtd_entregue FROM mat_pedido_itens WHERE id = b.id) <> (SELECT qtd_aprovada FROM mat_pedido_itens WHERE id = b.id) THEN
    RAISE EXCEPTION 'FALHOU linha dividida nao somou fornecedor + remanejado'; END IF;
  IF (SELECT status_produtos FROM mat_pedidos WHERE id = p) <> 'entregue' THEN
    RAISE EXCEPTION 'FALHOU pedido nao ficou entregue (%)', (SELECT status_produtos FROM mat_pedidos WHERE id = p); END IF;
END $t$;
reset role;

-- 3) mesa: cancelar a compra devolve também o remanejado; desfazer destino sem compra
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$
DECLARE f uuid := (select v::uuid from t_ctx where k='forn'); o uuid := (select v::uuid from t_ctx where k='origem');
        r jsonb; ids uuid[]; x uuid; n0 int; ok boolean; v_comp uuid;
BEGIN
  SELECT array_agg((e->>'linha_id')::uuid ORDER BY e->>'linha_id') INTO ids
    FROM jsonb_array_elements(mat_previa_compra('2026-10-01')->'linhas') e
   WHERE e->>'pedido_id' = (select v from t_ctx where k='ped2') AND e->>'contrato_id' <> o::text;
  IF coalesce(array_length(ids, 1), 0) < 3 THEN RAISE EXCEPTION 'FALHOU poucas linhas na previa para o teste (%)', coalesce(array_length(ids, 1), 0); END IF;
  n0 := jsonb_array_length(mat_previa_compra('2026-10-01')->'linhas');
  -- 1ª linha remanejada (sem compra), demais ao fornecedor (avulsa)
  SELECT jsonb_agg(CASE WHEN l.id = ids[1]
           THEN jsonb_build_object('id', l.id, 'qtd_remanejada', l.qtd_aprovada, 'remanejado_de_contrato_id', o)
           ELSE jsonb_build_object('id', l.id, 'qtd_compra', l.qtd_aprovada, 'fornecedor_id', f) END)
    INTO r FROM mat_pedido_itens l WHERE l.id = ANY (ids[1:3]);
  r := mat_gerar_compras('2026-10-01', 'avulsa', r, null);
  v_comp := (r->'compras'->0->>'id')::uuid;
  IF (SELECT atendimento FROM mat_pedido_itens WHERE id = ids[1]) <> 'remanejado' THEN RAISE EXCEPTION 'FALHOU cenario cancelamento'; END IF;
  PERFORM mat_cancelar_compra(v_comp, 'gerei errado');
  IF EXISTS (SELECT 1 FROM mat_pedido_itens WHERE id = ANY (ids[1:3]) AND (atendimento IS NOT NULL OR qtd_remanejada IS NOT NULL OR remanejado_de_contrato_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'FALHOU cancelamento nao devolveu o remanejado'; END IF;
  IF jsonb_array_length(mat_previa_compra('2026-10-01')->'linhas') <> n0 THEN RAISE EXCEPTION 'FALHOU previa nao voltou ao tamanho original'; END IF;

  -- geração só com remanejado (nenhuma compra): desfazer pelo mat_desfazer_destino_linha
  r := mat_gerar_compras('2026-10-01', 'mensal',
         jsonb_build_array(jsonb_build_object('id', ids[2], 'qtd_remanejada', (SELECT qtd_aprovada FROM mat_pedido_itens WHERE id = ids[2]), 'remanejado_de_contrato_id', o)), null);
  IF jsonb_array_length(r->'compras') <> 0 THEN RAISE EXCEPTION 'FALHOU remanejado puro criou compra'; END IF;
  ok := false;
  BEGIN PERFORM mat_desfazer_destino_linha(ids[2], ''); EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU desfazer sem motivo aceito'; END IF;
  PERFORM mat_desfazer_destino_linha(ids[2], 'era de outro posto');
  IF (SELECT atendimento FROM mat_pedido_itens WHERE id = ids[2]) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU desfazer nao limpou'; END IF;
  -- linha em compra: desfazer recusado
  r := mat_gerar_compras('2026-10-01', 'avulsa',
         jsonb_build_array(jsonb_build_object('id', ids[3], 'qtd_compra', (SELECT qtd_aprovada FROM mat_pedido_itens WHERE id = ids[3]), 'fornecedor_id', f)), null);
  ok := false;
  BEGIN PERFORM mat_desfazer_destino_linha(ids[3], 'teste'); EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%cancele a compra%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU desfazer linha em compra aceito'; END IF;
END $t$;
reset role;

-- 4) implantação: pedido extra do escritório com a marca; mensal com a marca é recusado
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE c uuid := (select v::uuid from t_ctx where k='origem'); pid uuid; ok boolean;
BEGIN
  INSERT INTO mat_pedidos (contrato_id, competencia, tipo, origem, status_produtos, status_ceu, criado_por, implantacao, implantacao_inicio)
  VALUES (c, '2026-10-01', 'extra', 'operacional', 'rascunho', 'nao_se_aplica', auth.uid(), true, '2026-11-03')
  RETURNING id INTO pid;
  IF NOT (SELECT implantacao FROM mat_pedidos WHERE id = pid) THEN RAISE EXCEPTION 'FALHOU implantacao nao gravada'; END IF;
  ok := false;
  BEGIN
    INSERT INTO mat_pedidos (contrato_id, competencia, tipo, origem, status_produtos, status_ceu, criado_por, implantacao_inicio)
    VALUES (c, '2026-10-01', 'extra', 'operacional', 'rascunho', 'nao_se_aplica', auth.uid(), '2026-11-03');
  EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU data de inicio sem implantacao aceita'; END IF;
END $t$;
reset role;
DO $t$ DECLARE ok boolean := false;
BEGIN
  BEGIN UPDATE mat_pedidos SET implantacao = true WHERE tipo = 'mensal' AND competencia = '2026-10-01';
  EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU implantacao em pedido mensal aceita'; END IF;
END $t$;
-- guarda da 147 com as colunas novas (sem RLS, como dono): UPDATE direto recusado
DO $t$ DECLARE ok boolean := false; a uuid := (select v::uuid from t_ctx where k='a');
BEGIN
  BEGIN UPDATE mat_pedido_itens SET qtd_entregue_remanejada = 0 WHERE id = a;
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%só mudam pelas telas%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU guarda nao protege as colunas do remanejado'; END IF;
END $t$;
