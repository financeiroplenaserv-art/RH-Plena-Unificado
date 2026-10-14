-- 127_materiais_categorias.sql
-- Decisão da gestão (14/10/2026): categorias do catálogo de materiais passam de
-- (limpeza, portaria, outros) para 5: limpeza, portaria, descartaveis,
-- acessorios e piscina. mat_itens estava VAZIA na data (carga inicial ainda não
-- aplicada), então não há backfill. Sem tabela nova — sem GRANT de tabela.
-- Regra do link do líder: só 'portaria' tem tratamento próprio; as demais
-- categorias contam como material de limpeza (contrato com recebe_limpeza=false
-- continua aceitando apenas portaria).

begin;

-- Segurança: a migration pressupõe que não há linha com categoria antiga.
do $$
begin
  if exists (select 1 from public.mat_itens where categoria = 'outros') then
    raise exception 'mat_itens tem itens com categoria "outros": converta-os antes (piscina/acessorios/...)';
  end if;
end $$;

-- O CHECK da 121 é inline (nome automático); remove qualquer CHECK que cite categoria.
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.mat_itens'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%categoria%'
  loop
    execute format('alter table public.mat_itens drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.mat_itens
  add constraint mat_itens_categoria_check
  check (categoria in ('limpeza', 'portaria', 'descartaveis', 'acessorios', 'piscina'));

commit;
