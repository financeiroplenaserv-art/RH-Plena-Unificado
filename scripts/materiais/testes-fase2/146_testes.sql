-- ===== testes 146 =====
create temp table t_ctx(k text primary key, v text);
grant all on t_ctx to authenticated;
insert into t_ctx values
 ('item', (select id::text from mat_itens it where ativo and not preparo_escritorio and not exists (select 1 from mat_item_variacoes v where v.item_id=it.id and v.ativo) order by nome limit 1)),
 ('itemvar', (select it.id::text from mat_itens it where ativo and exists (select 1 from mat_item_variacoes v where v.item_id=it.id and v.ativo) order by nome limit 1)),
 ('prep', (select id::text from mat_itens where preparo_escritorio limit 1));

DO $t$ BEGIN
  BEGIN
    INSERT INTO mat_estoque_movimentos(item_id,tipo,quantidade,motivo) VALUES ((select v::uuid from t_ctx where k='item'),'saida_avulsa',3,'x');
    RAISE EXCEPTION 'FALHOU: sinal errado aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $t$;

select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE r jsonb; i uuid := (select v::uuid from t_ctx where k='item'); m uuid; c jsonb; n numeric;
BEGIN
  BEGIN
    INSERT INTO mat_estoque_movimentos(item_id,tipo,quantidade,motivo) VALUES (i,'entrada_sobra',1,'x');
    RAISE EXCEPTION 'FALHOU: insert direto aceito';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  r := mat_registrar_movimento_estoque('entrada_sobra', i, null, 5, null, 'sobra do posto', null);
  IF (r->>'saldo')::numeric <> 5 THEN RAISE EXCEPTION 'FALHOU saldo 5: %', r; END IF;
  m := (r->>'id')::uuid;
  r := mat_registrar_movimento_estoque('saida_avulsa', i, null, 7, null, 'emprestimo', null);
  IF (r->>'saldo')::numeric <> -2 OR NOT (r->>'saldo_negativo')::boolean THEN RAISE EXCEPTION 'FALHOU saldo -2: %', r; END IF;
  BEGIN PERFORM mat_registrar_movimento_estoque('entrada_sobra', i, null, 1, null, '  ', null); RAISE EXCEPTION 'FALHOU sem motivo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN PERFORM mat_registrar_movimento_estoque('entrada_sobra', (select v::uuid from t_ctx where k='prep'), null, 1, null, 'x', null); RAISE EXCEPTION 'FALHOU preparo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN PERFORM mat_registrar_movimento_estoque('entrada_sobra', (select v::uuid from t_ctx where k='itemvar'), null, 1, null, 'x', null); RAISE EXCEPTION 'FALHOU variacao';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  r := mat_estornar_movimento(m, 'lancado errado');
  IF (r->>'saldo')::numeric <> -7 THEN RAISE EXCEPTION 'FALHOU estorno saldo: %', r; END IF;
  BEGIN PERFORM mat_estornar_movimento(m, 'de novo'); RAISE EXCEPTION 'FALHOU estorno duplo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN PERFORM mat_estornar_movimento((r->>'id')::uuid, 'x'); RAISE EXCEPTION 'FALHOU estorno de estorno';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  c := mat_abrir_contagem('2026-11-01', '2026-11-18');
  IF (c->>'itens')::int < 50 THEN RAISE EXCEPTION 'FALHOU poucos itens na contagem: %', c; END IF;
  BEGIN PERFORM mat_abrir_contagem('2026-11-01', null); RAISE EXCEPTION 'FALHOU duas abertas';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN PERFORM mat_fechar_contagem((c->>'id')::uuid); RAISE EXCEPTION 'FALHOU fechar sem contar';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  PERFORM mat_salvar_contagem((c->>'id')::uuid, (select jsonb_agg(jsonb_build_object('id',id,'quantidade_contada', case when item_id=i then 3 else saldo_sistema end)) from mat_estoque_contagem_itens where contagem_id=(c->>'id')::uuid));
  PERFORM mat_registrar_movimento_estoque('saida_avulsa', i, null, 1, null, 'saiu no meio', null);
  BEGIN PERFORM mat_fechar_contagem((c->>'id')::uuid); RAISE EXCEPTION 'FALHOU fechar sem motivo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  PERFORM mat_salvar_contagem((c->>'id')::uuid, (select jsonb_agg(jsonb_build_object('id',id,'quantidade_contada',3,'motivo','achado na prateleira')) from mat_estoque_contagem_itens where contagem_id=(c->>'id')::uuid and item_id=i));
  r := mat_fechar_contagem((c->>'id')::uuid);
  IF (r->>'ajustes')::int <> 1 THEN RAISE EXCEPTION 'FALHOU ajustes: %', r; END IF;
  IF mat_saldo_estoque(i, null) <> 3 THEN RAISE EXCEPTION 'FALHOU saldo apos contagem %', mat_saldo_estoque(i,null); END IF;
  SELECT ajuste INTO n FROM mat_estoque_contagem_itens WHERE contagem_id=(c->>'id')::uuid AND item_id=i;
  IF n <> 11 THEN RAISE EXCEPTION 'FALHOU ajuste esperado 11, veio %', n; END IF;
  IF (SELECT saldo FROM mat_estoque_saldos WHERE item_id=i) <> 3 THEN RAISE EXCEPTION 'FALHOU view saldo'; END IF;
  BEGIN PERFORM mat_estornar_movimento((select id from mat_estoque_movimentos where contagem_id=(c->>'id')::uuid limit 1), 'x'); RAISE EXCEPTION 'FALHOU estorno ajuste';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
END $t$;
reset role;

DO $t$ BEGIN
  BEGIN UPDATE mat_estoque_movimentos SET motivo='y'; RAISE EXCEPTION 'FALHOU update';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM mat_estoque_movimentos; RAISE EXCEPTION 'FALHOU delete';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
END $t$;

select set_config('request.jwt.claims','{"sub":"a8926112-39b0-4335-9017-a21eaf4c1b85","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE i uuid := (select v::uuid from t_ctx where k='item');
BEGIN
  BEGIN PERFORM mat_registrar_movimento_estoque('saida_avulsa', i, null, 1, null, 'x', null); RAISE EXCEPTION 'FALHOU inspetoria saida';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  PERFORM mat_registrar_movimento_estoque('entrada_devolucao', i, null, 2, null, 'trouxe do posto', null);
  IF NOT EXISTS (SELECT 1 FROM mat_estoque_movimentos WHERE tipo='entrada_devolucao') THEN RAISE EXCEPTION 'FALHOU leitura inspetoria'; END IF;
END $t$;
select set_config('request.jwt.claims','{"sub":"288f0044-d690-45c9-ba6d-6a56090871d3","role":"authenticated"}',true);
DO $t$ BEGIN
  IF EXISTS (SELECT 1 FROM mat_estoque_movimentos) THEN RAISE EXCEPTION 'FALHOU financeiro ve movimentos'; END IF;
  IF NOT pode_ver_compras_materiais() THEN RAISE EXCEPTION 'FALHOU financeiro ver compras'; END IF;
  IF pode_comprar_materiais() THEN RAISE EXCEPTION 'FALHOU financeiro compra'; END IF;
END $t$;
reset role;
