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

select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
DO $t$
DECLARE
  pv jsonb; n0 int; n1 int; pval uuid := (select v::uuid from t_ctx where k='ped_val');
  papr uuid := (select v::uuid from t_ctx where k='ped_aprov'); fpad uuid := (select v::uuid from t_ctx where k='forn_padrao');
  r jsonb; linhas jsonb; lin record; c1 uuid; st text; x jsonb; cel record; v_l uuid;
BEGIN
  IF pval IS NULL OR papr IS NULL OR fpad IS NULL THEN RAISE EXCEPTION 'FALHOU contexto: % % %', pval, papr, fpad; END IF;
  pv := mat_previa_compra('2026-10-20');
  n0 := jsonb_array_length(pv->'linhas');
  IF n0 < 1 THEN RAISE EXCEPTION 'FALHOU previa vazia'; END IF;
  IF jsonb_array_length(pv->'pendentes') < 1 THEN RAISE EXCEPTION 'FALHOU sem pendentes'; END IF;
  -- valida e aprova o pedido com extras (fluxo da Fase 1)
  PERFORM validar_pedido_materiais(pval, '[]'::jsonb, null);
  PERFORM aprovar_pedido_materiais(pval, '[]'::jsonb);
  pv := mat_previa_compra('2026-10-20');
  n1 := jsonb_array_length(pv->'linhas');
  IF n1 <= n0 THEN RAISE EXCEPTION 'FALHOU aprovado nao entrou na previa (% -> %)', n0, n1; END IF;

  -- erros de validação
  SELECT e INTO x FROM jsonb_array_elements(pv->'linhas') e WHERE (e->>'pedido_id')::uuid = pval AND NOT (e->>'preparo_escritorio')::boolean LIMIT 1;
  BEGIN
    PERFORM mat_gerar_compras('2026-10-01','mensal', jsonb_build_array(jsonb_build_object('id', x->>'linha_id', 'qtd_compra', (x->>'qtd_aprovada')::numeric + 1, 'fornecedor_id', fpad)));
    RAISE EXCEPTION 'FALHOU acima do aprovado aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%passa da quantidade%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM mat_gerar_compras('2026-10-01','mensal', jsonb_build_array(jsonb_build_object('id', x->>'linha_id', 'nao_atender', true)));
    RAISE EXCEPTION 'FALHOU nao atendido sem motivo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%motivo de não atender%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM mat_gerar_compras('2026-10-01','mensal', jsonb_build_array(jsonb_build_object('id', x->>'linha_id', 'qtd_compra', 1, 'fornecedor_id', fpad)));
    IF (x->>'qtd_aprovada')::numeric > 1 THEN RAISE EXCEPTION 'FALHOU corte sem motivo aceito'; END IF;
    RAISE EXCEPTION 'DESFAZER atender menos';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%atender menos%' THEN RAISE; END IF; END;

  -- monta o destino de TODAS as linhas da prévia: a 1ª dividida (1 estoque + resto fornecedor),
  -- a 2ª não atendida com motivo, as do escritório como escritório, o resto todo ao fornecedor.
  SELECT jsonb_agg(CASE
           WHEN (e->>'preparo_escritorio')::boolean THEN jsonb_build_object('id', e->>'linha_id')
           WHEN rn = 1 AND (e->>'qtd_aprovada')::numeric >= 2 THEN jsonb_build_object('id', e->>'linha_id', 'qtd_estoque', 1,
                 'qtd_compra', (e->>'qtd_aprovada')::numeric - 1, 'fornecedor_id', coalesce(e->>'fornecedor_padrao_id', fpad::text))
           WHEN rn = 2 THEN jsonb_build_object('id', e->>'linha_id', 'nao_atender', true, 'motivo', 'sem estoque no fornecedor')
           ELSE jsonb_build_object('id', e->>'linha_id', 'qtd_compra', (e->>'qtd_aprovada')::numeric,
                 'fornecedor_id', coalesce(e->>'fornecedor_padrao_id', fpad::text)) END)
    INTO linhas
    FROM (SELECT e, row_number() OVER () rn FROM jsonb_array_elements(pv->'linhas') e
           WHERE e->>'item_id' IS NOT NULL) s;
  r := mat_gerar_compras('2026-10-01', 'mensal', linhas, 'teste');
  IF (r->>'linhas')::int <> jsonb_array_length(linhas) THEN RAISE EXCEPTION 'FALHOU linhas gravadas %', r; END IF;
  IF jsonb_array_length(r->'compras') < 1 THEN RAISE EXCEPTION 'FALHOU nenhuma compra %', r; END IF;
  IF NOT ((r->'compras'->0->>'antes_da_janela')::boolean = (extract(day from mat_hoje()) < 20)) THEN RAISE EXCEPTION 'FALHOU antes_da_janela %', r; END IF;
  -- item do escritório nunca em compra
  IF EXISTS (SELECT 1 FROM mat_compra_itens ci JOIN mat_itens it ON it.id=ci.item_id WHERE it.preparo_escritorio) THEN
    RAISE EXCEPTION 'FALHOU item do escritorio na compra'; END IF;
  -- prévia não lista mais as linhas com destino
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(mat_previa_compra('2026-10-01')->'linhas') e WHERE e->>'item_id' IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU previa ainda com linhas de catalogo'; END IF;
  -- rascunho: pedido aprovado continua 'aprovado'
  SELECT status_produtos INTO st FROM mat_pedidos WHERE id = pval;
  IF st <> 'aprovado' THEN RAISE EXCEPTION 'FALHOU status antes do envio: %', st; END IF;
  -- gerar de novo a mesma linha: recusado
  BEGIN PERFORM mat_gerar_compras('2026-10-01','mensal', jsonb_build_array(linhas->0)); RAISE EXCEPTION 'FALHOU destino duplo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%já tem destino%' THEN RAISE; END IF; END;
  -- ajuste do kit em linha com destino: recusado
  SELECT id INTO v_l FROM mat_pedido_itens WHERE atendimento IS NOT NULL AND parte='kit' LIMIT 1;
  IF v_l IS NULL THEN RAISE EXCEPTION 'FALHOU sem linha kit com destino'; END IF;
  IF v_l IS NOT NULL THEN
    BEGIN PERFORM ajustar_linha_kit_materiais(v_l, 0, 'teste', null, null); RAISE EXCEPTION 'FALHOU ajuste com destino';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%destino na compra%' THEN RAISE; END IF; END;
  END IF;

  -- envia todas as compras geradas
  FOR x IN SELECT * FROM jsonb_array_elements(r->'compras') LOOP
    PERFORM mat_enviar_compra((x->>'id')::uuid, '2026-10-27');
  END LOOP;
  SELECT status_produtos INTO st FROM mat_pedidos WHERE id = pval;
  IF st <> 'em_compra' THEN RAISE EXCEPTION 'FALHOU status depois do envio: %', st; END IF;
  -- incluir item em pedido em_compra: recusado
  BEGIN PERFORM incluir_linha_pedido_materiais(pval, (select v::uuid from t_ctx where k='item_simples'), null, 1, 'urgente'); RAISE EXCEPTION 'FALHOU incluir em_compra';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%compra deste pedido%' THEN RAISE; END IF; END;
  -- enviar de novo: recusado
  BEGIN PERFORM mat_enviar_compra((r->'compras'->0->>'id')::uuid, null); RAISE EXCEPTION 'FALHOU envio duplo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%Só compra em rascunho%' THEN RAISE; END IF; END;

  -- chegada: célula do pedido pval, parcial sem motivo → recusado; com motivo → ok
  SELECT ci.* INTO cel FROM mat_compra_itens ci JOIN mat_pedido_itens l ON l.compra_item_id = ci.id
   WHERE l.pedido_id = pval ORDER BY ci.quantidade DESC LIMIT 1;
  BEGIN PERFORM mat_registrar_chegada(cel.compra_id, jsonb_build_array(jsonb_build_object('id', cel.id, 'qtd_recebida', cel.quantidade - 1)));
    IF cel.quantidade >= 1 THEN RAISE EXCEPTION 'FALHOU chegada parcial sem motivo'; END IF;
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%motivo da entrega menor%' THEN RAISE; END IF; END;
  BEGIN PERFORM mat_registrar_chegada(cel.compra_id, jsonb_build_array(jsonb_build_object('id', cel.id, 'qtd_recebida', cel.quantidade + 1)));
    RAISE EXCEPTION 'FALHOU chegada acima';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%maior que o comprado%' THEN RAISE; END IF; END;
  -- cancelar compra com chegada: recusado (depois de registrar)
  -- registra TODAS as células de todas as compras: a célula "cel" com 1 a menos (motivo), resto cheio
  FOR x IN SELECT * FROM jsonb_array_elements(r->'compras') LOOP
    PERFORM mat_registrar_chegada((x->>'id')::uuid,
      (SELECT jsonb_agg(jsonb_build_object('id', ci.id,
          'qtd_recebida', CASE WHEN ci.id = cel.id THEN ci.quantidade - 1 ELSE ci.quantidade END,
          'motivo', CASE WHEN ci.id = cel.id THEN 'faltou no caminhão' END))
         FROM mat_compra_itens ci WHERE ci.compra_id = (x->>'id')::uuid));
  END LOOP;
  BEGIN PERFORM mat_cancelar_compra(cel.compra_id, 'teste'); RAISE EXCEPTION 'FALHOU cancelar com chegada';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%cancelada%' THEN RAISE; END IF; END;
  IF (SELECT status FROM mat_compras WHERE id = cel.compra_id) <> 'recebida' THEN RAISE EXCEPTION 'FALHOU status compra recebida'; END IF;

  -- separação: linhas com parte do estoque/escritório
  PERFORM mat_registrar_separacao((SELECT jsonb_agg(jsonb_build_object('id', id)) FROM mat_pedido_itens
     WHERE (atendimento = 'escritorio' OR coalesce(qtd_estoque,0) > 0) AND qtd_entregue_estoque IS NULL));
  IF NOT EXISTS (SELECT 1 FROM mat_estoque_movimentos WHERE tipo = 'saida_pedido') AND EXISTS (SELECT 1 FROM mat_pedido_itens WHERE qtd_estoque > 0) THEN
    RAISE EXCEPTION 'FALHOU separacao sem baixa'; END IF;
  -- todos os pedidos com destino integral estão entregues/entregue_parcial
  SELECT status_produtos INTO st FROM mat_pedidos WHERE id = pval;
  IF st NOT IN ('entregue', 'entregue_parcial') THEN RAISE EXCEPTION 'FALHOU status final pval: %', st; END IF;
  IF (SELECT status_produtos FROM mat_pedidos WHERE id = (SELECT pedido_id FROM mat_pedido_itens WHERE compra_item_id = cel.id LIMIT 1)) <> 'entregue_parcial' THEN
    RAISE EXCEPTION 'FALHOU pedido da celula curta deveria ser parcial'; END IF;
  -- distribuição: soma recebida nas linhas = recebida da célula
  IF (SELECT sum(qtd_recebida_fornecedor) FROM mat_pedido_itens WHERE compra_item_id = cel.id) <> cel.quantidade - 1 THEN
    RAISE EXCEPTION 'FALHOU distribuicao da celula'; END IF;

  -- reposição do estoque + chegada → entrada_compra
  r := mat_gerar_compra_reposicao(fpad, jsonb_build_array(jsonb_build_object('item_id', (select v from t_ctx where k='item_simples'), 'quantidade', 4)), null);
  PERFORM mat_enviar_compra((r->>'id')::uuid, null);
  PERFORM mat_registrar_chegada((r->>'id')::uuid, (SELECT jsonb_agg(jsonb_build_object('id', id, 'qtd_recebida', 4)) FROM mat_compra_itens WHERE compra_id = (r->>'id')::uuid));
  IF mat_saldo_estoque((select v::uuid from t_ctx where k='item_simples'), null) <> 4 - coalesce((SELECT -sum(quantidade) FROM mat_estoque_movimentos WHERE tipo='saida_pedido' AND item_id=(select v::uuid from t_ctx where k='item_simples')),0) THEN
    RAISE EXCEPTION 'FALHOU saldo da reposicao'; END IF;
  BEGIN PERFORM mat_registrar_chegada((r->>'id')::uuid, (SELECT jsonb_agg(jsonb_build_object('id', id, 'qtd_recebida', 2, 'motivo', 'x')) FROM mat_compra_itens WHERE compra_id = (r->>'id')::uuid));
    RAISE EXCEPTION 'FALHOU reposicao diminuiu';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%só aumenta%' THEN RAISE; END IF; END;

  -- cancelar um rascunho devolve as linhas: novo cenário com o pedido aprovado original (se ainda tiver linha sem destino)
