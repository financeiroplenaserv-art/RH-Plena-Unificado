-- Migração 012: Remove policies antigas de storage que concedem permissão total (ALL)
-- e conflitam com as regras da migration 011.
--
-- As policies removidas abaixo davam permissão ALL para qualquer usuário autenticado,
-- anulando a restrição de DELETE apenas para administradores.

DROP POLICY IF EXISTS "Permitir admin e rh vr" ON storage.objects;
DROP POLICY IF EXISTS "Permitir admin e rh ocorrencias" ON storage.objects;
