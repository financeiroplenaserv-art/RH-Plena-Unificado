-- ===== testes 152 (depois da 152, na mesma transação; SEMPRE com rollback) =====
-- Múltiplo de compra (arredonda para cima, sobra no estoque), item fracionado no
-- escritório, "comprar a mais para o estoque", recálculo sem acumular, envio
-- congelado, chegada + separação e cancelamento com lote dividido.
-- Perfis reais: 6e49ec30 = gestor, 7619cc8f = mesa.
create temp table t_ctx(k text primary key, v text);
grant all on t_ctx to authenticated;
insert into t_ctx values
 ('forn', (select id::text from fornecedores where nome ilike 'compra avulsa%' limit 1)),
 ('ped', (select p.id::text from mat_pedidos p join mat_pedido_itens i on i.pedido_id=p.id
           join mat_itens it on it.id = i.item_id and not it.preparo_escritorio
           where p.status_produtos='em_validacao' and p.competencia='2026-10-01'
           group by p.id having count(distinct i.item_id) >= 3 order by count(distinct i.item_id) desc, p.id limit 1));
insert into t_ctx values
 ('ped2', (select p.id::text from mat_pedidos p join mat_pedido_itens i on i.pedido_id=p.id
           join mat_itens it on it.id = i.item_id and not it.preparo_escritorio
           where p.status_produtos='em_validacao' and p.competencia='2026-10-01'
             and p.id <> (select v::uuid from t_ctx where k='ped')
           group by p.id having count(distinct i.item_id) >= 2 order by count(distinct i.item_id) desc, p.id limit 1)),
 ('forn2', (select id::text from fornecedores where nome not ilike 'compra avulsa%' order by nome limit 1));

-- 0) constraints do item (como dono)
DO $t$ DECLARE ok boolean; i uuid := (select id from mat_itens where not preparo_escritorio order by nome limit 1);
       pe uuid := (select id from mat_itens where preparo_escritorio limit 1);
BEGIN
  IF (SELECT count(*) FROM mat_itens WHERE fator_compra <> 1 OR fracionado_escritorio) <> 0 THEN
    RAISE EXCEPTION 'FALHOU item nasceu com fator/fracionado'; END IF;
  ok := false;
  BEGIN UPDATE mat_itens SET fator_compra = 4 WHERE id = i; EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU fator > 1 sem unidade de compra aceito'; END IF;
  ok := false;
  BEGIN UPDATE mat_itens SET fator_compra = 0, unidade_compra = 'caixa' WHERE id = i; EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU fator 0 aceito'; END IF;
  IF pe IS NOT NULL THEN
    ok := false;
    BEGIN UPDATE mat_itens SET fracionado_escritorio = true WHERE id = pe; EXCEPTION WHEN check_violation THEN ok := true; END;
    IF NOT ok THEN RAISE EXCEPTION 'FALHOU fracionado + preparo no escritório aceito'; END IF;
  END IF;
END $t$;

-- 1) gestor valida e aprova os dois pedidos
select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE p uuid := (select v::uuid from t_ctx where k='ped'); p2 uuid := (select v::uuid from t_ctx where k='ped2');
BEGIN
  IF p IS NULL OR p2 IS NULL THEN RAISE EXCEPTION 'FALHOU sem pedido de teste'; END IF;
  PERFORM validar_pedido_materiais(p, '[]'::jsonb, null);
  PERFORM aprovar_pedido_materiais(p, '[]'::jsonb);
  PERFORM validar_pedido_materiais(p2, '[]'::jsonb, null);
  PERFORM aprovar_pedido_materiais(p2, '[]'::jsonb);
END $t$;
reset role;

