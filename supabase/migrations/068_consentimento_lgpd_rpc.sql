-- Migração 068: Consentimento LGPD com valor probatório
--
-- Problema: o consentimento era gravado por self-UPDATE do próprio usuário em
-- perfis. Nada impedia setar consentimento_lgpd=true via API sem ler o termo,
-- com versão/finalidades arbitrárias — o registro não tinha valor probatório.
--
-- Solução:
--   1. Tabela consentimentos_lgpd (append-only): prova imutável com timestamp
--      do servidor. Insert apenas via RPC; SELECT apenas admin.
--   2. RPC registrar_consentimento_lgpd: valida a versão do termo ativo no
--      servidor, grava em perfis e registra a prova — tudo em uma transação.
--   3. Trigger de proteção: consentimento_lgpd só pode virar true via RPC.

-- ============================================================
-- 1. Tabela de prova (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consentimentos_lgpd (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  versao text NOT NULL,
  finalidades jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.consentimentos_lgpd IS 'Prova imutável de consentimentos LGPD (quem, quando, qual versão do termo)';

ALTER TABLE public.consentimentos_lgpd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consentimentos select admin" ON public.consentimentos_lgpd;
CREATE POLICY "Consentimentos select admin"
  ON public.consentimentos_lgpd
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Nenhuma policy de INSERT/UPDATE/DELETE para authenticated:
-- a gravação acontece apenas dentro da RPC (SECURITY DEFINER).

-- ============================================================
-- 2. RPC de registro de consentimento
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_consentimento_lgpd(
  p_versao text,
  p_finalidades jsonb DEFAULT '[]'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao_ativa text;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- A versão informada precisa ser a do termo ativo atual:
  -- impede consentir uma versão arbitrária/antiga via API.
  SELECT versao INTO v_versao_ativa
  FROM public.termos_lgpd
  WHERE ativo = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_versao_ativa IS NULL THEN
    RAISE EXCEPTION 'Nenhum termo LGPD ativo cadastrado';
  END IF;

  IF p_versao IS DISTINCT FROM v_versao_ativa THEN
    RAISE EXCEPTION 'Versão do termo não corresponde à versão ativa';
  END IF;

  -- Libera o gate do trigger de proteção para esta transação
  PERFORM set_config('app.consentimento_rpc', 'on', true);

  UPDATE public.perfis
  SET consentimento_lgpd = true,
      consentimento_lgpd_data = now(),
      consentimento_lgpd_versao = p_versao,
      consentimento_lgpd_finalidades = p_finalidades
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  INSERT INTO public.consentimentos_lgpd (usuario_id, versao, finalidades)
  VALUES (v_uid, p_versao, p_finalidades);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_consentimento_lgpd(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_consentimento_lgpd(text, jsonb) TO authenticated;

-- ============================================================
-- 3. Trigger de proteção contra bypass direto
-- ============================================================

CREATE OR REPLACE FUNCTION public.proteger_consentimento_lgpd()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.consentimento_lgpd IS DISTINCT FROM OLD.consentimento_lgpd
     AND NEW.consentimento_lgpd = true
     AND coalesce(current_setting('app.consentimento_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Consentimento deve ser registrado pelo fluxo próprio da aplicação';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perfis_proteger_consentimento ON public.perfis;
CREATE TRIGGER trg_perfis_proteger_consentimento
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_consentimento_lgpd();
