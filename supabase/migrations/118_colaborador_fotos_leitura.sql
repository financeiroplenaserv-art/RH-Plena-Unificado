-- Migração 118: leitura das fotos de colaboradores para quem vê o cadastro
--
-- PENDENTE DE APLICAÇÃO (escrita em 02/10/2026; aplicar manualmente após backup).
--
-- Decisão da gestão (02/10/2026, "opção B"): todos os perfis que podem ver o
-- cadastro de colaboradores (pode_ver_colaboradores()) também veem as fotos
-- (lista, janela lateral e ficha). Upload/troca/remoção continuam só para quem
-- emite crachás (pode_emitir_cracha()) — INSERT/UPDATE/DELETE inalterados (117).
-- A leitura segue por URL assinada (bucket privado). Não cria tabela — sem GRANT.

DROP POLICY IF EXISTS "Emissores podem ler colaborador-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Quem vê colaboradores pode ler colaborador-fotos" ON storage.objects;
CREATE POLICY "Quem vê colaboradores pode ler colaborador-fotos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'colaborador-fotos'
  AND (public.pode_ver_colaboradores() OR public.pode_emitir_cracha())
);
