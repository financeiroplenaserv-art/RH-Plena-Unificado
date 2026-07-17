-- Migração 060: Garante todas as colunas da tabela departamentos
--
-- Contexto: o frontend seleciona colunas como contato_portaria, bairro,
-- cidade, estado, cep, nome_contato_2, telefone_contato_2, email_contato_2 e
-- data_inicio_contrato. Se as migrations 008, 009 e/ou 057 não foram aplicadas,
-- ocorre o erro "column departamentos.<coluna> does not exist" em todas as
-- páginas que carregam departamentos.
--
-- Esta migration é idempotente: usa ADD COLUMN IF NOT EXISTS, então pode ser
-- executada mesmo se parte das colunas já existir.

ALTER TABLE public.departamentos
  ADD COLUMN IF NOT EXISTS nome_curto text,
  ADD COLUMN IF NOT EXISTS contato_portaria text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS nome_contato_2 text,
  ADD COLUMN IF NOT EXISTS telefone_contato_2 text,
  ADD COLUMN IF NOT EXISTS email_contato_2 text,
  ADD COLUMN IF NOT EXISTS data_inicio_contrato date;
