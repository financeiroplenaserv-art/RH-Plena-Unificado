-- Script de diagnóstico da auditoria
-- Execute no SQL Editor do Supabase para verificar se a auditoria está funcionando.
-- Este script não altera dados (somente leitura e um teste de inserção em log_auditoria
-- com rollback, se você estiver em transação).

-- 1. Verifica se a tabela log_auditoria existe
SELECT
  'Tabela log_auditoria existe' AS check_item,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'log_auditoria'
  ) AS ok;

-- 2. Verifica estrutura da tabela
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'log_auditoria'
ORDER BY ordinal_position;

-- 3. Verifica triggers de auditoria nas tabelas
SELECT
  tgname AS trigger_name,
  relname AS tabela,
  proname AS funcao
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE 'trigger_auditoria%'
ORDER BY relname;

-- 4. Verifica policies RLS da tabela log_auditoria
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'log_auditoria';

-- 5. Conta quantos registros de auditoria existem
SELECT
  COUNT(*) AS total_registros,
  MAX(created_at) AS ultimo_registro,
  MIN(created_at) AS primeiro_registro
FROM public.log_auditoria;

-- 6. Mostra os últimos 10 registros de auditoria
SELECT
  id,
  tabela,
  operacao,
  registro_id,
  usuario_id,
  created_at
FROM public.log_auditoria
ORDER BY created_at DESC
LIMIT 10;

-- 7. Verifica se funções de auditoria são SECURITY DEFINER
SELECT
  proname AS funcao,
  prosecdef AS security_definer
FROM pg_proc
WHERE proname IN ('auditar_operacao', 'auditar_permissoes_perfil');
