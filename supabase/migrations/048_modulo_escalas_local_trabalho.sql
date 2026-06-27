-- Migração 048: Módulo Escalas / Local de Trabalho Diário
--
-- Cria as tabelas necessárias para registrar, dia a dia, em qual Local de Trabalho
-- cada colaborador esteve alocado, com base nos dados importados do Flit.

-- ============================================================
-- 1. Tabela de Locais de Trabalho
-- ============================================================

CREATE TABLE IF NOT EXISTS public.locais_trabalho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  nome_curto TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.locais_trabalho IS 'Cadastro dos locais de trabalho da Plena (postos/clientes) para o módulo Escalas.';

-- ============================================================
-- 2. Tabela de Mapeamento Flit ↔ Local de Trabalho
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mapeamento_flit_local_trabalho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_trabalho_id UUID NOT NULL REFERENCES public.locais_trabalho(id) ON DELETE CASCADE,
  tipo_match TEXT NOT NULL CHECK (tipo_match IN ('dispositivo', 'perimetro', 'turno_departamento')),
  valor_flit TEXT NOT NULL,
  prioridade INT NOT NULL DEFAULT 100,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mapeamento_flit_local_trabalho IS 'Mapeia nomes/valores do Flit para os Locais de Trabalho do CORH.';

-- ============================================================
-- 3. Tabela de Local de Trabalho Diário
-- ============================================================

CREATE TABLE IF NOT EXISTS public.locais_trabalho_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  local_trabalho_id UUID REFERENCES public.locais_trabalho(id) ON DELETE SET NULL,
  fonte TEXT NOT NULL CHECK (fonte IN ('dispositivo', 'perimetro', 'turno_departamento', 'manual', 'nao_identificado')),
  usuario_confirmacao_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmado_em TIMESTAMPTZ,
  observacao TEXT,
  importacao_ref UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, data)
);

COMMENT ON TABLE public.locais_trabalho_diario IS 'Registro dia a dia do Local de Trabalho de cada colaborador, com rastreabilidade da fonte.';

-- ============================================================
-- 4. Tabela de Histórico de Alterações
-- ============================================================

