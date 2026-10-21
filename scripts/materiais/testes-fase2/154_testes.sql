-- ===== testes 154 (depois da 154, na mesma transação; SEMPRE com rollback) =====
-- Fornecedor que entrega no depósito da Plena: rota 0 "Depósito Plena", snapshot do flag,
-- chegada no depósito que NÃO conta como entrega, separação por posto (inspetoria),
-- "levar do depósito" e compra de fornecedor comum inalterada.
-- Perfis reais: 6e49ec30 = gestor, 7619cc8f = mesa; inspetoria e financeiro por consulta.
create temp table t_ctx(k text primary key, v text);
grant all on t_ctx to authenticated;
insert into t_ctx values
 ('dep', (select id::text from fornecedores where nome ilike 'compra avulsa%' limit 1)),
 ('com', (select id::text from fornecedores where nome ilike 'antolimp%' limit 1)),
 ('insp', (select id::text from perfis where nivel_acesso = 'inspetoria' limit 1)),
 ('fin', (select id::text from perfis where nivel_acesso = 'financeiro' limit 1)),
 ('ped', (select p.id::text from mat_pedidos p join mat_pedido_itens i on i.pedido_id=p.id
           join mat_itens it on it.id = i.item_id and not it.preparo_escritorio
           where p.status_produtos='em_validacao' and p.competencia='2026-10-01'
           group by p.id having count(distinct i.item_id) >= 3 order by count(distinct i.item_id) desc, p.id limit 1));

-- 0) como dono: marca o fornecedor de depósito; constraints de rota
DO $t$ DECLARE ok boolean; kc uuid := (select id from mat_contratos order by nome limit 1);
BEGIN
  IF (SELECT count(*) FROM fornecedores WHERE entrega_deposito) <> 0 THEN RAISE EXCEPTION 'FALHOU fornecedor nasceu com deposito'; END IF;
  IF (SELECT v FROM t_ctx WHERE k='dep') IS NULL OR (SELECT v FROM t_ctx WHERE k='com') IS NULL
     OR (SELECT v FROM t_ctx WHERE k='insp') IS NULL OR (SELECT v FROM t_ctx WHERE k='fin') IS NULL THEN
    RAISE EXCEPTION 'FALHOU fixture (fornecedor/perfil ausente)'; END IF;
  UPDATE fornecedores SET entrega_deposito = true WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='dep');
  UPDATE mat_contratos SET rota = 0 WHERE id = kc;      -- rota 0 aceita
  ok := false;
  BEGIN UPDATE mat_contratos SET rota = 5 WHERE id = kc; EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU rota 5 aceita'; END IF;
  ok := false;
  BEGIN UPDATE mat_contratos SET rota = -1 WHERE id = kc; EXCEPTION WHEN check_violation THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU rota -1 aceita'; END IF;
  UPDATE mat_contratos SET rota = NULL WHERE id = kc;
END $t$;

-- 1) gestor aprova o pedido, define rota 0 pela RPC e escolhe as linhas
select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE p uuid := (select v::uuid from t_ctx where k='ped'); kc uuid; ok boolean;
BEGIN
  IF p IS NULL THEN RAISE EXCEPTION 'FALHOU sem pedido de teste'; END IF;
  PERFORM validar_pedido_materiais(p, '[]'::jsonb, null);
  PERFORM aprovar_pedido_materiais(p, '[]'::jsonb);
  SELECT contrato_id INTO kc FROM mat_pedidos WHERE id = p;
  INSERT INTO t_ctx VALUES ('contrato', kc::text);
  PERFORM definir_rota_contrato(kc, 0::smallint);
  IF (SELECT rota FROM mat_contratos WHERE id = kc) <> 0 THEN RAISE EXCEPTION 'FALHOU rota 0 nao gravada pela RPC'; END IF;
  ok := false;
  BEGIN PERFORM definir_rota_contrato(kc, 5::smallint); EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%Rota inválida%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU rota 5 aceita pela RPC'; END IF;
END $t$;
reset role;

