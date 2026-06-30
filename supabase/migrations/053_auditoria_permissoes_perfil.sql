-- Migração 053: Auditoria das alterações em permissoes_perfil
--
-- Adiciona trigger na tabela public.permissoes_perfil para registrar apenas
-- mudanças reais no campo permitido. Diferente do trigger genérico, este ignora
-- atualizações que não alterem o valor booleano (evitando spam quando o frontend
-- faz upsert de todas as permissões do perfil).

-- ============================================================
-- 1. Garante que a tabela de log de auditoria existe com a coluna 'operacao'
-- ============================================================

CREATE TABLE IF NOT EXISTS public.log_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id text NOT NULL,
  operacao text NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE', 'CANCEL')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Em alguns bancos a coluna pode ter sido criada como 'acao' (migration 029 original).
-- Aqui garantimos que o nome seja 'operacao', alinhado com os tipos do frontend.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'log_auditoria'
      AND column_name = 'acao'
  ) THEN
    ALTER TABLE public.log_auditoria RENAME COLUMN acao TO operacao;
  END IF;
END $$;

COMMENT ON TABLE public.log_auditoria IS 'Registro automático de alterações em dados sensíveis do sistema';

CREATE INDEX IF NOT EXISTS idx_log_auditoria_tabela ON public.log_auditoria(tabela);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_registro_id ON public.log_auditoria(registro_id);
CREATE INDEX IF NOT EXISTS idx_log_auditoria_created_at ON public.log_auditoria(created_at);

-- ============================================================
-- 2. Atualiza a função genérica de auditoria para usar 'operacao'
-- ============================================================

CREATE OR REPLACE FUNCTION public.auditar_operacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id::text, 'sem-id'), 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id::text, OLD.id::text, 'sem-id'), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, operacao, dados_anteriores, usuario_id)
    VALUES (TG_TABLE_NAME, COALESCE(OLD.id::text, 'sem-id'), 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================
-- 3. Função de auditoria específica para permissoes_perfil
-- ============================================================

CREATE OR REPLACE FUNCTION public.auditar_permissoes_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, operacao, dados_novos, usuario_id)
    VALUES (
      'permissoes_perfil',
      COALESCE(NEW.id::text, 'sem-id'),
      'INSERT',
      to_jsonb(NEW),
      auth.uid()
    );
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Só registra se o valor de permitido realmente mudou
    IF NEW.permitido IS DISTINCT FROM OLD.permitido THEN
      INSERT INTO public.log_auditoria (
        tabela,
        registro_id,
        operacao,
        dados_anteriores,
        dados_novos,
        usuario_id
      )
      VALUES (
        'permissoes_perfil',
        COALESCE(NEW.id::text, OLD.id::text, 'sem-id'),
        'UPDATE',
        to_jsonb(OLD),
        to_jsonb(NEW),
        auth.uid()
      );
    END IF;
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.log_auditoria (tabela, registro_id, operacao, dados_anteriores, usuario_id)
    VALUES (
      'permissoes_perfil',
      COALESCE(OLD.id::text, 'sem-id'),
      'DELETE',
      to_jsonb(OLD),
      auth.uid()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================
-- 4. Aplica o trigger
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auditoria_permissoes_perfil ON public.permissoes_perfil;

CREATE TRIGGER trigger_auditoria_permissoes_perfil
  AFTER INSERT OR UPDATE OR DELETE ON public.permissoes_perfil
  FOR EACH ROW EXECUTE FUNCTION public.auditar_permissoes_perfil();

-- ============================================================
-- 5. Garante RLS e policy de leitura na tabela de log
-- ============================================================

ALTER TABLE public.log_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir select de log_auditoria" ON public.log_auditoria;
CREATE POLICY "Permitir select de log_auditoria"
  ON public.log_auditoria
  FOR SELECT
  TO authenticated
  USING (true);
