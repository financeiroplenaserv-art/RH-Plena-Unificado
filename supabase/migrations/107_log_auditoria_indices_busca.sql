-- Migration 107 — índices para a busca da Auditoria (timeout com filtro, 28/08/2026)
--
-- A busca da página usa ILIKE '%termo%' em tabela/operacao/registro_id.
-- Curinga inicial não usa índice btree: a query de dados ordenava por
-- created_at (LIMIT 50) filtrando linha a linha — 13,4s para 150 mil linhas,
-- estourando o statement timeout de 8s da role authenticated.
--
-- Solução: pg_trgm (índices GIN para substring) + btree em usuario_id
-- (o OR da busca também consulta usuario_id quando o termo é nome de usuário).
--
-- Depende da 106 (policy com InitPlan) — juntas, count e dados ficam < 1s.

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_log_auditoria_tabela_trgm
  on public.log_auditoria using gin (tabela extensions.gin_trgm_ops);

create index if not exists idx_log_auditoria_operacao_trgm
  on public.log_auditoria using gin (operacao extensions.gin_trgm_ops);

create index if not exists idx_log_auditoria_registro_trgm
  on public.log_auditoria using gin (registro_id extensions.gin_trgm_ops);

create index if not exists idx_log_auditoria_usuario_id
  on public.log_auditoria (usuario_id);