DO $t$ DECLARE p uuid := (select v::uuid from t_ctx where k='ped'); r record; n int := 0;
BEGIN
  FOR r IN SELECT DISTINCT ON (l.item_id) l.id FROM mat_pedido_itens l
             JOIN mat_itens it ON it.id = l.item_id AND NOT it.preparo_escritorio
            WHERE l.pedido_id = p AND l.qtd_aprovada > 0 AND l.atendimento IS NULL
              AND (l.variacao_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM mat_item_variacoes v WHERE v.item_id = l.item_id AND v.ativo))
            ORDER BY l.item_id, l.id LIMIT 3 LOOP
    n := n + 1;
    INSERT INTO t_ctx VALUES (chr(96 + n), r.id::text);
  END LOOP;
  IF n < 3 THEN RAISE EXCEPTION 'FALHOU poucas linhas aprovadas (%)', n; END IF;
END $t$;

-- 2) mesa gera: a e b ao fornecedor de depósito, c ao fornecedor comum
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$
DECLARE fd uuid := (select v::uuid from t_ctx where k='dep'); fc uuid := (select v::uuid from t_ctx where k='com');
        a mat_pedido_itens%ROWTYPE; b mat_pedido_itens%ROWTYPE; c mat_pedido_itens%ROWTYPE;
        r jsonb; x jsonb; cd uuid; cc uuid; previa jsonb;
BEGIN
  SELECT * INTO a FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='a');
  SELECT * INTO b FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='b');
  SELECT * INTO c FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='c');
  previa := mat_previa_compra('2026-10-01');
  IF (previa->>'contratos_sem_rota')::int IS NULL THEN RAISE EXCEPTION 'FALHOU previa sem contratos_sem_rota'; END IF;
  r := mat_gerar_compras('2026-10-01', 'mensal',
         jsonb_build_array(
           jsonb_build_object('id', a.id, 'qtd_compra', a.qtd_aprovada, 'fornecedor_id', fd),
           jsonb_build_object('id', b.id, 'qtd_compra', b.qtd_aprovada, 'fornecedor_id', fd),
           jsonb_build_object('id', c.id, 'qtd_compra', c.qtd_aprovada, 'fornecedor_id', fc)), 'teste 154', null);
  IF jsonb_array_length(r->'compras') <> 2 THEN RAISE EXCEPTION 'FALHOU esperava 2 compras: %', r; END IF;
  SELECT id INTO cd FROM mat_compras WHERE fornecedor_id = fd AND status = 'rascunho' AND observacao = 'teste 154';
  SELECT id INTO cc FROM mat_compras WHERE fornecedor_id = fc AND status = 'rascunho' AND observacao = 'teste 154';
  IF cd IS NULL OR cc IS NULL THEN RAISE EXCEPTION 'FALHOU compras de teste nao encontradas'; END IF;
  INSERT INTO t_ctx VALUES ('cd', cd::text), ('cc', cc::text);
  IF NOT (SELECT entrega_deposito FROM mat_compras WHERE id = cd) THEN RAISE EXCEPTION 'FALHOU rascunho sem snapshot de deposito'; END IF;
  IF (SELECT entrega_deposito FROM mat_compras WHERE id = cc) THEN RAISE EXCEPTION 'FALHOU rascunho comum marcado como deposito'; END IF;

  -- levar do depósito já enxerga o rascunho (por posto), sem a compra comum
  x := mat_levar_do_deposito('2026-10-01');
  IF jsonb_array_length(x->'linhas') <> 2 THEN RAISE EXCEPTION 'FALHOU levar do deposito esperava 2 celulas: %', x; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(x->'linhas') e WHERE (e->>'rota')::int IS DISTINCT FROM 0) THEN
    RAISE EXCEPTION 'FALHOU rota 0 nao veio no levar do deposito'; END IF;

  PERFORM mat_enviar_compra(cd, null);
  PERFORM mat_enviar_compra(cc, null);
  IF (SELECT count(*) FROM mat_pedido_itens WHERE id IN (a.id, b.id) AND via_deposito) <> 2 THEN RAISE EXCEPTION 'FALHOU via_deposito nas linhas de deposito'; END IF;
  IF (SELECT via_deposito FROM mat_pedido_itens WHERE id = c.id) THEN RAISE EXCEPTION 'FALHOU via_deposito na linha comum'; END IF;
  IF EXISTS (SELECT 1 FROM mat_compra_itens WHERE compra_id = cd AND rota IS DISTINCT FROM 0) THEN RAISE EXCEPTION 'FALHOU rota 0 nao snapshotada na celula'; END IF;
