// Gera dados-locais/importacao_pedidos_outubro_2026-10-17/completar_kits.sql (decisão da gestora, 18/10/2026,
// "opção a"): completa o Kit Mensal nos pedidos de OUTUBRO importados. Só GERA o arquivo; quem aplica é o
// coordenador. Entrada: nao_precisa_outubro.json (script de importação com --so-nao-precisa) e ref/k_kit.json.
//
//   node scripts/materiais/gerar-completar-kits.mjs
import fs from 'fs'

const DIR = 'dados-locais/importacao_pedidos_outubro_2026-10-17'
const naoPrecisa = JSON.parse(fs.readFileSync(`${DIR}/nao_precisa_outubro.json`, 'utf8'))
const kit = JSON.parse(fs.readFileSync(`${DIR}/ref/k_kit.json`, 'utf8'))

// "Não precisa" só interessa quando o item resolvido está no kit do contrato.
const noKit = new Set(kit.map((k) => `${k.contrato_id}|${k.item_id}`))
const pares = new Set()
for (const n of naoPrecisa) if (n.item_id && noKit.has(`${n.contrato_id}|${n.item_id}`)) pares.add(`${n.contrato_id}|${n.item_id}`)
const valores = [...pares].sort().map((p) => { const [c, i] = p.split('|'); return `('${c}'::uuid, '${i}'::uuid)` })

