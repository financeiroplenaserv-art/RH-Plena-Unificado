-- Migração 019: Adiciona departamento_id à tabela extras

ALTER TABLE public.extras
  ADD COLUMN IF NOT EXISTS departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS departamento_nome text;

CREATE INDEX IF NOT EXISTS idx_extras_departamento_id ON public.extras(departamento_id);
