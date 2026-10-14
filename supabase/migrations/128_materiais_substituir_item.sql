-- 128_materiais_substituir_item.sql
-- Módulo Materiais — "Substituir em todos os kits" (pedido da gestão, 14/10/2026).
-- Caso de uso: o detergente X foi descontinuado e trocado pelo Y em todos os
-- contratos. VERSIONADA, NÃO APLICADA.
--
--  A) Vínculo de substituição SEM reescrever dados originais:
--     mat_itens.substituido_por_id / substituido_por_variacao_id / substituido_em
--     (item inteiro substituído) e as mesmas colunas em mat_item_variacoes
--     (só uma variação substituída — o item continua vivo). A média de consumo
--     do item novo soma o histórico dos itens/variações que ele substituiu
--     seguindo a cadeia X→Y→W (src/lib/materiais/substituicao.ts, com proteção
--     contra ciclo). mat_historico_consumo, mat_pedido_itens e mat_aliases NÃO
--     são alterados.
--  B) RPC mat_substituir_item_kits: troca o item em todas as linhas de kit
--     (contratos ativos E inativos), mantendo quantidade e periodicidade; se o
--     contrato já tem o destino, SOMA numa linha só (vale a periodicidade da
--     linha que já existia). Solicitações de alteração de kit PENDENTES da
--     origem passam para o destino (senão, aprovadas depois, devolveriam o item
--     antigo ao kit); as já decididas são registro histórico e ficam.
--     Opcionalmente grava o vínculo (levar histórico) e inativa a origem.
--     Pedidos (mat_pedido_itens) nunca são tocados.
--
-- Sem tabela nova — sem GRANT de tabela. Escrita só pela RPC (SECURITY
-- DEFINER, reconfere pode_aprovar_materiais(): admin/adm/gestor). O trigger
-- trg_mat_kit_touch continua carimbando updated_at/atualizado_por.

begin;

-- ============================================================
-- A) Colunas de vínculo
-- ============================================================
alter table public.mat_itens
  add column if not exists substituido_por_id uuid references public.mat_itens(id),
  add column if not exists substituido_por_variacao_id uuid references public.mat_item_variacoes(id),
  add column if not exists substituido_em date;

