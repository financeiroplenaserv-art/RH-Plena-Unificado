-- Migração 029: Auditoria automática via triggers
--
-- Cria tabela de log de auditoria (se não existir) e triggers nas tabelas críticas
-- para registrar INSERT, UPDATE e DELETE automaticamente.

-- ============================================================
-- Tabela de log de auditoria
-- ============================================================

CREATE TABLE IF NOT EXISTS public.log_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'CANCEL')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.log_auditoria IS 'Registro automático de alterações em dados sensíveis do sistema';

CREATE INDEX IF NOT EXISTS idx_log_auditoria_tabela ON public.log_auditoria(tabela);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_registro_id ON public.log_auditoria(registro_id);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_created_at ON public.log_auditoria(created_at);

-- ============================================================
-- Função genérica de auditoria
-- ============================================================

CREATE OR REPLACE FUNCTION public.auditar_operacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id::text, 'sem-id'), 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id::text, OLD.id::text, 'sem-id'), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, acao, dados_anteriores, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(OLD.id::text, 'sem-id'), 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================
-- Aplica triggers nas tabelas críticas
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auditoria_ocorrencias ON public.ocorrencias;
CREATE TRIGGER trigger_auditoria_ocorrencias
  AFTER INSERT OR UPDATE OR DELETE ON public.ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_colaboradores ON public.colaboradores;
CREATE TRIGGER trigger_auditoria_colaboradores
  AFTER INSERT OR UPDATE OR DELETE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_extras ON public.extras;
CREATE TRIGGER trigger_auditoria_extras
  AFTER INSERT OR UPDATE OR DELETE ON public.extras
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_recibos_extras ON public.recibos_extras;
CREATE TRIGGER trigger_auditoria_recibos_extras
  AFTER INSERT OR UPDATE OR DELETE ON public.recibos_extras
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_projetos_vr ON public.projetos_vr;
CREATE TRIGGER trigger_auditoria_projetos_vr
  AFTER INSERT OR UPDATE OR DELETE ON public.projetos_vr
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_resultados_vr ON public.resultados_vr;
CREATE TRIGGER trigger_auditoria_resultados_vr
  AFTER INSERT OR UPDATE OR DELETE ON public.resultados_vr
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

-- ============================================================
-- RLS na tabela de log (apenas leitura para autenticados; insert via trigger)
-- ============================================================

ALTER TABLE public.log_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de log_auditoria" ON public.log_auditoria;
CREATE POLICY "Permitir select de log_auditoria"
  ON public.log_auditoria
  FOR SELECT
  TO authenticated
  USING (true);