-- 2) escolhe 3 linhas de itens diferentes e configura (como dono): A kit c/ 100, B bombona 5L fracionado, C fator 1
DO $t$ DECLARE p uuid := (select v::uuid from t_ctx where k='ped'); r record; n int := 0;
BEGIN
  FOR r IN SELECT DISTINCT ON (l.item_id) l.id, l.item_id FROM mat_pedido_itens l
             JOIN mat_itens it ON it.id = l.item_id AND NOT it.preparo_escritorio
            WHERE l.pedido_id = p AND l.qtd_aprovada > 0 AND l.atendimento IS NULL
              AND (l.variacao_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM mat_item_variacoes v WHERE v.item_id = l.item_id AND v.ativo))
            ORDER BY l.item_id, l.id LIMIT 3 LOOP
    n := n + 1;
    INSERT INTO t_ctx VALUES (chr(96 + n), r.id::text);
  END LOOP;
  IF n < 3 THEN RAISE EXCEPTION 'FALHOU poucas linhas aprovadas (%)', n; END IF;
  UPDATE mat_itens SET fator_compra = 100, unidade_compra = 'kit'
   WHERE id = (SELECT item_id FROM mat_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='a'));
  UPDATE mat_itens SET fator_compra = 5, unidade_compra = 'bombona 5L', fracionado_escritorio = true
   WHERE id = (SELECT item_id FROM mat_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='b'));
END $t$;

-- 3) mesa gera: A, B e C ao fornecedor + 7 a mais de C para o estoque
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$
DECLARE f uuid := (select v::uuid from t_ctx where k='forn');
        a mat_pedido_itens%ROWTYPE; b mat_pedido_itens%ROWTYPE; c mat_pedido_itens%ROWTYPE;
        r jsonb; v_comp uuid; cel mat_compra_itens%ROWTYPE; ok boolean; previa jsonb;