END $t$;
reset role;

-- guarda: UPDATE direto (como dono) nas colunas de destino é recusado
DO $t$ BEGIN
  BEGIN UPDATE mat_pedido_itens SET atendimento = NULL WHERE atendimento IS NOT NULL; RAISE EXCEPTION 'FALHOU guarda update';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM mat_pedido_itens WHERE atendimento IS NOT NULL; RAISE EXCEPTION 'FALHOU guarda delete';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN UPDATE mat_pedidos SET status_produtos = 'xx' WHERE false; EXCEPTION WHEN others THEN NULL; END;
END $t$;

-- financeiro: lê compras, não gera
select set_config('request.jwt.claims','{"sub":"288f0044-d690-45c9-ba6d-6a56090871d3","role":"authenticated"}',true);
set local role authenticated;
DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM mat_compras) THEN RAISE EXCEPTION 'FALHOU financeiro nao ve compras'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mat_compra_itens WHERE preco_unitario IS NOT NULL OR true) THEN RAISE EXCEPTION 'FALHOU financeiro itens'; END IF;
  PERFORM mat_previa_compra('2026-10-01');
  BEGIN PERFORM mat_gerar_compras('2026-10-01','mensal','[{"id":"00000000-0000-0000-0000-000000000000"}]'); RAISE EXCEPTION 'FALHOU financeiro gerou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN INSERT INTO mat_compras(competencia, fornecedor_id, numero) VALUES ('2026-10-01', (select v::uuid from t_ctx where k='forn_padrao'), 'X'); RAISE EXCEPTION 'FALHOU insert direto compra';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM mat_somar_celula_compra(null,null,null,null,null,1); RAISE EXCEPTION 'FALHOU interna exposta';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $t$;
-- dp1 não vê compras
select set_config('request.jwt.claims','{"sub":"c93244f7-cd4c-433a-85b6-15277cb5c9b4","role":"authenticated"}',true);
DO $t$ BEGIN
  IF EXISTS (SELECT 1 FROM mat_compras) THEN RAISE EXCEPTION 'FALHOU dp1 ve compras'; END IF;
END $t$;
reset role;
-- reset_permissoes_perfil do financeiro mantém a aba Compras
select set_config('request.jwt.claims','{"sub":"9c5d9bce-4a7e-44f3-a662-34a4a545c7a7","role":"authenticated"}',true);
set local role authenticated;
select reset_permissoes_perfil('financeiro');
reset role;
DO $t$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM permissoes_perfil WHERE perfil='financeiro' AND recurso='rota' AND acao='materiais_compras' AND permitido) THEN
    RAISE EXCEPTION 'FALHOU reset financeiro tirou compras'; END IF;
  IF NOT EXISTS (SELECT 1 FROM permissoes_perfil WHERE perfil='financeiro' AND recurso='rota' AND acao='materiais_fornecedores' AND permitido) THEN
    RAISE EXCEPTION 'FALHOU reset financeiro tirou fornecedores'; END IF;
END $t$;
