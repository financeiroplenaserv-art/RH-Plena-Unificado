-- Migração 017: Adiciona regime de trabalho nos contratos de adicionais
-- Permite definir o padrão de dias trabalhados/folga para o calendário.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contratos_adicionais'
      AND column_name = 'regime_trabalho'
  ) THEN
    ALTER TABLE public.contratos_adicionais
      ADD COLUMN regime_trabalho text NOT NULL DEFAULT '12x36';
  END IF;
END $$;