BEGIN
  SELECT * INTO a FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='a');
  SELECT * INTO b FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='b');
  SELECT * INTO c FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='c');

  -- prévia traz o fator/unidade/fracionado
  previa := mat_previa_compra('2026-10-01');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(previa->'linhas') x
                  WHERE (x->>'linha_id')::uuid = a.id AND (x->>'fator_compra')::int = 100 AND x->>'unidade_compra' = 'kit') THEN
    RAISE EXCEPTION 'FALHOU previa sem fator/unidade de compra'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(previa->'linhas') x
                  WHERE (x->>'linha_id')::uuid = b.id AND (x->>'fracionado_escritorio')::boolean) THEN
    RAISE EXCEPTION 'FALHOU previa sem fracionado'; END IF;

  -- travas do "a mais para o estoque"
  ok := false;
  BEGIN PERFORM mat_gerar_compras('2026-10-01', 'mensal', null, null,
          jsonb_build_array(jsonb_build_object('item_id', c.item_id, 'variacao_id', c.variacao_id, 'quantidade', 0, 'fornecedor_id', f)));
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%inválida%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU a mais com quantidade 0 aceito'; END IF;
  ok := false;
  BEGIN PERFORM mat_gerar_compras('2026-10-01', 'mensal', null, null,
          jsonb_build_array(jsonb_build_object('item_id', c.item_id, 'variacao_id', c.variacao_id, 'quantidade', 2)));
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%fornecedor%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU a mais sem fornecedor aceito'; END IF;
  ok := false;
  BEGIN PERFORM mat_gerar_compras('2026-10-01', 'mensal', '[]'::jsonb, null, '[]'::jsonb);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%Nenhuma linha%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU geracao vazia aceita'; END IF;
  -- função interna não é exposta
  ok := false;
  BEGIN PERFORM mat_arredondar_compra(gen_random_uuid()); EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU mat_arredondar_compra exposta a authenticated'; END IF;

  r := mat_gerar_compras('2026-10-01', 'mensal',
         jsonb_build_array(
           jsonb_build_object('id', a.id, 'qtd_compra', a.qtd_aprovada, 'fornecedor_id', f),
           jsonb_build_object('id', b.id, 'qtd_compra', b.qtd_aprovada, 'fornecedor_id', f),
           jsonb_build_object('id', c.id, 'qtd_compra', c.qtd_aprovada, 'fornecedor_id', f)),
         'teste 152',
         jsonb_build_array(jsonb_build_object('item_id', c.item_id, 'variacao_id', c.variacao_id, 'quantidade', 7, 'fornecedor_id', f)));
  IF (r->>'reposicao')::int <> 1 OR jsonb_array_length(r->'compras') <> 1 THEN RAISE EXCEPTION 'FALHOU retorno %', r; END IF;
  v_comp := (r->'compras'->0->>'id')::uuid;
  INSERT INTO t_ctx VALUES ('comp', v_comp::text);

  -- A: célula do posto = aprovado; estoque = sobra até o múltiplo de 100
  SELECT * INTO cel FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = a.item_id
     AND variacao_id IS NOT DISTINCT FROM a.variacao_id AND contrato_id IS NOT NULL;
  IF cel.quantidade <> a.qtd_aprovada OR cel.fator_compra <> 100 OR cel.unidade_compra <> 'kit' THEN
    RAISE EXCEPTION 'FALHOU celula do posto de A (% / % / %)', cel.quantidade, cel.fator_compra, cel.unidade_compra; END IF;
  SELECT * INTO cel FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = a.item_id
     AND variacao_id IS NOT DISTINCT FROM a.variacao_id AND contrato_id IS NULL;
  IF cel.quantidade <> ceil(a.qtd_aprovada / 100.0) * 100 - a.qtd_aprovada
     OR cel.qtd_arredondamento <> cel.quantidade OR cel.entrega_local <> 'escritorio' THEN
    RAISE EXCEPTION 'FALHOU sobra de A no estoque (qtd % arred %, aprovado %)', cel.quantidade, cel.qtd_arredondamento, a.qtd_aprovada; END IF;
  IF (SELECT sum(quantidade) FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = a.item_id) % 100 <> 0 THEN
    RAISE EXCEPTION 'FALHOU total de A nao e multiplo de 100'; END IF;

  -- B (fracionado): nenhuma célula de posto; estoque = teto ao múltiplo de 5; linha vai para 'estoque'
  IF EXISTS (SELECT 1 FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = b.item_id AND contrato_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU fracionado criou celula de posto'; END IF;
  SELECT * INTO cel FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = b.item_id
     AND variacao_id IS NOT DISTINCT FROM b.variacao_id AND contrato_id IS NULL;
  IF cel.quantidade <> ceil(b.qtd_aprovada / 5.0) * 5 OR cel.qtd_fracionar <> b.qtd_aprovada
     OR cel.qtd_arredondamento <> cel.quantidade - b.qtd_aprovada THEN
    RAISE EXCEPTION 'FALHOU celula do fracionado (qtd % frac % arred %, aprovado %)', cel.quantidade, cel.qtd_fracionar, cel.qtd_arredondamento, b.qtd_aprovada; END IF;
  SELECT * INTO b FROM mat_pedido_itens WHERE id = b.id;
  IF b.atendimento <> 'estoque' OR b.qtd_estoque <> b.qtd_aprovada OR b.qtd_compra IS NOT NULL OR b.compra_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'FALHOU linha fracionada (% / % / %)', b.atendimento, b.qtd_estoque, b.qtd_compra; END IF;

  -- C (fator 1): posto = aprovado; estoque = só os 7 a mais, sem arredondamento
  SELECT * INTO cel FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = c.item_id
     AND variacao_id IS NOT DISTINCT FROM c.variacao_id AND contrato_id IS NULL;
  IF cel.quantidade <> 7 OR cel.qtd_arredondamento <> 0 THEN RAISE EXCEPTION 'FALHOU a mais de C (% / %)', cel.quantidade, cel.qtd_arredondamento; END IF;
  IF (SELECT atendimento FROM mat_pedido_itens WHERE id = c.id) <> 'fornecedor' THEN RAISE EXCEPTION 'FALHOU destino de C'; END IF;

  -- 2ª geração no MESMO rascunho: +5 de A para o estoque → sobra recalculada (não acumula)
  r := mat_gerar_compras('2026-10-01', 'mensal', null, null,
         jsonb_build_array(jsonb_build_object('item_id', a.item_id, 'variacao_id', a.variacao_id, 'quantidade', 5, 'fornecedor_id', f)));
  IF (r->'compras'->0->>'id')::uuid <> v_comp THEN RAISE EXCEPTION 'FALHOU nao reaproveitou o rascunho'; END IF;
  SELECT * INTO cel FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = a.item_id
     AND variacao_id IS NOT DISTINCT FROM a.variacao_id AND contrato_id IS NULL;
  IF cel.qtd_arredondamento <> ceil((a.qtd_aprovada + 5) / 100.0) * 100 - a.qtd_aprovada - 5
     OR cel.quantidade <> 5 + cel.qtd_arredondamento THEN
    RAISE EXCEPTION 'FALHOU recalculo da sobra (qtd % arred %)', cel.quantidade, cel.qtd_arredondamento; END IF;
  IF (SELECT sum(quantidade) FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = a.item_id) % 100 <> 0 THEN
    RAISE EXCEPTION 'FALHOU total de A deixou de ser multiplo de 100'; END IF;

  -- envia: congela
  PERFORM mat_enviar_compra(v_comp, null);
END $t$;
reset role;

-- 4) como dono: a compra enviada não é mais arredondada (mudar o fator não mexe)
DO $t$ DECLARE v_comp uuid := (select v::uuid from t_ctx where k='comp'); antes numeric; a uuid := (select v::uuid from t_ctx where k='a');
BEGIN
  SELECT sum(quantidade) INTO antes FROM mat_compra_itens WHERE compra_id = v_comp;
  UPDATE mat_itens SET fator_compra = 12, unidade_compra = 'caixa' WHERE id = (SELECT item_id FROM mat_pedido_itens WHERE id = a);
  IF mat_arredondar_compra(v_comp) <> 0 THEN RAISE EXCEPTION 'FALHOU arredondou compra enviada'; END IF;
  IF (SELECT sum(quantidade) FROM mat_compra_itens WHERE compra_id = v_comp) <> antes THEN RAISE EXCEPTION 'FALHOU compra enviada mudou'; END IF;
  IF EXISTS (SELECT 1 FROM mat_compra_itens WHERE compra_id = v_comp AND fator_compra = 12) THEN RAISE EXCEPTION 'FALHOU snapshot mudou'; END IF;
