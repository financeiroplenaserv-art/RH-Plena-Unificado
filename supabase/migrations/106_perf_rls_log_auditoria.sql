-- Migration 106 — performance da RLS em log_auditoria (timeout na Auditoria, 28/08/2026)
--
-- A policy usava `is_admin() OR is_editor()` direto no qual. Funções SECURITY
-- DEFINER não são inlined pelo planner, então o filtro era avaliado POR LINHA
-- (~26µs × 150 mil linhas ≈ 4s) — junto com o count exato da paginação,
-- estourava o statement timeout do PostgREST ("canceling statement due to
-- statement timeout").
--
-- O wrapper `(select ...)` transforma a chamada em InitPlan: avaliada UMA vez
-- por query. Mesmo efeito de segurança, custo desprezível.
--
-- (O VACUUM ANALYZE de 28/08/2026 já havia resolvido a outra metade do
-- problema — heap fetches no count — mas sozinho não bastava.)

drop policy if exists "Permitir select de log_auditoria" on public.log_auditoria;

create policy "Permitir select de log_auditoria"
  on public.log_auditoria
  for select
  to authenticated
  using ((select public.is_admin()) or (select public.is_editor()));
