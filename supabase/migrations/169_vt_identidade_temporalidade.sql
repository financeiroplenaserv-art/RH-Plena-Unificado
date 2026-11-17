-- 169_vt_identidade_temporalidade.sql
-- VT — Etapa 2 da reconstrução parcial (docs/VT_ARQUITETURA_ALVO.md e
-- docs/HANDOFF_14-11-2026_VT_RECONSTRUCAO.md): identidade estável do pacote,
-- versões de preço por vigência, decisões de trajeto versionadas e ajustes
-- manuais com motivo e vigência.
--
-- TESTADA EM TRANSAÇÃO DESFEITA em 15/11/2026; NÃO APLICADA EM PRODUÇÃO.
-- MIGRAÇÃO DE CORTE ÚNICO, não sincronização
-- incremental: executar somente na virada para o novo escritor, com as
-- escritas legadas congeladas. Não reaplicar para "atualizar" o backfill.
-- O corte conserva os IDs legados e a composição ATUAL passa a valer somente
-- na data da aplicação; created_at NÃO comprova a vigência dessa composição.
-- A resolução de preço no domínio usa SOMENTE a data do serviço.
-- Antes de aplicar: backup, teste em transação desfeita e autorização da
-- gestora. Aplicação somente por script de ARQUIVO UTF-8 na Management API.
--
-- GRANT explícito em todas as tabelas novas. RLS no padrão do módulo VT:
-- SELECT autenticado, INSERT/UPDATE is_editor(), DELETE is_admin().
-- Nenhum acesso anon. Auditoria nas sete tabelas, como na migration 168.

begin;

-- SHARE conflita com INSERT/UPDATE/DELETE no legado: mantém a fotografia do
-- corte parada durante toda a transação, sem impedir leituras.
LOCK TABLE public.vt_bilhetes, public.vt_trajetos IN SHARE MODE;

-- Uma data inicial por pacote é obrigatória para uma resolução determinística.
-- Se o legado tiver duplicidade, a migration para antes de criar o novo modelo;
-- não escolhe uma versão por ordem física nem por palpite.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.vt_bilhetes
     GROUP BY nome, vigente_desde
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'VT: há bilhetes com mesmo nome e vigente_desde; revise a ambiguidade antes da migration 169';
  END IF;
END $$;

-- ============================================================
-- A) Identidade do pacote, componentes, preços e requisitos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vt_pacotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  legado_nome text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vt_pacote_componentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_id uuid NOT NULL REFERENCES public.vt_pacotes(id),
  descricao text NOT NULL,
  ordem integer NOT NULL CHECK (ordem > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pacote_id, ordem)
);

CREATE TABLE IF NOT EXISTS public.vt_pacote_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_id uuid NOT NULL REFERENCES public.vt_pacotes(id),
  valor_diario_centavos integer NOT NULL CHECK (valor_diario_centavos >= 0),
  vigente_desde date NOT NULL,
  vigente_ate date,
  bilhete_legado_id uuid UNIQUE REFERENCES public.vt_bilhetes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pacote_id, vigente_desde),
  CONSTRAINT vt_pacote_precos_vigencia_ck
    CHECK (vigente_ate IS NULL OR vigente_ate >= vigente_desde)
);

CREATE INDEX IF NOT EXISTS vt_pacote_precos_data_idx
  ON public.vt_pacote_precos (pacote_id, vigente_desde DESC, vigente_ate);

CREATE TABLE IF NOT EXISTS public.vt_pacote_requisitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pacote_id uuid NOT NULL REFERENCES public.vt_pacotes(id),
  cartao text NOT NULL CHECK (cartao IN ('riocard_bui', 'riocard_bun', 'jae', 'comum', 'outro')),
  obrigatorio boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pacote_id, cartao)
);

COMMENT ON TABLE public.vt_pacotes IS
  'Identidade estável do pacote operacional Plena; o nome não liga versões de preço.';
COMMENT ON COLUMN public.vt_pacotes.ativo IS
  'Disponibilidade para novas decisões; nunca apaga nem desativa o preço histórico.';