const sql = `-- Completa o Kit Mensal nos pedidos de OUTUBRO/2026 importados (decisão da gestora, 18/10/2026, "opção a").
-- PRÉVIA PREPARADA, NÃO EXECUTADA. Rodar com scripts/lib/executar-arquivo-sql-management-api.ps1 (arquivo UTF-8).
-- Gerado por scripts/materiais/gerar-completar-kits.mjs. Uma única requisição = uma transação.
--
-- Regras (as mesmas de preencher_pedido_pelo_kit / do link):
--  * kit efetivo do contrato: itens/variações ATIVOS com quantidade > 0; variação "oculta para o líder" vira o item
--    sem variação e linhas do mesmo item somam (como visaoDoLider); itens com periodicidade > 1 mês só entram se não
--    houve consumo/aprovação nos meses anteriores da janela (mesma condição de preencher_pedido_pelo_kit);
--  * DECISÃO DA GESTORA (18/10): em outubro o kit completado NÃO entra aprovado automaticamente — o líder não o
--    confirmou no formulário antigo. Linha nova: parte='kit', aprovado_automatico=false, qtd_validada = qtd (já
--    "validada" pelo escritório, não passa pelo inspetor), qtd_aprovada NULL (aguarda o GESTOR). As linhas de kit
--    antigas (auto-aprovadas) não são tocadas. Compras só leva linha com qtd_aprovada > 0.
--  * item do kit SEM linha de kit no pedido -> linha parte='kit' (qtd_kit = qtd do kit); se o líder escreveu "Não precisa"/0 para a pergunta que
--    corresponde ao item (tabela _np abaixo, vinda do mapa de colunas), a linha entra com quantidade 0;
--  * item do kit que o líder pediu como linha EXTRA (sem decisão do inspetor/gestor, sem destino de compra): a linha
--    vira kit (até a qtd do kit) e o excedente, se houver, fica como extra — a quantidade do líder continua
--    aguardando o INSPETOR (qtd_validada segue nula); extra já validada/ajustada = não mexe;
--  * pedidos sem_necessidade, com destino de compra (atendimento/compra_item_id) ou fora de rascunho/validação/
--    aprovado/"só uniforme" não são tocados; contrato com kit e SEM pedido de outubro não ganha pedido;
--  * marca de origem: um envio 'complemento' por pedido com user_agent 'completar-kit-2026-10-18' e
--    seu_nome 'Escritório — kit completado na importação (decisão da gestora 18/10)';
--  * status do pedido: tem linha ainda com o inspetor (qtd_validada nula) -> fica/vai 'em_validacao'; senão -> 'validado'
--    (aguarda o gestor). Pedido 'aprovado' ou 'nao_se_aplica' (só uniforme) que ganha linhas -> 'validado'.
--    "Aprovar tudo/com ajustes/selecionados" (aprovar_pedido_materiais) preenche qtd_aprovada = qtd_validada das linhas
--    não automáticas; "Ajustar" (ajustar_linha_kit_materiais) só mexe em qtd_validada enquanto não há aprovação.
--  * IDEMPOTENTE: item que já tem linha de kit (inclusive a zerada) é pulado; rodar de novo não insere nada.
-- Preço: mat_preco_vigente(item, variação, 18/10/2026) — variação prevalece sobre item (mesma regra do corrigir_precos.sql).

-- 0) "Não precisa" explícito do líder por (contrato, item do kit) — vem de docs/PEDIDO DE MATERIAIS POR CLIENTE.xlsx
create temp table _np (contrato_id uuid, item_id uuid) on commit drop;
${valores.length ? `insert into _np values\n${valores.join(',\n')};` : '-- (nenhum)'}

-- 1) Pedidos elegíveis
create temp table _ped on commit drop as
select p.id as pedido_id, p.contrato_id, c.nome as contrato, p.status_produtos
  from public.mat_pedidos p
  join public.mat_contratos c on c.id = p.contrato_id
 where p.competencia = date '2026-10-01' and p.tipo = 'mensal'
   and p.status_produtos in ('em_validacao', 'validado', 'aprovado', 'nao_se_aplica')
   and not p.sem_necessidade
   and exists (select 1 from public.mat_kit_itens k where k.contrato_id = p.contrato_id and k.quantidade > 0)
   and not exists (select 1 from public.mat_pedido_itens i
                    where i.pedido_id = p.id and (i.atendimento is not null or i.compra_item_id is not null));

-- 2) Kit efetivo (visão do link) com a regra de periodicidade de preencher_pedido_pelo_kit
create temp table _kit on commit drop as
select g.contrato_id, g.item_id, g.variacao_id, g.qtd, g.per
  from (
    select k.contrato_id, k.item_id,
           case when coalesce(v.oculta_lider, false) then null else k.variacao_id end as variacao_id,
           sum(k.quantidade) as qtd, min(k.periodicidade_meses) as per
      from public.mat_kit_itens k
      join public.mat_itens it on it.id = k.item_id and it.ativo
      left join public.mat_item_variacoes v on v.id = k.variacao_id
     where k.quantidade > 0 and (v.id is null or v.ativo)
     group by 1, 2, 3
  ) g
 where not (
   g.per > 1 and (
     exists (select 1 from public.mat_historico_consumo h
              where h.contrato_id = g.contrato_id and h.item_id = g.item_id
                and coalesce(h.variacao_id, '00000000-0000-0000-0000-000000000000') = coalesce(g.variacao_id, '00000000-0000-0000-0000-000000000000')
                and h.quantidade > 0
                and h.competencia >= (date '2026-10-01' - make_interval(months => g.per - 1))::date
                and h.competencia < date '2026-10-01')
     or exists (select 1 from public.mat_pedido_itens i join public.mat_pedidos pp on pp.id = i.pedido_id
                 where pp.contrato_id = g.contrato_id and pp.status_produtos in ('aprovado', 'em_compra', 'entregue', 'entregue_parcial')
                   and i.item_id = g.item_id
                   and coalesce(i.variacao_id, '00000000-0000-0000-0000-000000000000') = coalesce(g.variacao_id, '00000000-0000-0000-0000-000000000000')
                   and coalesce(i.qtd_aprovada, 0) > 0
                   and pp.competencia >= (date '2026-10-01' - make_interval(months => g.per - 1))::date
                   and pp.competencia < date '2026-10-01')));

-- 3) Plano: o que fazer com cada (pedido, item do kit)
create temp table _plano on commit drop as
select pe.pedido_id, pe.contrato_id, pe.contrato, pe.status_produtos, k.item_id, k.variacao_id, k.qtd as qtd_kit,
       exists (select 1 from _np n where n.contrato_id = k.contrato_id and n.item_id = k.item_id) as nao_precisa,
       (select count(*) from public.mat_pedido_itens i where i.pedido_id = pe.pedido_id and i.parte = 'kit' and i.item_id = k.item_id
           and coalesce(i.variacao_id, '00000000-0000-0000-0000-000000000000') = coalesce(k.variacao_id, '00000000-0000-0000-0000-000000000000')) as n_kit,
       (select count(*) from public.mat_pedido_itens i where i.pedido_id = pe.pedido_id and i.parte = 'extra' and i.item_id = k.item_id
           and coalesce(i.variacao_id, '00000000-0000-0000-0000-000000000000') = coalesce(k.variacao_id, '00000000-0000-0000-0000-000000000000')) as n_extra,
       (select i.id from public.mat_pedido_itens i where i.pedido_id = pe.pedido_id and i.parte = 'extra' and i.item_id = k.item_id
           and coalesce(i.variacao_id, '00000000-0000-0000-0000-000000000000') = coalesce(k.variacao_id, '00000000-0000-0000-0000-000000000000')
           and i.qtd_validada is null and i.qtd_aprovada is null and i.motivo_ajuste is null and i.ajustado_em is null
           and i.incluido_em is null and i.ligado_em is null limit 1) as extra_convertivel_id
  from _ped pe join _kit k on k.contrato_id = pe.contrato_id;

-- classificação final de cada linha do plano
alter table _plano add column acao text;
update _plano set acao = case
  when n_kit > 0 then 'ja_tem_kit'
  when n_extra = 0 then 'inserir_kit'
  when n_extra = 1 and extra_convertivel_id is not null then 'converter_extra'
  else 'extra_com_decisao' end;

-- 4) Execução
do $exec$
declare
  v_zero constant uuid := '00000000-0000-0000-0000-000000000000';
  r record; v_env uuid; v_seq smallint; l public.mat_pedido_itens%rowtype; v_dest numeric; v_qtd numeric;
begin
  -- um envio 'complemento' por pedido que vai receber/alterar alguma linha
  create temp table _env (pedido_id uuid primary key, envio_id uuid) on commit drop;
  for r in select distinct pedido_id from _plano where acao in ('inserir_kit', 'converter_extra') loop
    select coalesce(max(sequencia), 0) + 1 into v_seq from public.mat_pedido_envios where pedido_id = r.pedido_id;
    insert into public.mat_pedido_envios (pedido_id, sequencia, origem, seu_nome, user_agent)
    values (r.pedido_id, v_seq, 'complemento', 'Escritório — kit completado na importação (decisão da gestora 18/10)', 'completar-kit-2026-10-18')
    returning id into v_env;
    insert into _env values (r.pedido_id, v_env);
  end loop;

  -- 4a) linhas de kit novas (cheias ou zeradas pelo "Não precisa")
  for r in select * from _plano where acao = 'inserir_kit' loop
    v_qtd := case when r.nao_precisa then 0 else r.qtd_kit end;
    insert into public.mat_pedido_itens (pedido_id, envio_id, item_id, variacao_id, qtd_kit, qtd_pedida, qtd_validada, qtd_aprovada,
                                         preco_unitario, parte, aprovado_automatico)
    values (r.pedido_id, (select envio_id from _env where pedido_id = r.pedido_id), r.item_id, r.variacao_id, r.qtd_kit, v_qtd, v_qtd,
            null, public.mat_preco_vigente(r.item_id, r.variacao_id, date '2026-10-18'), 'kit', false);
  end loop;

  -- 4b) extras do líder que viram kit (até a qtd do kit); o excedente continua extra
  for r in select * from _plano where acao = 'converter_extra' loop
    select * into l from public.mat_pedido_itens where id = r.extra_convertivel_id;
    if l.qtd_pedida <= r.qtd_kit then
      update public.mat_pedido_itens
         set parte = 'kit', qtd_kit = r.qtd_kit, aprovado_automatico = false,
             excecao_acima_kit = false, excecao_fora_kit = false
       where id = l.id;
    else
      update public.mat_pedido_itens
         set parte = 'kit', qtd_kit = r.qtd_kit, qtd_pedida = r.qtd_kit, aprovado_automatico = false,
             excecao_acima_kit = false, excecao_fora_kit = false
       where id = l.id;
      insert into public.mat_pedido_itens (pedido_id, envio_id, item_id, variacao_id, qtd_kit, qtd_pedida, preco_unitario, justificativa,
                                           excecao_acima_kit, excecao_validade, excecao_fora_kit, ultima_entrega_em, parte, aprovado_automatico)
      values (l.pedido_id, l.envio_id, l.item_id, l.variacao_id, r.qtd_kit, l.qtd_pedida - r.qtd_kit, l.preco_unitario, l.justificativa,
              true, l.excecao_validade, false, l.ultima_entrega_em, 'extra', false);
    end if;
  end loop;

  -- 4c) status dos pedidos que receberam/alteraram linhas: ainda há linha com o inspetor -> em_validacao; senão validado
  update public.mat_pedidos p
     set status_produtos = case
           when exists (select 1 from public.mat_pedido_itens i where i.pedido_id = p.id and i.qtd_validada is null and i.qtd_pedida > 0)
             then 'em_validacao'
           else 'validado' end
   where p.competencia = date '2026-10-01' and exists (select 1 from _env e where e.pedido_id = p.id);
end
$exec$;

-- 5) Conferência: por contrato (linhas de kit cheias/zeradas inseridas, extras convertidas, valor adicionado)
select pe.contrato, pe.status_produtos as status_antes,
       (select p2.status_produtos from public.mat_pedidos p2 where p2.id = pe.pedido_id) as status_depois,
       count(*) filter (where pl.acao = 'inserir_kit' and not pl.nao_precisa) as kit_cheias,
       count(*) filter (where pl.acao = 'inserir_kit' and pl.nao_precisa) as kit_zeradas_nao_precisa,
       count(*) filter (where pl.acao = 'converter_extra') as extras_convertidas,
       count(*) filter (where pl.acao = 'ja_tem_kit') as ja_tinham_kit,
       count(*) filter (where pl.acao = 'extra_com_decisao') as extra_com_decisao_nao_mexida,
       round(coalesce(sum(case when pl.acao = 'inserir_kit' and not pl.nao_precisa then pl.qtd_kit * public.mat_preco_vigente(pl.item_id, pl.variacao_id, date '2026-10-18') end), 0), 2) as valor_kit_adicionado
  from _ped pe left join _plano pl on pl.pedido_id = pe.pedido_id
 group by pe.pedido_id, pe.contrato, pe.status_produtos
 order by pe.contrato;
`


