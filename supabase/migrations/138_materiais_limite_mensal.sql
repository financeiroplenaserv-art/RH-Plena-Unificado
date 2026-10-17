-- ============================================================
-- 138 — Materiais: limite mensal definido pelo gestor
-- ============================================================
-- Decisão da gestora (17/10/2026): o limite em R$ do contrato deixa de ser só
-- o cálculo (Kit Mensal × preço vigente). mat_contratos.limite_mensal
-- (numeric, R$): NULL = usar o cálculo pelo kit; preenchido = vale o manual
-- (o calculado segue como referência nas telas).
--
-- Quem edita: gestor/admin — a policy de UPDATE de mat_contratos já exige
-- pode_aprovar_materiais() (migration 121). Sem ação de permissão nova.
-- Sem tabela nova — sem GRANT de tabela. Backup:
-- dados-locais/backup_materiais_138_139_2026-10-17/mat_contratos.json
-- ============================================================

ALTER TABLE public.mat_contratos
  ADD COLUMN IF NOT EXISTS limite_mensal numeric(12,2);
ALTER TABLE public.mat_contratos
  DROP CONSTRAINT IF EXISTS mat_contratos_limite_mensal_ck;
ALTER TABLE public.mat_contratos
  ADD CONSTRAINT mat_contratos_limite_mensal_ck CHECK (limite_mensal IS NULL OR limite_mensal >= 0);
COMMENT ON COLUMN public.mat_contratos.limite_mensal IS
  'Limite mensal em R$ definido pelo gestor. NULL = calculado pelo kit (Σ quantidade × preço vigente). Migration 138.';