COMMENT ON TABLE public.vt_pacote_precos IS
  'Versões de preço resolvidas pela data do serviço; bilhete_legado_id preserva a referência original.';

-- ============================================================
-- B) Decisões versionadas e ajustes manuais
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vt_trajeto_decisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trajeto_legado_id uuid REFERENCES public.vt_trajetos(id) ON DELETE SET NULL,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id),
  departamento_id uuid NOT NULL REFERENCES public.departamentos(id),
  revisao integer NOT NULL CHECK (revisao > 0),
  cotacao_id text,
  status text NOT NULL CHECK (status IN ('sugerida', 'confirmada', 'indeterminada')),
  confirmado_por uuid,
  confirmado_em timestamptz,
  vigente_desde date,
  vigente_ate date,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'legado')),
  referencias_legadas_nao_resolvidas uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trajeto_legado_id, revisao),
  UNIQUE (colaborador_id, departamento_id, revisao),
  CONSTRAINT vt_trajeto_decisoes_vigencia_ck
    CHECK (vigente_desde IS NULL OR vigente_ate IS NULL OR vigente_ate >= vigente_desde),
  CONSTRAINT vt_trajeto_decisoes_inicio_manual_ck
    CHECK (origem = 'legado' OR vigente_desde IS NOT NULL),
  CONSTRAINT vt_trajeto_decisoes_confirmacao_manual_ck
    CHECK (
      origem = 'legado' OR status <> 'confirmada' OR
      (confirmado_por IS NOT NULL AND confirmado_em IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS vt_trajeto_decisoes_data_idx
  ON public.vt_trajeto_decisoes (colaborador_id, departamento_id, vigente_desde DESC, revisao DESC);

CREATE TABLE IF NOT EXISTS public.vt_trajeto_decisao_componentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decisao_trajeto_id uuid NOT NULL REFERENCES public.vt_trajeto_decisoes(id),
  pacote_id uuid NOT NULL REFERENCES public.vt_pacotes(id),
  ordem integer NOT NULL CHECK (ordem > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decisao_trajeto_id, ordem),
  UNIQUE (decisao_trajeto_id, pacote_id)
);

CREATE TABLE IF NOT EXISTS public.vt_beneficio_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decisao_trajeto_id uuid NOT NULL REFERENCES public.vt_trajeto_decisoes(id),
  valor_diario_centavos integer NOT NULL CHECK (valor_diario_centavos <> 0),
  motivo text NOT NULL CHECK (btrim(motivo) <> ''),
  autor_id uuid,
  vigente_desde date,
  vigente_ate date,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'legado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vt_beneficio_ajustes_vigencia_ck
    CHECK (vigente_desde IS NULL OR vigente_ate IS NULL OR vigente_ate >= vigente_desde),
  CONSTRAINT vt_beneficio_ajustes_manual_ck
    CHECK (origem = 'legado' OR (autor_id IS NOT NULL AND vigente_desde IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS vt_beneficio_ajustes_legado_unico_idx
  ON public.vt_beneficio_ajustes (decisao_trajeto_id) WHERE origem = 'legado';
CREATE INDEX IF NOT EXISTS vt_beneficio_ajustes_data_idx
  ON public.vt_beneficio_ajustes (decisao_trajeto_id, vigente_desde, vigente_ate);

COMMENT ON TABLE public.vt_trajeto_decisoes IS
  'Decisão versionada por colaborador e posto; a revisão mais recente vigente não é substituída por reajuste.';
COMMENT ON COLUMN public.vt_trajeto_decisoes.referencias_legadas_nao_resolvidas IS
  'IDs que não encontraram pacote estável; ficam visíveis como pendência, nunca são descartados.';
COMMENT ON COLUMN public.vt_beneficio_ajustes.valor_diario_centavos IS
  'Parcela assinada somada aos pacotes na data do serviço; motivo e vigência são obrigatórios no ajuste manual.';

-- Corte único: tabelas preexistentes com dados podem esconder conteúdo
-- divergente atrás de ON CONFLICT DO NOTHING. Melhor abortar do que misturar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vt_pacotes)
    OR EXISTS (SELECT 1 FROM public.vt_pacote_componentes)
    OR EXISTS (SELECT 1 FROM public.vt_pacote_precos)
    OR EXISTS (SELECT 1 FROM public.vt_pacote_requisitos)
    OR EXISTS (SELECT 1 FROM public.vt_trajeto_decisoes)
    OR EXISTS (SELECT 1 FROM public.vt_trajeto_decisao_componentes)
    OR EXISTS (SELECT 1 FROM public.vt_beneficio_ajustes) THEN
    RAISE EXCEPTION 'VT 169: o corte exige as sete tabelas novas vazias; não reaplicar como sincronização';
  END IF;
END $$;

-- ============================================================
-- C) RLS, GRANTs e auditoria
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vt_pacotes',
    'vt_pacote_componentes',
    'vt_pacote_precos',
    'vt_pacote_requisitos',
    'vt_trajeto_decisoes',
    'vt_trajeto_decisao_componentes',
    'vt_beneficio_ajustes'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_auditoria_' || t, t);
  END LOOP;
END $$;

ALTER TABLE public.vt_pacotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_pacotes_select ON public.vt_pacotes FOR SELECT TO authenticated USING (true);
CREATE POLICY vt_pacotes_insert ON public.vt_pacotes FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_pacotes_update ON public.vt_pacotes FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_pacotes_delete ON public.vt_pacotes FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_pacotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_pacotes TO service_role;
CREATE TRIGGER trg_auditoria_vt_pacotes AFTER INSERT OR UPDATE OR DELETE ON public.vt_pacotes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

ALTER TABLE public.vt_pacote_componentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_pacote_componentes_select ON public.vt_pacote_componentes FOR SELECT TO authenticated USING (true);
CREATE POLICY vt_pacote_componentes_insert ON public.vt_pacote_componentes FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_pacote_componentes_update ON public.vt_pacote_componentes FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_pacote_componentes_delete ON public.vt_pacote_componentes FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_pacote_componentes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_pacote_componentes TO service_role;
CREATE TRIGGER trg_auditoria_vt_pacote_componentes AFTER INSERT OR UPDATE OR DELETE ON public.vt_pacote_componentes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

ALTER TABLE public.vt_pacote_precos ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_pacote_precos_select ON public.vt_pacote_precos FOR SELECT TO authenticated USING (true);
CREATE POLICY vt_pacote_precos_insert ON public.vt_pacote_precos FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_pacote_precos_update ON public.vt_pacote_precos FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_pacote_precos_delete ON public.vt_pacote_precos FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_pacote_precos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_pacote_precos TO service_role;
CREATE TRIGGER trg_auditoria_vt_pacote_precos AFTER INSERT OR UPDATE OR DELETE ON public.vt_pacote_precos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

ALTER TABLE public.vt_pacote_requisitos ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_pacote_requisitos_select ON public.vt_pacote_requisitos FOR SELECT TO authenticated USING (true);
CREATE POLICY vt_pacote_requisitos_insert ON public.vt_pacote_requisitos FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_pacote_requisitos_update ON public.vt_pacote_requisitos FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_pacote_requisitos_delete ON public.vt_pacote_requisitos FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_pacote_requisitos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_pacote_requisitos TO service_role;
CREATE TRIGGER trg_auditoria_vt_pacote_requisitos AFTER INSERT OR UPDATE OR DELETE ON public.vt_pacote_requisitos
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

ALTER TABLE public.vt_trajeto_decisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_trajeto_decisoes_select ON public.vt_trajeto_decisoes FOR SELECT TO authenticated USING (true);
CREATE POLICY vt_trajeto_decisoes_insert ON public.vt_trajeto_decisoes FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_trajeto_decisoes_update ON public.vt_trajeto_decisoes FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_trajeto_decisoes_delete ON public.vt_trajeto_decisoes FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_trajeto_decisoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_trajeto_decisoes TO service_role;
CREATE TRIGGER trg_auditoria_vt_trajeto_decisoes AFTER INSERT OR UPDATE OR DELETE ON public.vt_trajeto_decisoes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

ALTER TABLE public.vt_trajeto_decisao_componentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_trajeto_decisao_componentes_select ON public.vt_trajeto_decisao_componentes FOR SELECT TO authenticated USING (true);
CREATE POLICY vt_trajeto_decisao_componentes_insert ON public.vt_trajeto_decisao_componentes FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_trajeto_decisao_componentes_update ON public.vt_trajeto_decisao_componentes FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_trajeto_decisao_componentes_delete ON public.vt_trajeto_decisao_componentes FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_trajeto_decisao_componentes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_trajeto_decisao_componentes TO service_role;
CREATE TRIGGER trg_auditoria_vt_trajeto_decisao_componentes AFTER INSERT OR UPDATE OR DELETE ON public.vt_trajeto_decisao_componentes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

ALTER TABLE public.vt_beneficio_ajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY vt_beneficio_ajustes_select ON public.vt_beneficio_ajustes FOR SELECT TO authenticated USING (true);
CREATE POLICY vt_beneficio_ajustes_insert ON public.vt_beneficio_ajustes FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_beneficio_ajustes_update ON public.vt_beneficio_ajustes FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY vt_beneficio_ajustes_delete ON public.vt_beneficio_ajustes FOR DELETE TO authenticated USING ((SELECT public.is_admin()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_beneficio_ajustes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_beneficio_ajustes TO service_role;
CREATE TRIGGER trg_auditoria_vt_beneficio_ajustes AFTER INSERT OR UPDATE OR DELETE ON public.vt_beneficio_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

-- O default do Supabase neste projeto concede todos os privilégios a anon em
-- tabelas novas. A regra do módulo é NADA para anon: revogar explicitamente.
REVOKE ALL ON public.vt_pacotes FROM anon;
REVOKE ALL ON public.vt_pacote_componentes FROM anon;
REVOKE ALL ON public.vt_pacote_precos FROM anon;
REVOKE ALL ON public.vt_pacote_requisitos FROM anon;
REVOKE ALL ON public.vt_trajeto_decisoes FROM anon;
REVOKE ALL ON public.vt_trajeto_decisao_componentes FROM anon;
REVOKE ALL ON public.vt_beneficio_ajustes FROM anon;

-- ============================================================
-- D) Backfill aditivo dos pacotes e preços legados
-- ============================================================
INSERT INTO public.vt_pacotes (nome, ativo, legado_nome)
SELECT b.nome,
       bool_or(b.ativo),
       b.nome
  FROM public.vt_bilhetes b
 GROUP BY b.nome
ON CONFLICT (legado_nome) DO NOTHING;

INSERT INTO public.vt_pacote_componentes (pacote_id, descricao, ordem)
SELECT p.id, p.nome, 1
  FROM public.vt_pacotes p
 WHERE p.legado_nome IS NOT NULL
ON CONFLICT DO NOTHING;

WITH versoes AS (
  SELECT b.id,
         b.nome,
         b.valor_diario_centavos,
         b.vigente_desde,
         lead(b.vigente_desde) OVER (
           PARTITION BY b.nome ORDER BY b.vigente_desde, b.created_at, b.id
         ) AS proxima_vigencia
    FROM public.vt_bilhetes b
)
INSERT INTO public.vt_pacote_precos (
  pacote_id,
  valor_diario_centavos,
  vigente_desde,
  vigente_ate,
  bilhete_legado_id
)
SELECT p.id,
       v.valor_diario_centavos,
       v.vigente_desde,
       v.proxima_vigencia - 1,
       v.id
  FROM versoes v
  JOIN public.vt_pacotes p ON p.legado_nome = v.nome
ON CONFLICT DO NOTHING;

INSERT INTO public.vt_pacote_requisitos (pacote_id, cartao, obrigatorio)
SELECT DISTINCT p.id,
       CASE b.cartao_necessario
         WHEN 'bun' THEN 'riocard_bun'
         WHEN 'bui' THEN 'riocard_bui'
         WHEN 'jae' THEN 'jae'
         WHEN 'comum' THEN 'comum'
       END,
       true
  FROM public.vt_bilhetes b
  JOIN public.vt_pacotes p ON p.legado_nome = b.nome
 WHERE b.cartao_necessario IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- E) Backfill das decisões, componentes e ajustes legados
-- ============================================================
INSERT INTO public.vt_trajeto_decisoes (
  trajeto_legado_id,
  colaborador_id,
  departamento_id,
  revisao,
  status,
  confirmado_por,
  confirmado_em,
  vigente_desde,
  vigente_ate,
  origem,
  referencias_legadas_nao_resolvidas
)
SELECT t.id,
       t.colaborador_id,
       t.departamento_id,
       1,
       CASE WHEN t.status = 'confirmado' THEN 'confirmada' ELSE 'sugerida' END,
       t.confirmado_por,
       t.confirmado_em,
       (now() AT TIME ZONE 'America/Sao_Paulo')::date,
       NULL,
       'legado',
       ARRAY(
         SELECT referencia
           FROM unnest(ARRAY[t.bilhete_id, t.bilhete_2_id]) AS refs(referencia)
          WHERE referencia IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM public.vt_pacote_precos pp
               WHERE pp.bilhete_legado_id = referencia
            )
       )
  FROM public.vt_trajetos t
