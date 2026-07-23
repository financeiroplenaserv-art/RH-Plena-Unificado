-- ============================================================
-- Verificação pré go-live — achado M1 da auditoria (2026-07-23)
-- Rode no SQL Editor do Supabase (projeto jmdjdogskvybsdjtmpmb).
-- As migrations 011/035/039/044/045 criam as policies de storage
-- condicionalmente (IF EXISTS bucket). Se o bucket não existia na
-- época, nenhuma policy foi criada — falha silenciosa. Confira abaixo.
-- ============================================================

-- 1) Buckets: os dois devem existir com public = false
SELECT id, public, created_at
FROM storage.buckets
ORDER BY id;

-- Resultado esperado:
--   ocorrencia-anexos | false
--   vr-arquivos       | false
-- Se public = true em qualquer um, corrigir no dashboard:
--   Storage > bucket > Edit > desmarcar "Public bucket".

-- 2) Policies em storage.objects: esperadas 8 (4 por bucket)
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname, cmd;

-- Resultado esperado (8 linhas):
--   Permitir select de anexos de ocorrencias | SELECT
--   Permitir insert de anexos de ocorrencias | INSERT
--   Permitir update de anexos de ocorrencias | UPDATE
--   Permitir delete de anexos de ocorrencias | DELETE
--   Permitir select de vr-arquivos           | SELECT
--   Permitir insert de vr-arquivos           | INSERT
--   Permitir update de vr-arquivos           | UPDATE
--   Permitir delete de vr-arquivos           | DELETE
-- Se alguma estiver faltando, reaplicar as migrations 044 e 045
-- (o bucket existe agora, então o IF EXISTS vai passar).

-- 3) Conferência extra: definição das policies de SELECT
--    (devem exigir perfil autorizado + contexto válido, nunca "true")
SELECT policyname, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT'
ORDER BY policyname;
