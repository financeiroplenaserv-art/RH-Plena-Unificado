-- Migração 026: Cria tabela de recibos de extras com assinatura digital

CREATE TABLE IF NOT EXISTS public.recibos_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  colaborador_nome text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  valor_total numeric(10, 2) NOT NULL DEFAULT 0,
  quantidade_extras integer NOT NULL DEFAULT 0,
  assinatura_colaborador text, -- imagem PNG em base64
  extras_ids uuid[] NOT NULL DEFAULT '{}',
  marcar_pago boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'emitido',
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recibos_extras IS 'Recibos de pagamento de extras com assinatura digital do colaborador';

CREATE INDEX IF NOT EXISTS idx_recibos_extras_colaborador_id ON public.recibos_extras(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_recibos_extras_data_inicio ON public.recibos_extras(data_inicio);
CREATE INDEX IF NOT EXISTS idx_recibos_extras_data_fim ON public.recibos_extras(data_fim);

ALTER TABLE public.recibos_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de recibos_extras"
  ON public.recibos_extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir gerenciamento de recibos_extras"
  ON public.recibos_extras
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
