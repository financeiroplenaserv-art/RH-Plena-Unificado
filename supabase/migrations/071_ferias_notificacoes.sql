-- Migração 071: Módulo Férias — notificações e exclusão de previsões manuais
--
-- Complementa a migration 070 com:
-- 1. Tabela ferias_notificacoes: controle das notificações de férias enviadas
--    aos colaboradores e aos responsáveis pelos contratos (regra dos 30 dias
--    de antecedência do planejamento do RH).
-- 2. Policy de DELETE mais permissiva para períodos com origem='manual':
--    editores podem excluir previsões lançadas manualmente (correção de erro
--    ou baixa quando o período confirmado chega do Flit). Períodos vindos do
--    Flit continuam excluíveis apenas por admin.

-- ============================================================
-- 1. Tabela de notificações de férias
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  ferias_periodo_id UUID REFERENCES public.ferias_periodos(id) ON DELETE SET NULL,
  destinatario TEXT NOT NULL CHECK (destinatario IN ('colaborador', 'responsavel_contrato')),
  data_notificacao DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ferias_notificacoes IS 'Registro das notificações de férias enviadas ao colaborador e ao responsável pelo contrato.';
COMMENT ON COLUMN public.ferias_notificacoes.destinatario IS 'colaborador = aviso ao próprio ferista; responsavel_contrato = aviso ao responsável pelo contrato/posto.';

CREATE INDEX IF NOT EXISTS idx_ferias_notificacoes_colaborador
  ON public.ferias_notificacoes(colaborador_id);

CREATE INDEX IF NOT EXISTS idx_ferias_notificacoes_periodo
  ON public.ferias_notificacoes(ferias_periodo_id);

CREATE INDEX IF NOT EXISTS idx_ferias_notificacoes_data
  ON public.ferias_notificacoes(data_notificacao);

-- ============================================================
-- 2. RLS da tabela de notificações
-- ============================================================

ALTER TABLE public.ferias_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ferias_notificacoes;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ferias_notificacoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ferias_notificacoes;

CREATE POLICY "Permitir select para autenticados" ON public.ferias_notificacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.ferias_notificacoes
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.ferias_notificacoes
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 3. Auditoria automática
-- ============================================================

DROP TRIGGER IF EXISTS trg_auditoria_ferias_notificacoes ON public.ferias_notificacoes;
CREATE TRIGGER trg_auditoria_ferias_notificacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

-- ============================================================
-- 4. DELETE de previsões manuais por editores
-- ------------------------------------------------------------
-- Recria a policy de DELETE de ferias_periodos: admin continua podendo
-- excluir tudo; editores podem excluir apenas períodos com origem='manual'
-- (previsões do RH). Períodos importados do Flit seguem restritos a admin.
-- ============================================================

DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ferias_periodos;
DROP POLICY IF EXISTS "Permitir delete para admins e previsoes manuais" ON public.ferias_periodos;

CREATE POLICY "Permitir delete para admins e previsoes manuais" ON public.ferias_periodos
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (origem = 'manual' AND public.is_editor()));