alter table public.mat_item_variacoes
  add column if not exists substituido_por_id uuid references public.mat_itens(id),
  add column if not exists substituido_por_variacao_id uuid references public.mat_item_variacoes(id),
  add column if not exists substituido_em date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mat_itens_substituido_nao_si_mesmo') then
    alter table public.mat_itens
      add constraint mat_itens_substituido_nao_si_mesmo
      check (substituido_por_id is null or substituido_por_id <> id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mat_item_variacoes_substituido_nao_si_mesma') then
    alter table public.mat_item_variacoes
      add constraint mat_item_variacoes_substituido_nao_si_mesma
      check (substituido_por_variacao_id is null or substituido_por_variacao_id <> id);
  end if;
end $$;

comment on column public.mat_itens.substituido_por_id is
  'Item que substituiu este em todos os kits (migration 128). A média do substituto soma o histórico deste.';
comment on column public.mat_item_variacoes.substituido_por_id is
  'Item que substituiu SÓ esta variação (migration 128). A média do substituto soma o histórico desta variação.';

-- ============================================================
-- B) RPC
-- ============================================================
create or replace function public.mat_substituir_item_kits(
  p_de uuid,
  p_de_variacao uuid,
  p_para uuid,
  p_para_variacao uuid,
  p_inativar boolean default true,
  p_levar_historico boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zero constant uuid := '00000000-0000-0000-0000-000000000000';
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_para public.mat_itens%rowtype;
  v_dest public.mat_kit_itens%rowtype;
  k record;
  v_contratos uuid[] := '{}';
  v_contratos_soma uuid[] := '{}';
  v_trocadas integer := 0;
  v_somadas integer := 0;
  v_alteracoes integer := 0;
  v_no_item uuid;
  v_no_var uuid;
  v_prox_item uuid;
  v_prox_var uuid;
  i integer;
begin
  if not public.pode_aprovar_materiais() then
    raise exception 'Sem permissão para substituir itens nos kits';
  end if;
  if p_de is null or p_para is null then
    raise exception 'Informe o item de origem e o item de destino';
  end if;
  -- Origem = destino é bloqueado; só a troca de variação dentro do mesmo item é aceita.
  if p_de = p_para and (p_de_variacao is null or p_para_variacao is null or p_de_variacao = p_para_variacao) then
    raise exception 'A origem e o destino são o mesmo item';
  end if;

  -- Trava os dois itens (ordem fixa por id evita deadlock entre substituições simultâneas).
  perform 1 from public.mat_itens where id in (p_de, p_para) order by id for update;

  if not exists (select 1 from public.mat_itens where id = p_de) then
    raise exception 'Item de origem não encontrado';
  end if;
  select * into v_para from public.mat_itens where id = p_para;
  if not found then
    raise exception 'Item de destino não encontrado';
  end if;
  if not v_para.ativo then
    raise exception 'O item de destino está inativo';
  end if;
  if p_de_variacao is not null
     and not exists (select 1 from public.mat_item_variacoes where id = p_de_variacao and item_id = p_de) then
    raise exception 'A variação de origem não pertence ao item de origem';
  end if;
  if p_para_variacao is not null then
    if not exists (select 1 from public.mat_item_variacoes where id = p_para_variacao and item_id = p_para and ativo) then
      raise exception 'A variação de destino não pertence ao item de destino ou está inativa';
    end if;
  elsif exists (select 1 from public.mat_item_variacoes where item_id = p_para and ativo) then
    raise exception 'O item de destino tem variações: escolha a variação de destino';
  end if;

  -- Ciclo: o destino já leva (pela cadeia de vínculos) de volta à origem?
  if p_levar_historico then
    v_no_item := p_para;
    v_no_var := p_para_variacao;
    for i in 1..50 loop
      exit when v_no_item is null;
      if v_no_item = p_de and (p_de_variacao is null or v_no_var is not distinct from p_de_variacao) then
        raise exception 'Substituição inválida: o item de destino já foi substituído (direta ou indiretamente) pelo de origem';
      end if;
      v_prox_item := null;
      v_prox_var := null;
      if v_no_var is not null then
        select substituido_por_id, substituido_por_variacao_id into v_prox_item, v_prox_var
          from public.mat_item_variacoes where id = v_no_var;
      end if;
      if v_prox_item is null then
        select substituido_por_id, substituido_por_variacao_id into v_prox_item, v_prox_var
          from public.mat_itens where id = v_no_item;
      end if;
      v_no_item := v_prox_item;
      v_no_var := v_prox_var;
    end loop;
  end if;

  -- Linhas de kit: contratos ativos E inativos. Ordem por id = mesma da prévia.
  for k in
    select * from public.mat_kit_itens
     where item_id = p_de
       and (p_de_variacao is null or variacao_id = p_de_variacao)
       and not (item_id = p_para and coalesce(variacao_id, v_zero) = coalesce(p_para_variacao, v_zero))
     order by id
     for update
  loop
    select * into v_dest from public.mat_kit_itens
     where contrato_id = k.contrato_id
       and item_id = p_para
       and coalesce(variacao_id, v_zero) = coalesce(p_para_variacao, v_zero)
     for update;
    if found then
      -- O contrato já tem o destino: soma numa linha só (vale a periodicidade dela).
      update public.mat_kit_itens
         set quantidade = quantidade + k.quantidade,
             observacao = coalesce(observacao, k.observacao)
       where id = v_dest.id;
      delete from public.mat_kit_itens where id = k.id;
      v_somadas := v_somadas + 1;
      if not (k.contrato_id = any (v_contratos_soma)) then
        v_contratos_soma := v_contratos_soma || k.contrato_id;
      end if;
    else
      -- Troca no lugar: mantém id, quantidade, periodicidade e observação.
      update public.mat_kit_itens
         set item_id = p_para, variacao_id = p_para_variacao
       where id = k.id;
    end if;
    v_trocadas := v_trocadas + 1;
    if not (k.contrato_id = any (v_contratos)) then
      v_contratos := v_contratos || k.contrato_id;
    end if;
  end loop;

  -- Solicitações pendentes passam para o destino (as decididas ficam como estão).
  update public.mat_kit_alteracoes
     set item_id = p_para, variacao_id = p_para_variacao
   where status = 'pendente'
     and item_id = p_de
     and (p_de_variacao is null or variacao_id = p_de_variacao);
  get diagnostics v_alteracoes = row_count;

  -- Vínculo de histórico (sem reescrever o histórico original).
  if p_levar_historico then
    if p_de_variacao is null then
      update public.mat_itens
         set substituido_por_id = p_para, substituido_por_variacao_id = p_para_variacao, substituido_em = v_hoje
       where id = p_de;
    else
      update public.mat_item_variacoes
         set substituido_por_id = p_para, substituido_por_variacao_id = p_para_variacao, substituido_em = v_hoje
       where id = p_de_variacao;
    end if;
  end if;

  -- Inativação: o item inteiro, ou só a variação quando a origem é uma variação.
  if p_inativar then
    if p_de_variacao is null then
      update public.mat_itens set ativo = false where id = p_de;
    else
      update public.mat_item_variacoes set ativo = false where id = p_de_variacao;
    end if;
  end if;

  return jsonb_build_object(
    'contratos', coalesce(array_length(v_contratos, 1), 0),
    'linhas_trocadas', v_trocadas,
    'linhas_somadas', v_somadas,
    'contratos_com_soma', coalesce(array_length(v_contratos_soma, 1), 0),
    'alteracoes_pendentes', v_alteracoes,
    'inativado', coalesce(p_inativar, false),
    'historico_vinculado', coalesce(p_levar_historico, false)
  );
end $$;

revoke all on function public.mat_substituir_item_kits(uuid, uuid, uuid, uuid, boolean, boolean) from public, anon;
grant execute on function public.mat_substituir_item_kits(uuid, uuid, uuid, uuid, boolean, boolean) to authenticated;

commit;