END $t$;

-- 5) mesa: chegada completa → estoque recebe as células de reposição; separa a linha fracionada
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE v_comp uuid := (select v::uuid from t_ctx where k='comp'); b mat_pedido_itens%ROWTYPE; saldo0 numeric; cel mat_compra_itens%ROWTYPE;
BEGIN
  SELECT * INTO b FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='b');
  saldo0 := coalesce(mat_saldo_estoque(b.item_id, b.variacao_id), 0);
  SELECT * INTO cel FROM mat_compra_itens WHERE compra_id = v_comp AND item_id = b.item_id AND contrato_id IS NULL;
  PERFORM mat_registrar_chegada(v_comp,
    (SELECT jsonb_agg(jsonb_build_object('id', id, 'qtd_recebida', quantidade)) FROM mat_compra_itens WHERE compra_id = v_comp), null);
  IF (SELECT status FROM mat_compras WHERE id = v_comp) <> 'recebida' THEN RAISE EXCEPTION 'FALHOU compra nao recebida'; END IF;
  IF coalesce(mat_saldo_estoque(b.item_id, b.variacao_id), 0) <> saldo0 + cel.quantidade THEN
    RAISE EXCEPTION 'FALHOU estoque nao recebeu a bombona (% -> %)', saldo0, mat_saldo_estoque(b.item_id, b.variacao_id); END IF;
  PERFORM mat_registrar_separacao(jsonb_build_array(jsonb_build_object('id', b.id)), null);
  IF (SELECT qtd_entregue FROM mat_pedido_itens WHERE id = b.id) <> b.qtd_aprovada THEN RAISE EXCEPTION 'FALHOU separacao do fracionado'; END IF;
  IF coalesce(mat_saldo_estoque(b.item_id, b.variacao_id), 0) <> saldo0 + cel.quantidade - b.qtd_aprovada THEN
    RAISE EXCEPTION 'FALHOU saldo depois da separacao'; END IF;
END $t$;
reset role;