ON CONFLICT DO NOTHING;

WITH referencias AS (
  SELECT d.id AS decisao_id,
         refs.referencia AS bilhete_id,
         refs.ordem
    FROM public.vt_trajetos t
    JOIN public.vt_trajeto_decisoes d
      ON d.trajeto_legado_id = t.id AND d.revisao = 1
    CROSS JOIN LATERAL (
      VALUES (t.bilhete_id, 1), (t.bilhete_2_id, 2)
    ) AS refs(referencia, ordem)
   WHERE refs.referencia IS NOT NULL
)
INSERT INTO public.vt_trajeto_decisao_componentes (decisao_trajeto_id, pacote_id, ordem)
SELECT r.decisao_id, pp.pacote_id, r.ordem
  FROM referencias r
  JOIN public.vt_pacote_precos pp ON pp.bilhete_legado_id = r.bilhete_id
ON CONFLICT DO NOTHING;

INSERT INTO public.vt_beneficio_ajustes (
  decisao_trajeto_id,
  valor_diario_centavos,
  motivo,
  autor_id,
  vigente_desde,
  vigente_ate,
  origem
)
SELECT d.id,
       t.valor_extra_centavos,
       COALESCE(NULLIF(btrim(t.observacao), ''), 'Valor extra manual importado do trajeto legado'),
       t.confirmado_por,
       (now() AT TIME ZONE 'America/Sao_Paulo')::date,
       NULL,
       'legado'
  FROM public.vt_trajetos t
  JOIN public.vt_trajeto_decisoes d
    ON d.trajeto_legado_id = t.id AND d.revisao = 1
 WHERE COALESCE(t.valor_extra_centavos, 0) <> 0
