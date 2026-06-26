-- Migração 030: Criptografia do token e-Contador no banco
--
-- Contexto: o token JWT do e-Contador estava armazenado em texto plano na tabela
-- configuracoes. Esta migration prepara a tabela para armazenar o token cifrado.
-- A criptografia/descriptografia propriamente dita é feita na Edge Function
-- /functions/v1/econtador, que é a única que possui a chave ENCRYPTION_KEY.

-- ============================================================
-- Colunas para armazenamento cifrado do token
-- ============================================================

ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS valor_cifrado text,
ADD COLUMN IF NOT EXISTS iv text,
ADD COLUMN IF NOT EXISTS tag text;

COMMENT ON COLUMN public.configuracoes.valor_cifrado IS 'Token e-Contador criptografado (ciphertext em base64)';
COMMENT ON COLUMN public.configuracoes.iv IS 'Vetor de inicialização usado na criptografia AES-GCM (base64)';
COMMENT ON COLUMN public.configuracoes.tag IS 'Tag de autenticação AES-GCM (base64)';

-- ============================================================
-- Atualiza RLS para reforçar que o token nunca seja lido pelo frontend
-- ============================================================

-- Remove policies antigas da tabela configuracoes para evitar conflito
DROP POLICY IF EXISTS "Permitir select de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select geral de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir select de econtador_token para admin/rh" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir insert de configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Permitir update de configuracoes" ON public.configuracoes;

-- SELECT: autenticados leem tudo, EXCETO o token do e-Contador
CREATE POLICY "Permitir select geral de configuracoes"
  ON public.configuracoes
  FOR SELECT
  TO authenticated
  USING (chave <> 'econtador_token');

-- INSERT/UPDATE: editores podem inserir/atualizar, mas o frontend NUNCA deve
-- ler o token de volta. A Edge Function gerencia o token de forma segura.
CREATE POLICY "Permitir insert de configuracoes"
  ON public.configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_editor());

CREATE POLICY "Permitir update de configuracoes"
  ON public.configuracoes
  FOR UPDATE
  TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

-- DELETE: apenas admin
DROP POLICY IF EXISTS "Permitir delete de configuracoes" ON public.configuracoes;
CREATE POLICY "Permitir delete de configuracoes"
  ON public.configuracoes
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
