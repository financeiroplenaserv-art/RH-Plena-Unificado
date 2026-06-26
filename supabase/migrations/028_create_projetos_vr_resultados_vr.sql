-- Migração 028: Cria tabelas do módulo VR (projetos_vr e resultados_vr)
--
-- Contexto: as migrations anteriores (ex: 014) já aplicam RLS nessas tabelas,
-- mas seus CREATE TABLE não estavam versionados no repositório. Esta migration
-- cria as tabelas e garante as policies corretas.

-- ============================================================
-- projetos_vr
-- ============================================================

CREATE TABLE IF NOT EXISTS public.projetos_vr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_corte date NOT NULL,
  data_efetivacao date NOT NULL,
  configuracao_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.projetos_vr IS 'Projetos de cálculo de Vale Refeição (VR)';

CREATE INDEX IF NOT EXISTS idx_projetos_vr_data_corte ON public.projetos_vr(data_corte);
CREATE INDEX IF NOT EXISTS idx_projetos_vr_created_at ON public.projetos_vr(created_at);

-- ============================================================
-- resultados_vr
-- ============================================================

CREATE TABLE IF NOT EXISTS public.resultados_vr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos_vr(id) ON DELETE CASCADE,
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  nome text,
  cpf text,
  matricula text,
  dias_elegiveis integer NOT NULL DEFAULT 0,
  dias_pdf integer NOT NULL DEFAULT 0,
  dias_escala integer NOT NULL DEFAULT 0,
  dias_abatimento integer NOT NULL DEFAULT 0,
  valor_bruto numeric(10, 2) NOT NULL DEFAULT 0,
  extra numeric(10, 2) NOT NULL DEFAULT 0,
  detalhes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.resultados_vr IS 'Resultados de cálculo de VR por colaborador';

CREATE INDEX IF NOT EXISTS idx_resultados_vr_projeto_id ON public.resultados_vr(projeto_id);
CREATE INDEX IF NOT EXISTS idx_resultados_vr_colaborador_id ON public.resultados_vr(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_resultados_vr_cpf ON public.resultados_vr(cpf);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.projetos_vr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_vr ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas caso existam
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.projetos_vr;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.projetos_vr;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.resultados_vr;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.resultados_vr;

-- Projetos VR
CREATE POLICY "Permitir select para autenticados" ON public.projetos_vr
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insert para editores" ON public.projetos_vr
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update para editores" ON public.projetos_vr
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete apenas para admins" ON public.projetos_vr
  FOR DELETE TO authenticated USING (public.is_admin());

-- Resultados VR
CREATE POLICY "Permitir select para autenticados" ON public.resultados_vr
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insert para editores" ON public.resultados_vr
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update para editores" ON public.resultados_vr
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE POLICY "Permitir delete apenas para admins" ON public.resultados_vr
  FOR DELETE TO authenticated USING (public.is_admin());
