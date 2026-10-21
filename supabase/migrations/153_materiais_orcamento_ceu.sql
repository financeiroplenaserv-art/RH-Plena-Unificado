-- 153_materiais_orcamento_ceu.sql
-- Decisão da gestora (21/10/2026): cada contrato tem DOIS orçamentos mensais fixos.
--   1. Material: mat_contratos.limite_mensal (migration 138; NULL = calculado pelo kit) — inalterado.
--   2. Uniforme, EPI e crachá: NOVA coluna mat_contratos.limite_mensal_ceu (NULL = sem limite definido).
-- Quem edita: a policy de UPDATE de mat_contratos já é pode_aprovar_materiais() (gestor/admin) — sem policy nova.
-- Custo do crachá (R$ 6,00 sem cordinha, R$ 8,00 com cordinha): duas chaves novas em
-- materiais_config (custo_cracha_sem_cordinha / custo_cracha_com_cordinha), gravadas por mat_salvar_config.
-- O app usa 6 e 8 como padrão quando as chaves não existem.
-- mat_salvar_config recriada a partir do pg_get_functiondef REAL de produção (21/10/2026;
-- backup em dados-locais/backup_materiais_153_2026-10-21/mat_salvar_config.json), só com as chaves novas.
-- Sem tabela nova — sem GRANT de tabela. Idempotente. Aplicar por ARQUIVO UTF-8
-- (scripts/lib/executar-arquivo-sql-management-api.ps1), nunca inline.

ALTER TABLE public.mat_contratos
  ADD COLUMN IF NOT EXISTS limite_mensal_ceu numeric(12,2);

ALTER TABLE public.mat_contratos DROP CONSTRAINT IF EXISTS mat_contratos_limite_ceu_ck;
ALTER TABLE public.mat_contratos
  ADD CONSTRAINT mat_contratos_limite_ceu_ck CHECK (limite_mensal_ceu IS NULL OR limite_mensal_ceu >= 0);

COMMENT ON COLUMN public.mat_contratos.limite_mensal_ceu IS
  'Limite mensal (R$) de uniforme, EPI e crachá do contrato, fixo todo mês (migration 153). NULL = sem limite. Só aviso no Painel do gestor; nunca bloqueia.';

CREATE OR REPLACE FUNCTION public.mat_salvar_config(p_config jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v text; atual jsonb := '{}'::jsonb; novo jsonb := '{}'::jsonb; k text;
BEGIN
  IF NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para alterar a configuração de materiais';
  END IF;
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Configuração inválida';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_config) LOOP
    IF k NOT IN ('kit_aprovacao_automatica', 'dia_aviso', 'dia_limite',
                 'dia_limite_validacao', 'dia_limite_aprovacao', 'dia_inicio_compra', 'dia_fim_compra',
                 'custo_cracha_sem_cordinha', 'custo_cracha_com_cordinha') THEN
      RAISE EXCEPTION 'Chave de configuração desconhecida: %', k;
    END IF;
  END LOOP;
  IF p_config ? 'kit_aprovacao_automatica' AND jsonb_typeof(p_config -> 'kit_aprovacao_automatica') <> 'boolean' THEN
    RAISE EXCEPTION 'kit_aprovacao_automatica deve ser verdadeiro ou falso';
  END IF;
  IF p_config ? 'dia_aviso' AND NOT (jsonb_typeof(p_config -> 'dia_aviso') = 'number'
       AND (p_config ->> 'dia_aviso')::numeric BETWEEN 1 AND 28) THEN
    RAISE EXCEPTION 'dia_aviso deve ser de 1 a 28';
  END IF;
  IF p_config ? 'dia_limite' AND NOT (jsonb_typeof(p_config -> 'dia_limite') = 'number'
       AND (p_config ->> 'dia_limite')::numeric BETWEEN 1 AND 28) THEN
    RAISE EXCEPTION 'dia_limite deve ser de 1 a 28';
  END IF;

  FOREACH k IN ARRAY ARRAY['dia_limite_validacao', 'dia_limite_aprovacao', 'dia_inicio_compra', 'dia_fim_compra'] LOOP
    IF p_config ? k AND NOT (jsonb_typeof(p_config -> k) = 'number'
         AND (p_config ->> k)::numeric BETWEEN 1 AND 28) THEN
      RAISE EXCEPTION '% deve ser de 1 a 28', k;
    END IF;
  END LOOP;

  -- Custo do crachá (migration 153): número >= 0 ou null (null = não definido, o crachá deixa de ser somado).
  FOREACH k IN ARRAY ARRAY['custo_cracha_sem_cordinha', 'custo_cracha_com_cordinha'] LOOP
    IF p_config ? k AND NOT (jsonb_typeof(p_config -> k) = 'null'
         OR (jsonb_typeof(p_config -> k) = 'number' AND (p_config ->> k)::numeric >= 0)) THEN
      RAISE EXCEPTION '% deve ser um valor em reais maior ou igual a zero', k;
    END IF;
  END LOOP;

  SELECT valor INTO v FROM public.configuracoes WHERE chave = 'materiais_config' FOR UPDATE;
  IF v IS NOT NULL THEN
    BEGIN
      atual := v::jsonb;
    EXCEPTION WHEN others THEN
      atual := '{}'::jsonb;
    END;
    IF jsonb_typeof(atual) <> 'object' THEN atual := '{}'::jsonb; END IF;
  END IF;
  novo := atual || p_config;

  UPDATE public.configuracoes SET valor = novo::text, updated_at = now() WHERE chave = 'materiais_config';
  IF NOT FOUND THEN
    INSERT INTO public.configuracoes (chave, valor, descricao)
    VALUES ('materiais_config', novo::text, 'Módulo Materiais: prazo, aviso e aprovação automática do kit (migration 135)');
  END IF;
  RETURN novo;
END $function$;

REVOKE ALL ON FUNCTION public.mat_salvar_config(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_salvar_config(jsonb) TO authenticated;

-- ============================================================
-- Conferência final (aborta se algo não bater)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname LIKE 'mat\_%' ESCAPE '\'
                AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%') THEN
    RAISE EXCEPTION '153: função mat_* com caractere corrompido (chr 65533) — aplique pelo script de ARQUIVO UTF-8';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'mat_contratos' AND column_name = 'limite_mensal_ceu') THEN
    RAISE EXCEPTION '153: coluna limite_mensal_ceu ausente';
  END IF;
END $$;