-- 6) cancelamento com lote dividido: X (fracionado) no fornecedor 1, Y no fornecedor 2, mesma chamada.
--    Cancelar a compra do fornecedor 1 devolve X à prévia; Y e a outra compra ficam.
DO $t$ DECLARE p2 uuid := (select v::uuid from t_ctx where k='ped2'); r record; n int := 0;
BEGIN
  FOR r IN SELECT DISTINCT ON (l.item_id) l.id, l.item_id FROM mat_pedido_itens l
             JOIN mat_itens it ON it.id = l.item_id AND NOT it.preparo_escritorio
            WHERE l.pedido_id = p2 AND l.qtd_aprovada > 0 AND l.atendimento IS NULL
              AND (l.variacao_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM mat_item_variacoes v WHERE v.item_id = l.item_id AND v.ativo))
              AND l.item_id NOT IN (SELECT item_id FROM mat_pedido_itens WHERE id IN (SELECT v::uuid FROM t_ctx WHERE k IN ('a','b','c')))
            ORDER BY l.item_id, l.id LIMIT 2 LOOP
    n := n + 1;
    INSERT INTO t_ctx VALUES (CASE n WHEN 1 THEN 'x' ELSE 'y' END, r.id::text);
  END LOOP;
  IF n < 2 THEN RAISE EXCEPTION 'FALHOU poucas linhas no ped2 (%)', n; END IF;
  UPDATE mat_itens SET fator_compra = 5, unidade_compra = 'bombona 5L', fracionado_escritorio = true
   WHERE id = (SELECT item_id FROM mat_pedido_itens WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='x'));
END $t$;
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$
DECLARE f uuid := (select v::uuid from t_ctx where k='forn'); f2 uuid := (select v::uuid from t_ctx where k='forn2');
        x uuid := (select v::uuid from t_ctx where k='x'); y uuid := (select v::uuid from t_ctx where k='y');
        r jsonb; c1 uuid; c2 uuid;
BEGIN
  r := mat_gerar_compras('2026-10-01', 'avulsa', jsonb_build_array(
         jsonb_build_object('id', x, 'qtd_compra', (SELECT qtd_aprovada FROM mat_pedido_itens WHERE id = x), 'fornecedor_id', f),
         jsonb_build_object('id', y, 'qtd_compra', (SELECT qtd_aprovada FROM mat_pedido_itens WHERE id = y), 'fornecedor_id', f2)), null);
  IF jsonb_array_length(r->'compras') <> 2 THEN RAISE EXCEPTION 'FALHOU esperava 2 compras: %', r; END IF;
  SELECT (e->>'id')::uuid INTO c1 FROM jsonb_array_elements(r->'compras') e WHERE (e->>'fornecedor_id')::uuid = f;
  SELECT (e->>'id')::uuid INTO c2 FROM jsonb_array_elements(r->'compras') e WHERE (e->>'fornecedor_id')::uuid = f2;
  IF (SELECT atendimento FROM mat_pedido_itens WHERE id = x) <> 'estoque' THEN RAISE EXCEPTION 'FALHOU X nao foi estoque'; END IF;
  PERFORM mat_cancelar_compra(c1, 'teste 152');
  IF (SELECT atendimento FROM mat_pedido_itens WHERE id = x) IS NOT NULL THEN RAISE EXCEPTION 'FALHOU cancelar nao devolveu o fracionado'; END IF;
  IF (SELECT atendimento FROM mat_pedido_itens WHERE id = y) <> 'fornecedor' THEN RAISE EXCEPTION 'FALHOU Y foi mexido'; END IF;
  IF (SELECT status FROM mat_compras WHERE id = c2) <> 'rascunho' THEN RAISE EXCEPTION 'FALHOU outra compra mexida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(mat_previa_compra('2026-10-01')->'linhas') e WHERE (e->>'linha_id')::uuid = x) THEN
    RAISE EXCEPTION 'FALHOU X nao voltou para a previa'; END IF;
END $t$;
reset role;

-- 7) mat_gerar_compra_reposicao também arredonda (como gestor)
select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE f uuid := (select v::uuid from t_ctx where k='forn'); x mat_pedido_itens%ROWTYPE; r jsonb;
BEGIN
  SELECT * INTO x FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='x');
  r := mat_gerar_compra_reposicao(f, jsonb_build_array(jsonb_build_object('item_id', x.item_id, 'variacao_id', x.variacao_id, 'quantidade', 3)), null);
  IF (SELECT quantidade FROM mat_compra_itens WHERE compra_id = (r->>'id')::uuid AND item_id = x.item_id) <> 5 THEN
    RAISE EXCEPTION 'FALHOU reposicao avulsa nao arredondou'; END IF;
END $t$;
reset role;