END $t$;
reset role;

-- 3) trocar o flag do fornecedor DEPOIS do envio não muda a compra enviada
DO $t$ BEGIN
  UPDATE fornecedores SET entrega_deposito = false WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='dep');
  IF NOT (SELECT entrega_deposito FROM mat_compras WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='cd')) THEN
    RAISE EXCEPTION 'FALHOU snapshot mudou com o cadastro'; END IF;
  UPDATE fornecedores SET entrega_deposito = true WHERE id = (SELECT v::uuid FROM t_ctx WHERE k='dep');
END $t$;

-- 4) separar ANTES de chegar no depósito é recusado; financeiro não separa
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ctx where k='insp'), 'role', 'authenticated')::text, true);
set local role authenticated;
DO $t$ DECLARE ok boolean := false; x jsonb; ex int;
BEGIN
  BEGIN PERFORM mat_registrar_separacao_deposito(jsonb_build_array(jsonb_build_object('id', (select v from t_ctx where k='a'))), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%chegada no depósito ainda não%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU separou antes de chegar'; END IF;
  x := mat_separacao_deposito('2026-10-01');
  IF jsonb_array_length(x->'linhas') <> 2 THEN RAISE EXCEPTION 'FALHOU lista de separacao esperava 2 linhas: %', x; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(x->'linhas') e WHERE e->>'qtd_recebida' IS NOT NULL) THEN RAISE EXCEPTION 'FALHOU linha ja recebida'; END IF;
END $t$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ctx where k='fin'), 'role', 'authenticated')::text, true);
set local role authenticated;
DO $t$ DECLARE ok boolean := false;
BEGIN
  BEGIN PERFORM mat_registrar_separacao_deposito(jsonb_build_array(jsonb_build_object('id', (select v from t_ctx where k='a'))), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%Sem permissão%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU financeiro separou'; END IF;
END $t$;
reset role;

-- 5) mesa registra a chegada: no depósito NÃO é entrega ao posto; na compra comum é
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE cd uuid := (select v::uuid from t_ctx where k='cd'); cc uuid := (select v::uuid from t_ctx where k='cc');
        a mat_pedido_itens%ROWTYPE; c mat_pedido_itens%ROWTYPE;
BEGIN
  PERFORM mat_registrar_chegada(cd, (SELECT jsonb_agg(jsonb_build_object('id', id, 'qtd_recebida', quantidade)) FROM mat_compra_itens WHERE compra_id = cd), null);
  PERFORM mat_registrar_chegada(cc, (SELECT jsonb_agg(jsonb_build_object('id', id, 'qtd_recebida', quantidade)) FROM mat_compra_itens WHERE compra_id = cc), null);
  SELECT * INTO a FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='a');
  SELECT * INTO c FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='c');
  IF a.qtd_recebida_fornecedor <> a.qtd_compra THEN RAISE EXCEPTION 'FALHOU chegada no deposito nao gravada'; END IF;
  IF a.qtd_entregue IS NOT NULL OR a.entregue_em IS NOT NULL THEN RAISE EXCEPTION 'FALHOU chegada no deposito contou como entregue (%)', a.qtd_entregue; END IF;
  IF mat_linha_entrega_fechada(a) THEN RAISE EXCEPTION 'FALHOU linha de deposito fechou so com a chegada'; END IF;
  IF c.qtd_entregue IS DISTINCT FROM c.qtd_compra OR NOT mat_linha_entrega_fechada(c) THEN
    RAISE EXCEPTION 'FALHOU compra comum mudou de comportamento (entregue %)', c.qtd_entregue; END IF;
END $t$;
reset role;