fs.writeFileSync(`${DIR}/completar_kits.sql`, sql, 'utf8')

// Versão de TESTE: mesmo SQL, mas termina com RAISE EXCEPTION (a transação é desfeita) devolvendo o relatório.
const marca = '-- 5) Conferência'
const corpo = sql.slice(0, sql.indexOf(marca))
const consulta = sql.slice(sql.indexOf('select pe.contrato')).replace(/;\s*$/, '')
const itemNome = "(select nome from public.mat_itens where id = item_id)"
const teste = `${corpo}create temp table _conf on commit drop as ${consulta};
create temp table _fluxo (passo text, info jsonb) on commit drop;
do $f$
declare
  v_g constant uuid := '6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4'; -- gestor (só no teste desfeito)
  ped_v uuid; ped_e uuid; l uuid; q numeric; n_prev integer;
begin
  perform set_config('request.jwt.claim.sub', v_g::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_g, 'role', 'authenticated')::text, true);

  -- A) pedido que ficou 'validado' direto (sem nada com o inspetor): Ajustar -> Aprovar tudo -> Compras
  select p.id into ped_v from public.mat_pedidos p
   where p.competencia = date '2026-10-01' and p.status_produtos = 'validado' and exists (select 1 from _env e where e.pedido_id = p.id)
   order by p.created_at limit 1;
  if ped_v is not null then
    select i.id, i.qtd_validada into l, q from public.mat_pedido_itens i
     where i.pedido_id = ped_v and i.parte = 'kit' and not i.aprovado_automatico and i.qtd_validada > 0 order by i.created_at limit 1;
    insert into _fluxo values ('A0 antes', jsonb_build_object('pedido', ped_v, 'status', 'validado',
      'linhas_novas_sem_aprovacao', (select count(*) from public.mat_pedido_itens where pedido_id = ped_v and qtd_aprovada is null)));
    perform public.ajustar_linha_kit_materiais(l, greatest(q - 1, 0), 'teste desfeito');
    insert into _fluxo values ('A1 ajustar', jsonb_build_object('linha', l, 'qtd_validada', (select qtd_validada from public.mat_pedido_itens where id = l),
      'qtd_aprovada', (select qtd_aprovada from public.mat_pedido_itens where id = l)));
    perform public.aprovar_pedido_materiais(ped_v, '[]'::jsonb);
    select jsonb_array_length(coalesce((public.mat_previa_compra(date '2026-10-01') -> 'linhas'), '[]'::jsonb)) into n_prev;
    insert into _fluxo values ('A2 aprovar', jsonb_build_object('status', (select status_produtos from public.mat_pedidos where id = ped_v),
      'linha_ajustada_aprovada', (select qtd_aprovada from public.mat_pedido_itens where id = l),
      'sem_aprovacao_restante', (select count(*) from public.mat_pedido_itens where pedido_id = ped_v and qtd_aprovada is null),
      'linhas_do_pedido_na_previa', (select count(*) from jsonb_array_elements(public.mat_previa_compra(date '2026-10-01') -> 'linhas') x where x->>'pedido_id' = ped_v::text),
      'previa_total', n_prev));
  end if;

  -- B) pedido em_validacao: inspetor valida (linhas novas ficam como estão) -> gestor aprova
  select p.id into ped_e from public.mat_pedidos p
   where p.competencia = date '2026-10-01' and p.status_produtos = 'em_validacao' and exists (select 1 from _env e where e.pedido_id = p.id)
   order by p.created_at limit 1;
  if ped_e is not null then
    perform public.validar_pedido_materiais(ped_e, '[]'::jsonb);
    insert into _fluxo values ('B1 validar', jsonb_build_object('status', (select status_produtos from public.mat_pedidos where id = ped_e),
      'novas_com_aprovacao', (select count(*) from public.mat_pedido_itens i join public.mat_pedido_envios e on e.id = i.envio_id
                               where i.pedido_id = ped_e and e.user_agent = 'completar-kit-2026-10-18' and i.qtd_aprovada is not null)));
    perform public.aprovar_pedido_materiais(ped_e, '[]'::jsonb);
    insert into _fluxo values ('B2 aprovar', jsonb_build_object('status', (select status_produtos from public.mat_pedidos where id = ped_e),
      'sem_aprovacao_restante', (select count(*) from public.mat_pedido_itens where pedido_id = ped_e and qtd_aprovada is null),
      'novas_aprovadas', (select count(*) from public.mat_pedido_itens i join public.mat_pedido_envios e on e.id = i.envio_id
                           where i.pedido_id = ped_e and e.user_agent = 'completar-kit-2026-10-18' and i.qtd_aprovada is not null)));
  end if;
end $f$;
do $t$
declare r text;
begin
  select jsonb_build_object(
    'conf', (select jsonb_agg(to_jsonb(c)) from _conf c),
    'fluxo', (select jsonb_agg(jsonb_build_object('passo', passo, 'info', info)) from _fluxo),
    'extra_com_decisao', (select jsonb_agg(jsonb_build_object('contrato', contrato, 'item', ${itemNome}, 'n_extra', n_extra)) from _plano where acao = 'extra_com_decisao'),
    'convertidas', (select jsonb_agg(jsonb_build_object('contrato', contrato, 'item', ${itemNome}, 'qtd_kit', qtd_kit)) from _plano where acao = 'converter_extra'),
    'pedidos_nao_tocados', (select jsonb_agg(jsonb_build_object('contrato', c.nome, 'status', p.status_produtos, 'sem_necessidade', p.sem_necessidade,
        'destino', exists (select 1 from public.mat_pedido_itens i where i.pedido_id = p.id and (i.atendimento is not null or i.compra_item_id is not null))))
        from public.mat_pedidos p join public.mat_contratos c on c.id = p.contrato_id
       where p.competencia = date '2026-10-01' and exists (select 1 from public.mat_kit_itens k where k.contrato_id = p.contrato_id and k.quantidade > 0)
         and p.id not in (select pedido_id from _ped)),
    'kit_sem_pedido', (select jsonb_agg(c.nome) from public.mat_contratos c
       where exists (select 1 from public.mat_kit_itens k where k.contrato_id = c.id and k.quantidade > 0)
         and not exists (select 1 from public.mat_pedidos p where p.contrato_id = c.id and p.competencia = date '2026-10-01')),
    'envios_novos', (select count(*) from public.mat_pedido_envios where user_agent = 'completar-kit-2026-10-18'),
    'linhas_novas', (select count(*) from public.mat_pedido_itens i where i.envio_id in (select id from public.mat_pedido_envios where user_agent = 'completar-kit-2026-10-18')),
    'sem_preco_novas', (select count(*) from public.mat_pedido_itens i where i.preco_unitario is null and i.envio_id in (select id from public.mat_pedido_envios where user_agent = 'completar-kit-2026-10-18')),
    'total_linhas_pedido', (select count(*) from public.mat_pedido_itens i join public.mat_pedidos p on p.id = i.pedido_id where p.competencia = date '2026-10-01')
  )::text into r;
  raise exception 'TESTE_DESFEITO %', r;
end $t$;
`
fs.writeFileSync(`${DIR}/completar_kits_TESTE.sql`, teste, 'utf8')
console.log(`completar_kits.sql gerado (${valores.length} pares "não precisa" de itens do kit)`)
