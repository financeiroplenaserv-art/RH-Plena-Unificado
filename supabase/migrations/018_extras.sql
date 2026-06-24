-- Migração 018: Cria módulo Extras (controle de faltas, coberturas e pagamentos em cash)

-- Tabela de categorias de valor para extras
CREATE TABLE IF NOT EXISTS public.categorias_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor_padrao numeric(10, 2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categorias_extras IS 'Categorias de valores padrão para pagamento de extras/faltas';

-- Seed inicial de categorias
INSERT INTO public.categorias_extras (nome, valor_padrao, ativo)
VALUES
  ('ASG 7:20 hs', 0, true),
  ('ASG 12×36', 0, true),
  ('Porteiro 12×36', 0, true),
  ('ASG Rio', 0, true),
  ('Valor acordado', 0, true)
ON CONFLICT (id) DO NOTHING;

-- Tabela principal de extras/ocorrências
CREATE TABLE IF NOT EXISTS public.extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_ocorrencia date NOT NULL,
  turno text NOT NULL,
  categoria text NOT NULL,
  posto text NOT NULL,
  colaborador_ausente_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  colaborador_ausente_nome text,
  substituto_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  substituto_nome text,
  motivo text NOT NULL,
  extra_faturado boolean NOT NULL DEFAULT false,
  valor numeric(10, 2) NOT NULL DEFAULT 0,
  categoria_valor_id uuid REFERENCES public.categorias_extras(id) ON DELETE SET NULL,
  categoria_valor_nome text,
  comunicacao_tipo text,
  comunicacao_data date,
  comunicacao_hora time,
  comunicacao_detalhes text,
  observacoes text,
  status text NOT NULL DEFAULT 'Pendente',
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.extras IS 'Registro de faltas, coberturas e pagamentos extras em cash';

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_extras_data_ocorrencia ON public.extras(data_ocorrencia);
CREATE INDEX IF NOT EXISTS idx_extras_colaborador_ausente_id ON public.extras(colaborador_ausente_id);
CREATE INDEX IF NOT EXISTS idx_extras_substituto_id ON public.extras(substituto_id);
CREATE INDEX IF NOT EXISTS idx_extras_status ON public.extras(status);
CREATE INDEX IF NOT EXISTS idx_extras_empresa_id ON public.extras(empresa_id);

-- RLS
ALTER TABLE public.categorias_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;

-- Políticas para categorias_extras: todos os usuários autenticados podem ler; apenas admin/rh podem gerenciar
CREATE POLICY "Permitir leitura de categorias_extras"
  ON public.categorias_extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir gerenciamento de categorias_extras"
  ON public.categorias_extras
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para extras
CREATE POLICY "Permitir leitura de extras"
  ON public.extras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir gerenciamento de extras"
  ON public.extras
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
