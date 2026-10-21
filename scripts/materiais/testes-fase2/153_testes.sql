-- ===== testes 153 (depois da 153, na mesma transação; SEMPRE com rollback) =====
-- Limite mensal de uniforme/EPI/crachá + custo do crachá na config.
-- Perfis reais: 6e49ec30 = gestor, 7619cc8f = mesa.

-- 0) coluna existe, nasce NULL e a restrição recusa negativo
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='mat_contratos' and column_name='limite_mensal_ceu') then
    raise exception 'FALHOU 0: coluna ausente';
  end if;
  if exists (select 1 from mat_contratos where limite_mensal_ceu is not null) then
    raise exception 'FALHOU 0: deveria nascer NULL (sem dados carregados)';
  end if;
  begin
    update mat_contratos set limite_mensal_ceu = -1 where id = (select id from mat_contratos limit 1);
    raise exception 'FALHOU 0: aceitou limite negativo';
  exception when check_violation then null;
  end;
end $$;

-- 1) gestor grava o limite (UPDATE com linha afetada) e a config do crachá
select set_config('request.jwt.claims','{"sub":"6e49ec30-f2f4-45fd-af7b-b1f26dfbdba4","role":"authenticated"}',true);
set local role authenticated;
do $$
declare n int; r jsonb;
begin
  update mat_contratos set limite_mensal_ceu = 800.50 where id = (select id from mat_contratos order by nome limit 1);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU 1: gestor não conseguiu gravar o limite do CEU'; end if;
  r := mat_salvar_config('{"custo_cracha_sem_cordinha": 6, "custo_cracha_com_cordinha": 8}'::jsonb);
  if (r ->> 'custo_cracha_sem_cordinha')::numeric <> 6 or (r ->> 'custo_cracha_com_cordinha')::numeric <> 8 then
    raise exception 'FALHOU 1: config do crachá não gravou';
  end if;
  -- null = não definido; as outras chaves continuam
  r := mat_salvar_config('{"custo_cracha_com_cordinha": null}'::jsonb);
  if jsonb_typeof(r -> 'custo_cracha_com_cordinha') <> 'null' or (r ->> 'custo_cracha_sem_cordinha')::numeric <> 6 then
    raise exception 'FALHOU 1: null/mescla da config';
  end if;
  -- valor inválido e chave desconhecida são recusados
  begin
    perform mat_salvar_config('{"custo_cracha_sem_cordinha": -2}'::jsonb);
    raise exception 'FALHOU 1: aceitou custo negativo';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform mat_salvar_config('{"custo_cracha_sem_cordinha": "6"}'::jsonb);
    raise exception 'FALHOU 1: aceitou texto';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  begin
    perform mat_salvar_config('{"custo_inventado": 1}'::jsonb);
    raise exception 'FALHOU 1: aceitou chave desconhecida';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;

-- 2) mesa NÃO altera o limite (RLS: 0 linhas) nem a config
select set_config('request.jwt.claims','{"sub":"7619cc8f-2a64-43a2-883e-13ee0c0b48d8","role":"authenticated"}',true);
set local role authenticated;
do $$
declare n int;
begin
  update mat_contratos set limite_mensal_ceu = 1 where id = (select id from mat_contratos order by nome limit 1);
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU 2: mesa alterou o limite do CEU'; end if;
  begin
    perform mat_salvar_config('{"custo_cracha_sem_cordinha": 1}'::jsonb);
    raise exception 'FALHOU 2: mesa alterou a config';
  exception when raise_exception then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
end $$;
reset role;
