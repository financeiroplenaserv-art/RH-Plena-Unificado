-- Migração 016: Adiciona coluna quantidade_colaboradores em contratos_adicionais
-- O formulário de contratos já envia esse campo, mas ele não existia no schema.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contratos_adicionais'
      AND column_name = 'quantidade_colaboradores'
  ) THEN
    ALTER TABLE public.contratos_adicionais
      ADD COLUMN quantidade_colaboradores integer NOT NULL DEFAULT 0;
  END IF;
END $$;