-- 6) inspetoria separa: menor sem motivo é recusado; maior que o recebido também; depois fecha
select set_config('request.jwt.claims', json_build_object('sub', (select v from t_ctx where k='insp'), 'role', 'authenticated')::text, true);
set local role authenticated;
DO $t$ DECLARE a mat_pedido_itens%ROWTYPE; b mat_pedido_itens%ROWTYPE; ok boolean; x jsonb;
BEGIN
  SELECT * INTO a FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='a');
  SELECT * INTO b FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='b');
  ok := false;
  BEGIN PERFORM mat_registrar_separacao_deposito(jsonb_build_array(jsonb_build_object('id', a.id, 'qtd', a.qtd_compra - 0.5)), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%Informe o motivo%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU separou menos sem motivo'; END IF;
  ok := false;
  BEGIN PERFORM mat_registrar_separacao_deposito(jsonb_build_array(jsonb_build_object('id', a.id, 'qtd', a.qtd_compra + 1)), null);
  EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%inválida%'; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU separou mais que o recebido'; END IF;

  PERFORM mat_registrar_separacao_deposito(jsonb_build_array(
    jsonb_build_object('id', a.id, 'qtd', a.qtd_compra - 0.5, 'motivo', 'quebrou no deposito'),
    jsonb_build_object('id', b.id)), '2026-10-22');
  SELECT * INTO a FROM mat_pedido_itens WHERE id = a.id;
  SELECT * INTO b FROM mat_pedido_itens WHERE id = b.id;
  IF a.qtd_separada <> a.qtd_compra - 0.5 OR a.qtd_entregue <> a.qtd_compra - 0.5 OR a.separado_em <> '2026-10-22' OR a.separado_por IS NULL
     OR a.motivo_entrega <> 'quebrou no deposito' THEN RAISE EXCEPTION 'FALHOU separacao parcial de a'; END IF;
  IF b.qtd_separada <> b.qtd_compra OR b.qtd_entregue <> b.qtd_compra THEN RAISE EXCEPTION 'FALHOU separacao padrao de b'; END IF;
  IF NOT mat_linha_entrega_fechada(a) OR NOT mat_linha_entrega_fechada(b) THEN RAISE EXCEPTION 'FALHOU linhas separadas nao fecharam'; END IF;
  x := mat_separacao_deposito('2026-10-01');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(x->'linhas') e WHERE (e->>'linha_id')::uuid = a.id AND (e->>'qtd_separada')::numeric = a.qtd_compra - 0.5) THEN
    RAISE EXCEPTION 'FALHOU lista nao reflete a separacao'; END IF;
END $t$;
reset role;

-- 7) mesa não consegue reduzir a chegada abaixo do que já foi separado
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE cd uuid := (select v::uuid from t_ctx where k='cd'); ok boolean := false; a mat_pedido_itens%ROWTYPE;
BEGIN
  SELECT * INTO a FROM mat_pedido_itens WHERE id = (select v::uuid from t_ctx where k='a');
  BEGIN PERFORM mat_registrar_chegada(cd,
      (SELECT jsonb_agg(jsonb_build_object('id', id, 'qtd_recebida', quantidade - 1, 'motivo', 'teste')) FROM mat_compra_itens WHERE id = a.compra_item_id), null);
  EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FALHOU reduziu a chegada abaixo do separado'; END IF;
END $t$;
reset role;

-- 8) a guarda da linha continua valendo para as colunas novas (UPDATE direto é recusado)
select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE vq numeric; bid uuid := (select v::uuid from t_ctx where k='b');
BEGIN
  SELECT qtd_separada INTO vq FROM mat_pedido_itens WHERE id = bid;
  BEGIN UPDATE mat_pedido_itens SET qtd_separada = 99 WHERE id = bid; EXCEPTION WHEN others THEN NULL; END;
  IF (SELECT qtd_separada FROM mat_pedido_itens WHERE id = bid) IS DISTINCT FROM vq THEN
    RAISE EXCEPTION 'FALHOU UPDATE direto de qtd_separada aceito'; END IF;
END $t$;
reset role;
