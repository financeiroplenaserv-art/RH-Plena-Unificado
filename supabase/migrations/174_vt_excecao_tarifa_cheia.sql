-- 174 - VT: excecao por pessoa "pagar tarifa cheia" (decisao da gestora, 19/11/2026).
--
-- Politica da empresa: o VT e calculado SEMPRE com a integracao (BUN/BUI)
-- disponivel, qualquer que seja a situacao do Bilhete Unico na Riocard; quem
-- nao esta "Ativado" recebe so o aviso de regularizar o cartao. A empresa pode,
-- por prerrogativa propria, abrir excecao para uma pessoa: pagar a tarifa
-- integral de cada conducao, sem integracao. A excecao exige motivo e guarda
-- quem marcou e quando.
--
-- Sem tabela nova (so colunas em colaboradores) - sem GRANT.
-- Escrita pela policy de UPDATE existente de colaboradores (is_editor()).
-- Idempotente. Arquivo em ASCII puro (sem risco de chr(65533)).

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_tarifa_cheia boolean NOT NULL DEFAULT false;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_tarifa_cheia_motivo text;

-- Mesmo padrao de vt_cargas.confirmada_por (migration 168): uuid do usuario
-- (auth.users.id), sem FK, para nao travar exclusao de usuario.
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_tarifa_cheia_por uuid;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS vt_tarifa_cheia_em timestamptz;

ALTER TABLE public.colaboradores
  DROP CONSTRAINT IF EXISTS colaboradores_vt_tarifa_cheia_motivo_ck;

ALTER TABLE public.colaboradores
  ADD CONSTRAINT colaboradores_vt_tarifa_cheia_motivo_ck
  CHECK (
    vt_tarifa_cheia = false
    OR (vt_tarifa_cheia_motivo IS NOT NULL AND btrim(vt_tarifa_cheia_motivo) <> '')
  );

COMMENT ON COLUMN public.colaboradores.vt_tarifa_cheia IS
  'VT: excecao da empresa - true = paga a tarifa integral de cada conducao, sem integracao (politica padrao: integracao presumida).';
COMMENT ON COLUMN public.colaboradores.vt_tarifa_cheia_motivo IS
  'VT: motivo obrigatorio da excecao tarifa cheia.';
COMMENT ON COLUMN public.colaboradores.vt_tarifa_cheia_por IS
  'VT: usuario (auth.users.id) que marcou ou desmarcou a excecao tarifa cheia.';
COMMENT ON COLUMN public.colaboradores.vt_tarifa_cheia_em IS
  'VT: quando a excecao tarifa cheia foi marcada ou desmarcada.';

-- Verificacao final.
DO $$
DECLARE
  v_colunas integer;
  v_check integer;
  v_corrompidas integer;
BEGIN
  SELECT count(*) INTO v_colunas
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'colaboradores'
    AND column_name IN ('vt_tarifa_cheia', 'vt_tarifa_cheia_motivo', 'vt_tarifa_cheia_por', 'vt_tarifa_cheia_em');
  IF v_colunas <> 4 THEN
    RAISE EXCEPTION '174: esperava 4 colunas novas em colaboradores, achou %', v_colunas;
  END IF;

  SELECT count(*) INTO v_check
  FROM pg_constraint
  WHERE conname = 'colaboradores_vt_tarifa_cheia_motivo_ck'
    AND conrelid = 'public.colaboradores'::regclass;
  IF v_check <> 1 THEN
    RAISE EXCEPTION '174: CHECK do motivo ausente';
  END IF;

  SELECT count(*) INTO v_corrompidas
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname LIKE 'vt\_%'
    AND p.prokind IN ('f', 'p')
    AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%';
  IF v_corrompidas > 0 THEN
    RAISE EXCEPTION '174: % funcao(oes) vt_* com chr(65533)', v_corrompidas;
  END IF;
END $$;
