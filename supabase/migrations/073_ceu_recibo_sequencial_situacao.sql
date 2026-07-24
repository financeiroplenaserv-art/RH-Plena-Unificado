-- 073_ceu_recibo_sequencial_situacao.sql
-- CEU: número de recibo sequencial e único + situação da entrega persistida.
--
-- Contexto: os recibos CEU (EPI / Uniforme / Crachá) usavam número aleatório
-- gerado no navegador, sem gravação — reemitir um recibo produzia outro número.
-- A situação do item (Novo, Substituição, Troca, Extravio/Perda) era fixa em
-- "Novo" e não ficava registrada na entrega.
--
-- Esta migration:
--   1. Adiciona entregas.numero_recibo (preenchido na emissão do recibo;
--      a reemissão reutiliza o mesmo número).
--   2. Adiciona entregas.situacao (padrão 'Novo').
--   3. Cria a sequência global ceu_recibo_seq e a função
--      proximo_numero_recibo() → 'REC-AAAA-NNNNN'.
--
-- Nenhuma policy de outras tabelas é alterada.

alter table public.entregas
  add column if not exists numero_recibo text,
  add column if not exists situacao text not null default 'Novo';

create sequence if not exists public.ceu_recibo_seq start with 1;

create or replace function public.proximo_numero_recibo()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ceu_recibo_seq')::text, 5, '0');
end;
$$;

revoke all on function public.proximo_numero_recibo() from public;
grant execute on function public.proximo_numero_recibo() to authenticated;
