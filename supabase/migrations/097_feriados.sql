-- ============================================================================
-- Migration 097: cadastro de feriados para o adicional de feriado
--
-- Contexto: o flag `adicionais.feriado` existia no contrato sem efeito —
-- não havia onde registrar as datas nem cálculo. Decisão da gestão
-- (31/07/2026): o adicional conta APENAS para vínculos cujo contrato tem o
-- flag E cuja escala prevê trabalho no feriado (quem trabalha no feriado sem
-- estar escalado — substituto, cobertura — não recebe). Esta tabela é a
-- fonte das datas; a aba Adicionais → Feriados faz a manutenção e o
-- Relatório de Adicionais ganha a coluna "Feriado".
-- Seed: feriados nacionais de 2026. Municipais/datas de contrato (ex.:
-- 24/06 do Enseada) são incluídos pela tela.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados podem ler feriados" ON public.feriados;
CREATE POLICY "Autenticados podem ler feriados"
ON public.feriados FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Editores podem inserir feriados" ON public.feriados;
CREATE POLICY "Editores podem inserir feriados"
ON public.feriados FOR INSERT
TO authenticated
WITH CHECK (public.is_editor());

DROP POLICY IF EXISTS "Editores podem atualizar feriados" ON public.feriados;
CREATE POLICY "Editores podem atualizar feriados"
ON public.feriados FOR UPDATE
TO authenticated
USING (public.is_editor())
WITH CHECK (public.is_editor());

DROP POLICY IF EXISTS "Apenas admins podem excluir feriados" ON public.feriados;
CREATE POLICY "Apenas admins podem excluir feriados"
ON public.feriados FOR DELETE
TO authenticated
USING (public.is_admin());

-- Feriados nacionais de 2026
INSERT INTO public.feriados (data, nome) VALUES
  ('2026-01-01', 'Confraternização Universal'),
  ('2026-04-03', 'Sexta-feira Santa'),
  ('2026-04-21', 'Tiradentes'),
  ('2026-05-01', 'Dia do Trabalho'),
  ('2026-06-04', 'Corpus Christi'),
  ('2026-09-07', 'Independência do Brasil'),
  ('2026-10-12', 'Nossa Senhora Aparecida'),
  ('2026-11-02', 'Finados'),
  ('2026-11-15', 'Proclamação da República'),
  ('2026-12-25', 'Natal')
ON CONFLICT (data) DO NOTHING;
