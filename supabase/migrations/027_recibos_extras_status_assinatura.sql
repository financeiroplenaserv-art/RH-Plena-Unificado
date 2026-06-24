-- Migração 027: Adiciona fluxo de assinatura posterior nos recibos de extras

-- Adiciona data de assinatura para controle
ALTER TABLE public.recibos_extras
ADD COLUMN IF NOT EXISTS data_assinatura timestamptz;

-- Atualiza comentário da tabela
COMMENT ON TABLE public.recibos_extras IS 'Recibos de pagamento de extras. Podem ser criados pendentes de assinatura e assinados posteriormente pelo colaborador.';

-- Atualiza comentário da coluna status
COMMENT ON COLUMN public.recibos_extras.status IS 'Status do recibo: pendente_assinatura, assinado ou cancelado';

-- Garante que recibos pendentes podem existir sem assinatura
COMMENT ON COLUMN public.recibos_extras.assinatura_colaborador IS 'Imagem PNG da assinatura em base64. Pode ser nula enquanto o recibo estiver pendente de assinatura.';
