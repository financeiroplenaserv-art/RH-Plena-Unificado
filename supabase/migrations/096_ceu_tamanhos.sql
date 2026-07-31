-- ============================================================================
-- Migration 096: tamanhos de uniforme/EPI passam a viver no módulo CEU
--
-- Decisão da gestão (31/07/2026): as medidas (camisa, calça, calçado, luva)
-- não dizem respeito a todos os usuários do cadastro de colaboradores — são
-- dado operacional do CEU. Nova tabela `ceu_tamanhos` (1:1 com colaborador),
-- editada na aba "Tamanhos" do módulo CEU e lida pelo Lançamento Rápido.
-- As colunas legadas colaboradores.tamanho_* permanecem (não são mais lidas
-- pelo app); os dados existentes são copiados para a nova tabela.
-- RLS: SELECT/INSERT/UPDATE com is_editor(), DELETE só is_admin().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ceu_tamanhos (
  colaborador_id uuid PRIMARY KEY REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tamanho_camisa text,
  tamanho_calca text,
  tamanho_calcado text,
  tamanho_luva text,
  updated_by uuid REFERENCES public.perfis(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ceu_tamanhos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Editores podem ler ceu_tamanhos" ON public.ceu_tamanhos;
CREATE POLICY "Editores podem ler ceu_tamanhos"
ON public.ceu_tamanhos FOR SELECT
TO authenticated
USING (public.is_editor());

DROP POLICY IF EXISTS "Editores podem inserir ceu_tamanhos" ON public.ceu_tamanhos;
CREATE POLICY "Editores podem inserir ceu_tamanhos"
ON public.ceu_tamanhos FOR INSERT
TO authenticated
WITH CHECK (public.is_editor());

DROP POLICY IF EXISTS "Editores podem atualizar ceu_tamanhos" ON public.ceu_tamanhos;
CREATE POLICY "Editores podem atualizar ceu_tamanhos"
ON public.ceu_tamanhos FOR UPDATE
TO authenticated
USING (public.is_editor())
WITH CHECK (public.is_editor());

DROP POLICY IF EXISTS "Apenas admins podem excluir ceu_tamanhos" ON public.ceu_tamanhos;
CREATE POLICY "Apenas admins podem excluir ceu_tamanhos"
ON public.ceu_tamanhos FOR DELETE
TO authenticated
USING (public.is_admin());

-- Backfill: copia as medidas já registradas no cadastro de colaboradores
INSERT INTO public.ceu_tamanhos (colaborador_id, tamanho_camisa, tamanho_calca, tamanho_calcado, tamanho_luva)
SELECT id, tamanho_camisa, tamanho_calca, tamanho_calcado, tamanho_luva
FROM public.colaboradores
WHERE tamanho_camisa IS NOT NULL
   OR tamanho_calca IS NOT NULL
   OR tamanho_calcado IS NOT NULL
   OR tamanho_luva IS NOT NULL
ON CONFLICT (colaborador_id) DO NOTHING;
