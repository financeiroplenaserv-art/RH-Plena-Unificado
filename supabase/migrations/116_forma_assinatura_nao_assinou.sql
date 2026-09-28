-- Migração 116: forma_assinatura aceita 'nao_assinou'
--
-- Decisão da gestão: o campo Assinatura do card Dados da Ocorrência ganha a
-- opção "Não assinou" (colaborador se recusou / não assinou o documento), para
-- o registro não ficar como "não informado". A coluna tinha CHECK
-- ('papel', 'youk') desde a migration 072 — recria incluindo o novo valor.
-- Não cria tabela — sem GRANT necessário.

ALTER TABLE public.ocorrencias
  DROP CONSTRAINT IF EXISTS ocorrencias_forma_assinatura_check;

ALTER TABLE public.ocorrencias
  ADD CONSTRAINT ocorrencias_forma_assinatura_check
  CHECK (forma_assinatura IN ('papel', 'youk', 'nao_assinou'));

COMMENT ON COLUMN public.ocorrencias.forma_assinatura IS 'Como o registro foi assinado: papel = assinou o impresso; youk = enviado para assinatura eletrônica via Youk; nao_assinou = colaborador não assinou. NULL = não informado.';
