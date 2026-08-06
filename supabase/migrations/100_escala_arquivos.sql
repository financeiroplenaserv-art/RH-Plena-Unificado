-- ============================================================================
-- Migration 100: Persistir o Excel de marcações do Flit (Escalas) para
-- reutilização — espelha a migration 094 (espelhos de ponto do Adicionais)
--
-- Contexto: a tela Escalas → Importar processava o Excel apenas em memória.
-- Se o usuário saísse da tela, outro operador precisava ter o arquivo em mãos
-- para processar de novo. Agora o arquivo é salvo no bucket privado
-- `escala-arquivos` e registrado na tabela `escala_arquivos`, e a tela
-- oferece "Usar este arquivo" para reprocessar sem o Excel local.
--
-- Segurança/LGPD: o Excel contém matrículas e marcações — bucket privado,
-- SELECT/INSERT restritos a is_editor(), DELETE só is_admin().
-- ============================================================================

-- ------------------------------------------------------------
-- Bucket privado para os Excels de escala (xlsx/xls)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'escala-arquivos',
  'escala-arquivos',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------
-- Tabela de metadados dos arquivos enviados
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escala_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  tamanho_bytes bigint,
  enviado_por uuid REFERENCES public.perfis(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escala_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Editores podem ler arquivos de escala" ON public.escala_arquivos;
CREATE POLICY "Editores podem ler arquivos de escala"
ON public.escala_arquivos FOR SELECT
TO authenticated
USING (public.is_editor());

DROP POLICY IF EXISTS "Editores podem registrar arquivos de escala" ON public.escala_arquivos;
CREATE POLICY "Editores podem registrar arquivos de escala"
ON public.escala_arquivos FOR INSERT
TO authenticated
WITH CHECK (public.is_editor());

DROP POLICY IF EXISTS "Apenas admins podem excluir arquivos de escala" ON public.escala_arquivos;
CREATE POLICY "Apenas admins podem excluir arquivos de escala"
ON public.escala_arquivos FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------
-- Policies do bucket (storage.objects)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Editores podem ler escala-arquivos" ON storage.objects;
CREATE POLICY "Editores podem ler escala-arquivos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'escala-arquivos' AND public.is_editor());

DROP POLICY IF EXISTS "Editores podem inserir escala-arquivos" ON storage.objects;
CREATE POLICY "Editores podem inserir escala-arquivos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'escala-arquivos' AND public.is_editor());

DROP POLICY IF EXISTS "Apenas admins podem deletar escala-arquivos" ON storage.objects;
CREATE POLICY "Apenas admins podem deletar escala-arquivos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'escala-arquivos' AND public.is_admin());
