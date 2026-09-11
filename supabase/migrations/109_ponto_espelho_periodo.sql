-- ============================================================================
-- Migration 109: Metadados de período do espelho de ponto
--
-- Contexto (decisão da gestão, 11/09/2026): o espelho do Flit tem o período
-- completo no cabeçalho (ex.: 01/09 a 20/09), mas as linhas de dias só vêm
-- até a data em que o PDF foi gerado (ex.: dia 15). A importação grava só os
-- dias parseados, e o Calendário preenche o restante pela previsão da escala
-- — sem nenhum aviso de que aqueles dias não são ponto importado.
--
-- Esta migration adiciona à `ponto_espelho_arquivos`:
--   - periodo_inicio / periodo_fim: período do cabeçalho do espelho;
--   - ponto_ate: último dia com linha no PDF (dados reais do ponto).
-- O app grava esses metadados logo após o parse (UPDATE best-effort), e o
-- Calendário usa o arquivo mais recente do período para exibir o aviso
-- "Ponto importado até dd/mm — dias posteriores são previsão da escala".
--
-- Segurança: a gravação dos metadados é UPDATE, que não tinha policy —
-- criada para is_editor(), mesmo escopo do SELECT/INSERT da migration 094.
-- ============================================================================

ALTER TABLE public.ponto_espelho_arquivos
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date,
  ADD COLUMN IF NOT EXISTS ponto_ate date;

DROP POLICY IF EXISTS "Editores podem atualizar metadados de espelhos de ponto" ON public.ponto_espelho_arquivos;
CREATE POLICY "Editores podem atualizar metadados de espelhos de ponto"
ON public.ponto_espelho_arquivos FOR UPDATE
TO authenticated
USING (public.is_editor())
WITH CHECK (public.is_editor());
