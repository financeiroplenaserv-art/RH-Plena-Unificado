-- 171_vt_itinerarios_evidencia.sql
-- Persistência aditiva da evidência da alternativa escolhida na revisão
-- assistida. Não altera trajetos, cargas nem decisões existentes.
-- Depende da migration 169. Preparada, NÃO aplicada em produção.
-- Antes de aplicar: backup, teste em transação desfeita e autorização da gestora.

begin;

CREATE TABLE IF NOT EXISTS public.vt_itinerarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id),
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id),
  provedor text NOT NULL CHECK (provedor IN ('google_routes', 'manual', 'importado', 'outro')),
  alternativa_id text NOT NULL,
  itinerario jsonb NOT NULL,
  distancia_metros integer CHECK (distancia_metros IS NULL OR distancia_metros >= 0),
  duracao_segundos integer CHECK (duracao_segundos IS NULL OR duracao_segundos >= 0),
  consultado_em timestamptz NOT NULL,
  evidencia_hash text NOT NULL,
  chave_idempotencia text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.perfis(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vt_itinerarios_objeto_ck CHECK (jsonb_typeof(itinerario) = 'object'),
  CONSTRAINT vt_itinerarios_pernas_ck CHECK (
    jsonb_typeof(itinerario->'pernas') = 'array' AND jsonb_array_length(itinerario->'pernas') > 0
  )
);

COMMENT ON TABLE public.vt_itinerarios IS
  'Evidência completa da alternativa escolhida: conduções, operadoras, paradas, horários, fonte e hash. Append-only para usuários.';
COMMENT ON COLUMN public.vt_itinerarios.chave_idempotencia IS
  'Chave única calculada pela aplicação para evitar duplicar a mesma evidência em reenvios.';
COMMENT ON COLUMN public.vt_itinerarios.itinerario IS
  'Objeto com pernas, provedor, consultadoEm, precisao e evidenciaHash; contém endereços necessários ao VT.';

ALTER TABLE public.vt_trajeto_decisoes
  ADD COLUMN IF NOT EXISTS itinerario_id uuid REFERENCES public.vt_itinerarios(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS vt_itinerarios_par_data_idx
  ON public.vt_itinerarios (colaborador_id, departamento_id, consultado_em DESC);
CREATE INDEX IF NOT EXISTS vt_trajeto_decisoes_itinerario_idx
  ON public.vt_trajeto_decisoes (itinerario_id);

CREATE OR REPLACE FUNCTION public.vt_guardar_decisao_confirmada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'confirmada' THEN
      RAISE EXCEPTION 'Decisão confirmada não pode ser excluída; crie uma nova revisão';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'confirmada' AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.trajeto_legado_id IS DISTINCT FROM OLD.trajeto_legado_id OR
    NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id OR
    NEW.departamento_id IS DISTINCT FROM OLD.departamento_id OR
    NEW.revisao IS DISTINCT FROM OLD.revisao OR
    NEW.cotacao_id IS DISTINCT FROM OLD.cotacao_id OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.confirmado_por IS DISTINCT FROM OLD.confirmado_por OR
    NEW.confirmado_em IS DISTINCT FROM OLD.confirmado_em OR
    NEW.vigente_desde IS DISTINCT FROM OLD.vigente_desde OR
    NEW.origem IS DISTINCT FROM OLD.origem OR
    NEW.referencias_legadas_nao_resolvidas IS DISTINCT FROM OLD.referencias_legadas_nao_resolvidas OR
    NEW.itinerario_id IS DISTINCT FROM OLD.itinerario_id OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Decisão confirmada é imutável; crie uma nova revisão (somente vigente_ate pode ser fechado)';
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE public.vt_itinerarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vt_itinerarios_select ON public.vt_itinerarios;
DROP POLICY IF EXISTS vt_itinerarios_insert ON public.vt_itinerarios;
DROP POLICY IF EXISTS vt_itinerarios_delete ON public.vt_itinerarios;

CREATE POLICY vt_itinerarios_select ON public.vt_itinerarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY vt_itinerarios_insert ON public.vt_itinerarios
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_itinerarios_delete ON public.vt_itinerarios
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

GRANT SELECT, INSERT, DELETE ON public.vt_itinerarios TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.vt_itinerarios TO service_role;
REVOKE UPDATE ON public.vt_itinerarios FROM authenticated;
REVOKE ALL ON public.vt_itinerarios FROM anon;

DROP TRIGGER IF EXISTS trg_auditoria_vt_itinerarios ON public.vt_itinerarios;
CREATE TRIGGER trg_auditoria_vt_itinerarios
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_itinerarios
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

commit;
