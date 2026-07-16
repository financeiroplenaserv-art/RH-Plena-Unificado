-- Adiciona data de início do contrato aos departamentos

ALTER TABLE public.departamentos
  ADD COLUMN IF NOT EXISTS data_inicio_contrato date;