CREATE TABLE IF NOT EXISTS public.historico_local_trabalho_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_trabalho_diario_id UUID NOT NULL REFERENCES public.locais_trabalho_diario(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL,
  local_trabalho_id UUID,
  data DATE NOT NULL,
  fonte TEXT,
  acao TEXT NOT NULL CHECK (acao IN ('criacao', 'edicao', 'confirmacao')),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.historico_local_trabalho_diario IS 'Histórico de alterações manuais no Local de Trabalho Diário para auditoria.';

-- ============================================================
-- 5. Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_locais_trabalho_diario_colaborador_data
  ON public.locais_trabalho_diario(colaborador_id, data);

CREATE INDEX IF NOT EXISTS idx_locais_trabalho_diario_data_local
  ON public.locais_trabalho_diario(data, local_trabalho_id);

CREATE INDEX IF NOT EXISTS idx_mapeamento_flit_tipo_valor
  ON public.mapeamento_flit_local_trabalho(tipo_match, valor_flit);

CREATE INDEX IF NOT EXISTS idx_historico_local_trabalho_diario_dia
  ON public.historico_local_trabalho_diario(local_trabalho_diario_id, created_at);

-- ============================================================
-- 6. RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.locais_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapeamento_flit_local_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locais_trabalho_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_local_trabalho_diario ENABLE ROW LEVEL SECURITY;

-- locais_trabalho
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.locais_trabalho;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.locais_trabalho;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.locais_trabalho;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.locais_trabalho;

CREATE POLICY "Permitir select para autenticados" ON public.locais_trabalho
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.locais_trabalho
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.locais_trabalho
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.locais_trabalho
  FOR DELETE TO authenticated USING (public.is_admin());

-- mapeamento_flit_local_trabalho
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.mapeamento_flit_local_trabalho;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.mapeamento_flit_local_trabalho;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.mapeamento_flit_local_trabalho;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.mapeamento_flit_local_trabalho;

CREATE POLICY "Permitir select para autenticados" ON public.mapeamento_flit_local_trabalho
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.mapeamento_flit_local_trabalho
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.mapeamento_flit_local_trabalho
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.mapeamento_flit_local_trabalho
  FOR DELETE TO authenticated USING (public.is_admin());

-- locais_trabalho_diario
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.locais_trabalho_diario;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.locais_trabalho_diario;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.locais_trabalho_diario;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.locais_trabalho_diario;

CREATE POLICY "Permitir select para autenticados" ON public.locais_trabalho_diario
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.locais_trabalho_diario
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.locais_trabalho_diario
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.locais_trabalho_diario
  FOR DELETE TO authenticated USING (public.is_admin());

-- historico_local_trabalho_diario
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.historico_local_trabalho_diario;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.historico_local_trabalho_diario;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.historico_local_trabalho_diario;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.historico_local_trabalho_diario;

CREATE POLICY "Permitir select para autenticados" ON public.historico_local_trabalho_diario
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.historico_local_trabalho_diario
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.historico_local_trabalho_diario
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.historico_local_trabalho_diario
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 7. Trigger para atualizar updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.atualizar_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_locais_trabalho_updated_at ON public.locais_trabalho;
CREATE TRIGGER trg_locais_trabalho_updated_at
  BEFORE UPDATE ON public.locais_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS trg_mapeamento_flit_updated_at ON public.mapeamento_flit_local_trabalho;
CREATE TRIGGER trg_mapeamento_flit_updated_at
  BEFORE UPDATE ON public.mapeamento_flit_local_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

DROP TRIGGER IF EXISTS trg_locais_trabalho_diario_updated_at ON public.locais_trabalho_diario;
CREATE TRIGGER trg_locais_trabalho_diario_updated_at
  BEFORE UPDATE ON public.locais_trabalho_diario
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at();

-- ============================================================
-- 8. Permissões do módulo Escalas
-- ============================================================

INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES

-- Menu e rotas
('adm', 'menu', 'escalas', true),
('admin', 'menu', 'escalas', true),
('gestor', 'menu', 'escalas', true),
('rh', 'menu', 'escalas', true),
('dp1', 'menu', 'escalas', true),
('dp2', 'menu', 'escalas', true),
('mesa', 'menu', 'escalas', true),
('inspetoria', 'menu', 'escalas', true),
('financeiro', 'menu', 'escalas', true),
('visualizador', 'menu', 'escalas', true),

('adm', 'rota', 'escalas', true),
('admin', 'rota', 'escalas', true),
('gestor', 'rota', 'escalas', true),
('rh', 'rota', 'escalas', true),
('dp1', 'rota', 'escalas', true),
('dp2', 'rota', 'escalas', true),
('mesa', 'rota', 'escalas', true),
('inspetoria', 'rota', 'escalas', true),
('financeiro', 'rota', 'escalas', true),
('visualizador', 'rota', 'escalas', true),

-- Ações do módulo
('adm', 'escala', 'visualizar', true),
('admin', 'escala', 'visualizar', true),
('gestor', 'escala', 'visualizar', true),
('rh', 'escala', 'visualizar', true),
('dp1', 'escala', 'visualizar', true),
('dp2', 'escala', 'visualizar', true),
('mesa', 'escala', 'visualizar', true),
('inspetoria', 'escala', 'visualizar', true),
('financeiro', 'escala', 'visualizar', true),
('visualizador', 'escala', 'visualizar', true),

('adm', 'escala', 'editar_local', true),
('admin', 'escala', 'editar_local', true),
('gestor', 'escala', 'editar_local', true),
('rh', 'escala', 'editar_local', true),
('dp1', 'escala', 'editar_local', true),
('dp2', 'escala', 'editar_local', true),

('adm', 'escala', 'mapear_flit', true),
('admin', 'escala', 'mapear_flit', true),
('gestor', 'escala', 'mapear_flit', true),
('rh', 'escala', 'mapear_flit', true),
('dp1', 'escala', 'mapear_flit', true),
('dp2', 'escala', 'mapear_flit', true),

('adm', 'escala', 'importar', true),
('admin', 'escala', 'importar', true),
('gestor', 'escala', 'importar', true),
('rh', 'escala', 'importar', true),
('dp1', 'escala', 'importar', true),
('dp2', 'escala', 'importar', true),

('adm', 'escala', 'confirmar_manual', true),
('admin', 'escala', 'confirmar_manual', true),
('gestor', 'escala', 'confirmar_manual', true),
('rh', 'escala', 'confirmar_manual', true),
('dp1', 'escala', 'confirmar_manual', true),
('dp2', 'escala', 'confirmar_manual', true),
('mesa', 'escala', 'confirmar_manual', true),

('adm', 'escala', 'editar_dia', true),
('admin', 'escala', 'editar_dia', true),
('gestor', 'escala', 'editar_dia', true),
('rh', 'escala', 'editar_dia', true),
('dp1', 'escala', 'editar_dia', true),
('dp2', 'escala', 'editar_dia', true),
('mesa', 'escala', 'editar_dia', true)

ON CONFLICT (perfil, recurso, acao) DO UPDATE
SET permitido = EXCLUDED.permitido,
    updated_at = now();
