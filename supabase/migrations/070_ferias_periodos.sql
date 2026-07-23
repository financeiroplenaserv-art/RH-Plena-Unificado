-- Migração 070: Módulo Férias (versão temporária) — períodos de gozo/agendados vindos do Flit
--
-- Cria a tabela ferias_periodos para armazenar os períodos de férias importados
-- da planilha do Flit (controle de ponto). Cada linha é um período de gozo
-- realizado ou um período agendado de um colaborador.
--
-- Estratégia de reimportação: o frontend apaga os períodos com origem='flit'
-- dos colaboradores presentes no arquivo e insere os novos (idempotente).
-- Períodos com origem='manual' (uso futuro) nunca são tocados pela importação.
--
-- O módulo completo (saldos por período aquisitivo, alocação de feristas,
-- workflow de aprovação) está documentado em docs/agentes/arquitetura_modulo_ferias.md
-- e será implementado em fase futura; esta tabela é compatível com aquela visão.

-- ============================================================
-- 1. Tabela de períodos de férias
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_periodos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('gozo', 'agendado', 'previsto')),
  descricao TEXT,
  origem TEXT NOT NULL DEFAULT 'flit' CHECK (origem IN ('flit', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ferias_periodos_datas CHECK (data_fim >= data_inicio)
);

COMMENT ON TABLE public.ferias_periodos IS 'Períodos de férias (gozo realizado ou agendado) importados do Flit ou lançados manualmente.';
COMMENT ON COLUMN public.ferias_periodos.tipo IS 'gozo = férias já gozadas; agendado = programado no Alterdata/Flit (confirmado); previsto = planejamento do RH (ainda não confirmado).';
COMMENT ON COLUMN public.ferias_periodos.origem IS 'flit = importado da planilha do Flit; manual = lançado na tela (previsão do RH).';

-- ============================================================
-- 2. Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ferias_periodos_colaborador
  ON public.ferias_periodos(colaborador_id);

CREATE INDEX IF NOT EXISTS idx_ferias_periodos_data_inicio
  ON public.ferias_periodos(data_inicio);

-- Um colaborador não pode ter o mesmo período duplicado
CREATE UNIQUE INDEX IF NOT EXISTS idx_ferias_periodos_unico
  ON public.ferias_periodos(colaborador_id, tipo, data_inicio, data_fim);

-- ============================================================
-- 3. RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.ferias_periodos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ferias_periodos;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ferias_periodos;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ferias_periodos;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ferias_periodos;

CREATE POLICY "Permitir select para autenticados" ON public.ferias_periodos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.ferias_periodos
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.ferias_periodos
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.ferias_periodos
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 4. Auditoria automática
-- ============================================================

DROP TRIGGER IF EXISTS trg_auditoria_ferias_periodos ON public.ferias_periodos;
CREATE TRIGGER trg_auditoria_ferias_periodos
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_periodos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();