ON CONFLICT DO NOTHING;

-- ============================================================
-- E2) Imutabilidade das decisões confirmadas (instalada após o backfill)
-- ============================================================
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
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Decisão confirmada é imutável; crie uma nova revisão (somente vigente_ate pode ser fechado)';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.vt_guardar_filhos_decisao_confirmada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
    SELECT 1 FROM public.vt_trajeto_decisoes d
     WHERE d.id = OLD.decisao_trajeto_id AND d.status = 'confirmada'
  ) THEN
    RAISE EXCEPTION 'Componentes e ajustes de uma decisão confirmada são imutáveis; crie uma nova revisão';
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND EXISTS (
    SELECT 1 FROM public.vt_trajeto_decisoes d
     WHERE d.id = NEW.decisao_trajeto_id AND d.status = 'confirmada'
  ) THEN
    RAISE EXCEPTION 'Componentes e ajustes de uma decisão confirmada são imutáveis; crie uma nova revisão';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vt_decisao_confirmada ON public.vt_trajeto_decisoes;
CREATE TRIGGER trg_vt_decisao_confirmada
  BEFORE UPDATE OR DELETE ON public.vt_trajeto_decisoes
  FOR EACH ROW EXECUTE FUNCTION public.vt_guardar_decisao_confirmada();

