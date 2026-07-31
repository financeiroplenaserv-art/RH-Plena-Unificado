-- ============================================================================
-- Migration 094: Persistir o espelho de ponto (PDF do Flit) para reutilização
--
-- Contexto: a tela Adicionais → Importar Ponto processava o PDF apenas em
-- memória. Se o usuário saísse da tela, outro operador (ex.: mesa) precisava
-- ter o arquivo em mãos para processar de novo. Agora o arquivo é salvo no
-- bucket privado `ponto-espelhos` e registrado na tabela
-- `ponto_espelho_arquivos`, e a tela oferece "Usar este arquivo" para
-- reprocessar sem o PDF local.
--
-- Segurança/LGPD: o espelho contém CPFs — bucket privado, SELECT/INSERT
-- restritos a is_editor() (adm, gestor, rh, dp1, dp2, mesa, inspetoria,
-- financeiro), DELETE só is_admin(). Mesmo desenho das migrations 011/083.
-- ============================================================================

-- ------------------------------------------------------------
-- Bucket privado para os espelhos de ponto (somente PDF)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ponto-espelhos',
  'ponto-espelhos',
  false,
  52428800, -- 50 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------
-- Tabela de metadados dos arquivos enviados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ponto_espelho_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  tamanho_bytes bigint,
  enviado_por uuid REFERENCES public.perfis(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ponto_espelho_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Editores podem ler espelhos de ponto" ON public.ponto_espelho_arquivos;
CREATE POLICY "Editores podem ler espelhos de ponto"
ON public.ponto_espelho_arquivos FOR SELECT
TO authenticated
USING (public.is_editor());

DROP POLICY IF EXISTS "Editores podem registrar espelhos de ponto" ON public.ponto_espelho_arquivos;
CREATE POLICY "Editores podem registrar espelhos de ponto"
ON public.ponto_espelho_arquivos FOR INSERT
TO authenticated
WITH CHECK (public.is_editor());

DROP POLICY IF EXISTS "Apenas admins podem excluir espelhos de ponto" ON public.ponto_espelho_arquivos;
CREATE POLICY "Apenas admins podem excluir espelhos de ponto"
ON public.ponto_espelho_arquivos FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------
-- Policies do bucket (storage.objects)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Editores podem ler ponto-espelhos" ON storage.objects;
CREATE POLICY "Editores podem ler ponto-espelhos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ponto-espelhos' AND public.is_editor());

DROP POLICY IF EXISTS "Editores podem inserir ponto-espelhos" ON storage.objects;
CREATE POLICY "Editores podem inserir ponto-espelhos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ponto-espelhos' AND public.is_editor());

DROP POLICY IF EXISTS "Apenas admins podem deletar ponto-espelhos" ON storage.objects;
CREATE POLICY "Apenas admins podem deletar ponto-espelhos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ponto-espelhos' AND public.is_admin());
