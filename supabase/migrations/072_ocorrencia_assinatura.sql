-- Migração 072: Ocorrências — forma de assinatura e anexo de documento assinado
--
-- Complementa o fluxo de ocorrências após a geração do PDF para assinatura:
-- 1. Coluna ocorrencias.forma_assinatura: registra como o documento foi
--    assinado pelo colaborador — 'papel' (assinou o impresso) ou 'youk'
--    (enviado para assinatura eletrônica via Youk). Opcional (NULL =
--    não informado).
-- 2. Coluna ocorrencia_anexos.tipo_documento: distingue comprovantes
--    comuns ('comprovante', padrão) do documento assinado digitalizado
--    ('documento_assinado'). Anexos existentes permanecem 'comprovante'.
--
-- Nenhuma policy nova é necessária: as colunas herdam as policies das
-- tabelas (consolidadas nas migrations 058/059).

-- ============================================================
-- 1. Forma de assinatura na ocorrência
-- ============================================================

ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS forma_assinatura TEXT
  CHECK (forma_assinatura IN ('papel', 'youk'));

COMMENT ON COLUMN public.ocorrencias.forma_assinatura IS 'Como o registro foi assinado: papel = assinou o impresso; youk = enviado para assinatura eletrônica via Youk. NULL = não informado.';

-- ============================================================
-- 2. Tipo de documento no anexo
-- ============================================================

ALTER TABLE public.ocorrencia_anexos
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'comprovante'
  CHECK (tipo_documento IN ('comprovante', 'documento_assinado'));

COMMENT ON COLUMN public.ocorrencia_anexos.tipo_documento IS 'comprovante = prova da ocorrência (padrão); documento_assinado = registro de ocorrência assinado e digitalizado.';