DROP TRIGGER IF EXISTS trg_vt_componentes_decisao_confirmada ON public.vt_trajeto_decisao_componentes;
CREATE TRIGGER trg_vt_componentes_decisao_confirmada
  BEFORE INSERT OR UPDATE OR DELETE ON public.vt_trajeto_decisao_componentes
  FOR EACH ROW EXECUTE FUNCTION public.vt_guardar_filhos_decisao_confirmada();

DROP TRIGGER IF EXISTS trg_vt_ajustes_decisao_confirmada ON public.vt_beneficio_ajustes;
CREATE TRIGGER trg_vt_ajustes_decisao_confirmada
  BEFORE INSERT OR UPDATE OR DELETE ON public.vt_beneficio_ajustes
  FOR EACH ROW EXECUTE FUNCTION public.vt_guardar_filhos_decisao_confirmada();

-- ============================================================
-- F) Verificação de referências e contagens — falha desfaz tudo
-- ============================================================
DO $$
DECLARE
  esperado integer;
  atual integer;
BEGIN
  SELECT count(DISTINCT nome) INTO esperado FROM public.vt_bilhetes;
  SELECT count(*) INTO atual FROM public.vt_pacotes WHERE legado_nome IS NOT NULL;
  IF atual <> esperado THEN
    RAISE EXCEPTION 'VT 169: pacotes legados %, esperado %', atual, esperado;
  END IF;

  SELECT count(*) INTO esperado FROM public.vt_bilhetes;
  SELECT count(*) INTO atual FROM public.vt_pacote_precos WHERE bilhete_legado_id IS NOT NULL;
  IF atual <> esperado THEN
    RAISE EXCEPTION 'VT 169: preços com referência legada %, esperado %', atual, esperado;
  END IF;

  SELECT count(*) INTO esperado FROM public.vt_trajetos;
  SELECT count(*) INTO atual FROM public.vt_trajeto_decisoes WHERE origem = 'legado';
  IF atual <> esperado THEN
    RAISE EXCEPTION 'VT 169: decisões legadas %, esperado %', atual, esperado;
  END IF;

  SELECT count(*) INTO esperado
    FROM public.vt_trajetos t
    CROSS JOIN LATERAL (
      VALUES (t.bilhete_id), (t.bilhete_2_id)
    ) AS refs(referencia)
   WHERE refs.referencia IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.vt_pacote_precos pp
        WHERE pp.bilhete_legado_id = refs.referencia
     );
  SELECT count(*) INTO atual
    FROM public.vt_trajeto_decisao_componentes dc
    JOIN public.vt_trajeto_decisoes d ON d.id = dc.decisao_trajeto_id
   WHERE d.origem = 'legado';
  IF atual <> esperado THEN
    RAISE EXCEPTION 'VT 169: componentes de decisões legadas %, esperado %', atual, esperado;
  END IF;

  SELECT count(*) INTO esperado FROM public.vt_trajetos WHERE COALESCE(valor_extra_centavos, 0) <> 0;
  SELECT count(*) INTO atual FROM public.vt_beneficio_ajustes WHERE origem = 'legado';
  IF atual <> esperado THEN
    RAISE EXCEPTION 'VT 169: ajustes legados %, esperado %', atual, esperado;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.vt_trajetos t
      JOIN public.vt_trajeto_decisoes d
        ON d.trajeto_legado_id = t.id AND d.revisao = 1
     WHERE (
       SELECT count(*)
         FROM unnest(ARRAY[t.bilhete_id, t.bilhete_2_id]) AS refs(referencia)
        WHERE refs.referencia IS NOT NULL
     ) <> (
       (SELECT count(*) FROM public.vt_trajeto_decisao_componentes dc
         WHERE dc.decisao_trajeto_id = d.id) +
       cardinality(d.referencias_legadas_nao_resolvidas)
     )
  ) THEN
    RAISE EXCEPTION 'VT 169: há referência de trajeto que não virou componente nem pendência explícita';
  END IF;
END $$;

commit;
