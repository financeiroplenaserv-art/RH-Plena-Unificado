-- Script de diagnóstico da auditoria
-- Execute cada query separadamente no SQL Editor do Supabase.

-- Query 1: Verifica se a tabela log_auditoria existe
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'log_auditoria'
) AS tabela_existe;

-- Query 2: Lista os triggers de auditoria
SELECT
  tgname AS trigger_name,
  relname AS tabela,
  proname AS funcao
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE 'trigger_auditoria%'
ORDER BY relname;

-- Query 3: Lista as policies RLS de log_auditoria
SELECT
  policyname,
  cmd,
  permissive,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'log_auditoria'
ORDER BY policyname;

-- Query 4: Conta registros e mostra ultimo registro
SELECT
  COUNT(*) AS total_registros,
  COALESCE(MAX(created_at)::text, 'nenhum') AS ultimo_registro
FROM public.log_auditoria;
