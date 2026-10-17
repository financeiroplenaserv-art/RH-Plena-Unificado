-- ===== testes 147 (depois da 146 e da 147, na mesma transação) =====
create temp table t_ctx(k text primary key, v text);
grant all on t_ctx to authenticated;
insert into t_ctx values
 ('forn_padrao', (select id::text from fornecedores where nome ilike 'compra avulsa%' limit 1)),
 -- um pedido em validação com extras (para aprovar) e o pedido já aprovado
 ('ped_val', (select p.id::text from mat_pedidos p join mat_pedido_itens i on i.pedido_id=p.id
               where p.status_produtos='em_validacao' and p.competencia='2026-10-01' and i.parte='extra'
                 and i.item_id is not null and not exists (select 1 from mat_pedido_itens j where j.pedido_id=p.id and j.item_id is null)
               group by p.id order by count(*) desc limit 1)),
 ('ped_aprov', (select id::text from mat_pedidos where status_produtos='aprovado' and competencia='2026-10-01' limit 1)),
 ('prep', (select id::text from mat_itens where preparo_escritorio limit 1)),
 ('item_simples', (select id::text from mat_itens it where ativo and not preparo_escritorio and not exists (select 1 from mat_item_variacoes v where v.item_id=it.id and v.ativo) order by nome limit 1));

-- cancelamento: novo pedido aprovado, gera rascunho e cancela
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
DO $t$
DECLARE p2 uuid; r jsonb; n int; fpad uuid := (select v::uuid from t_ctx where k='forn_padrao');
BEGIN
  -- mesa: compra permitida; pega outro pedido em validação e aprova como admin não dá (mesa não aprova) — usa linhas kit já aprovadas
  SELECT jsonb_agg(jsonb_build_object('id', e->>'linha_id', 'qtd_compra', (e->>'qtd_aprovada')::numeric, 'fornecedor_id', fpad))
    INTO r FROM jsonb_array_elements(mat_previa_compra('2026-10-01')->'linhas') e WHERE e->>'item_id' IS NOT NULL;
  IF r IS NULL THEN RAISE EXCEPTION 'FALHOU cenario de cancelamento sem linhas'; END IF;
  r := mat_gerar_compras('2026-10-01', 'avulsa', r, null);
  SELECT count(*) INTO n FROM mat_pedido_itens WHERE compra_item_id IN (SELECT id FROM mat_compra_itens WHERE compra_id = (r->'compras'->0->>'id')::uuid);
  IF n = 0 THEN RAISE EXCEPTION 'FALHOU avulsa sem linhas'; END IF;
  PERFORM mat_cancelar_compra((r->'compras'->0->>'id')::uuid, 'gerei errado');
  IF EXISTS (SELECT 1 FROM mat_compra_itens ci JOIN mat_pedido_itens l ON l.compra_item_id = ci.id WHERE ci.compra_id = (r->'compras'->0->>'id')::uuid) THEN
    RAISE EXCEPTION 'FALHOU cancelamento nao liberou linhas'; END IF;
  IF jsonb_array_length(mat_previa_compra('2026-10-01')->'linhas') < n THEN RAISE EXCEPTION 'FALHOU linhas nao voltaram a previa'; END IF;
END $t$;

reset role;
-- envio do líder depois de em_compra vira pedido EXTRA (mescla só antes de aprovado)
select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
DO $t$ DECLARE p uuid := (select v::uuid from t_ctx where k='ped_val'); fpad uuid := (select v::uuid from t_ctx where k='forn_padrao'); r jsonb; x jsonb;
BEGIN
  PERFORM validar_pedido_materiais(p, '[]'::jsonb, null);
  PERFORM aprovar_pedido_materiais(p, '[]'::jsonb);
  SELECT jsonb_agg(jsonb_build_object('id', id, 'qtd_compra', qtd_aprovada, 'fornecedor_id', fpad)) INTO r
    FROM mat_pedido_itens WHERE pedido_id = p AND qtd_aprovada > 0 AND atendimento IS NULL AND item_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM mat_itens it WHERE it.id = item_id AND it.preparo_escritorio);
  PERFORM mat_gerar_compras('2026-10-01', 'mensal', (SELECT jsonb_agg(jsonb_build_object('id', l.id)) FROM mat_pedido_itens l JOIN mat_itens it ON it.id = l.item_id AND it.preparo_escritorio WHERE l.pedido_id = p AND l.qtd_aprovada > 0 AND l.atendimento IS NULL), null)
    WHERE EXISTS (SELECT 1 FROM mat_pedido_itens l JOIN mat_itens it ON it.id = l.item_id AND it.preparo_escritorio WHERE l.pedido_id = p AND l.qtd_aprovada > 0 AND l.atendimento IS NULL);
  IF r IS NULL THEN RAISE EXCEPTION 'FALHOU pedido aprovado sem linhas'; END IF;
  r := mat_gerar_compras('2026-10-01', 'mensal', r, null);
  FOR x IN SELECT * FROM jsonb_array_elements(r->'compras') LOOP PERFORM mat_enviar_compra((x->>'id')::uuid, null); END LOOP;
  IF (SELECT status_produtos FROM mat_pedidos WHERE id = p) <> 'em_compra' THEN RAISE EXCEPTION 'FALHOU nao foi em_compra'; END IF;
END $t$;
reset role;
DO $t$ DECLARE p uuid := (select v::uuid from t_ctx where k='ped_val'); c uuid; n0 int; n1 int; it uuid;
BEGIN
  SELECT contrato_id INTO c FROM mat_pedidos WHERE id = p;
  SELECT count(*) INTO n0 FROM mat_pedidos WHERE contrato_id = c AND competencia = '2026-10-01';
  SELECT i.id INTO it FROM mat_itens i JOIN mat_contratos ct ON ct.id = c
   WHERE i.ativo AND NOT i.preparo_escritorio AND (ct.recebe_limpeza OR i.categoria = 'portaria')
     AND NOT EXISTS (SELECT 1 FROM mat_item_variacoes v WHERE v.item_id = i.id AND v.ativo)
     AND (i.contratos_exclusivos IS NULL OR cardinality(i.contratos_exclusivos) = 0) LIMIT 1;
  PERFORM mat_registrar_envio(c, '2026-10-20', 'Teste', '{"produtos": true, "uniforme": true, "epi": true}'::jsonb, null, null, 'teste',
    jsonb_build_array(jsonb_build_object('item_id', it, 'qtd_pedida', 1, 'parte', 'extra')), '[]'::jsonb, null);
  SELECT count(*) INTO n1 FROM mat_pedidos WHERE contrato_id = c AND competencia = '2026-10-01';
  IF n1 <> n0 + 1 THEN RAISE EXCEPTION 'FALHOU envio depois da compra nao virou pedido extra (% -> %)', n0, n1; END IF;
  IF (SELECT status_produtos FROM mat_pedidos WHERE id = p) <> 'em_compra' THEN RAISE EXCEPTION 'FALHOU pedido em_compra mudou'; END IF;
  IF EXISTS (SELECT 1 FROM mat_pedido_itens WHERE pedido_id = p AND created_at > now() - interval '0 sec' AND item_id = it AND parte='extra' AND qtd_pedida = 1 AND envio_id IS NOT NULL AND atendimento IS NULL AND qtd_aprovada IS NULL) THEN
    RAISE EXCEPTION 'FALHOU linha entrou no pedido em_compra'; END IF;
END $t$;
