-- Migration 108 — RPC buscar_log_auditoria (timeout na Auditoria com busca, 28/08/2026)
--
-- Cadeia de causa raiz do "canceling statement due to statement timeout":
-- 1. A busca (ILIKE '%termo%') não usava índice; ORDER BY created_at + LIMIT 50
--    andava o índice inteiro filtrando linha a linha (15s+ em 150 mil linhas).
-- 2. Os índices trigram (migration 107) resolveriam, MAS a policy RLS com
--    função não-leakproof (is_admin/is_editor) cria barreira de segurança que
--    impede o planner de usar os índices GIN sob RLS — confirmado: sem a policy
--    o plano bitmap leva 25ms; com ela, 15-20s. LEAKPROOF exige superuser real
--    (o Supabase não concede), então a saída suportada é função SECURITY
--    DEFINER: o dono (postgres) ignora o RLS, a autorização é verificada no
--    corpo e a query interna usa os índices livremente.
--
-- A policy da migration 106 permanece (defesa em profundidade para acessos
-- diretos); a listagem da página passa a vir desta RPC.

create or replace function public.buscar_log_auditoria(
  p_tabela text default null,
  p_registro_id text default null,
  p_busca text default null,
  p_usuario_ids uuid[] default null,
  p_data_inicio timestamptz default null,
  p_data_fim timestamptz default null,
  p_limite int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  tabela text,
  registro_id text,
  operacao text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $func$
begin
  -- A função é SECURITY DEFINER (ignora RLS): exige admin/editor explicitamente
  if not (public.is_admin() or public.is_editor()) then
    raise insufficient_privilege;
  end if;

  return query
    select
      l.id, l.tabela, l.registro_id, l.operacao, l.dados_anteriores,
      l.dados_novos, l.usuario_id, l.created_at,
      count(*) over () as total_count
    from public.log_auditoria l
    where (p_tabela is null or l.tabela = p_tabela)
      and (p_registro_id is null or l.registro_id = p_registro_id)
      and (p_data_inicio is null or l.created_at >= p_data_inicio)
      and (p_data_fim is null or l.created_at <= p_data_fim)
      and (
        p_busca is null
        or l.tabela ilike '%' || p_busca || '%'
        or l.operacao ilike '%' || p_busca || '%'
        or l.registro_id ilike '%' || p_busca || '%'
        or (p_usuario_ids is not null and l.usuario_id = any (p_usuario_ids))
      )
    order by l.created_at desc
    limit p_limite offset p_offset;
end;
$func$;

revoke all on function public.buscar_log_auditoria(text, text, text, uuid[], timestamptz, timestamptz, int, int) from public, anon;
grant execute on function public.buscar_log_auditoria(text, text, text, uuid[], timestamptz, timestamptz, int, int) to authenticated;
