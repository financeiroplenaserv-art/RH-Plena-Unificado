-- 090_proximo_numero_recibo_permissao.sql
-- CEU: proximo_numero_recibo() passa a exigir is_editor().
--
-- Contexto: a função (migration 073) é SECURITY DEFINER e gera o próximo
-- número sequencial de recibo CEU sem nenhuma checagem — qualquer usuário
-- autenticado (inclusive visualizador) podia chamá-la via PostgREST e
-- "queimar" números da sequência ceu_recibo_seq.
--
-- A guarda usa is_editor() — a mesma função das policies de INSERT/UPDATE de
-- public.entregas (migration 037) — para não bloquear nenhum perfil que
-- emite recibos CEU legitimamente (gestor, dp1, dp2, mesa, inspetoria...).
-- O frontend (useCEUEntregas.proximoNumeroRecibo) já trata erro da RPC com
-- fallback para o formato aleatório antigo, então um visualizador não quebra
-- a tela — apenas não consome a sequência.

create or replace function public.proximo_numero_recibo()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_editor() then
    raise exception 'Sem permissão para gerar número de recibo';
  end if;
  return 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.ceu_recibo_seq')::text, 5, '0');
end;
$$;

revoke all on function public.proximo_numero_recibo() from public;
grant execute on function public.proximo_numero_recibo() to authenticated;
