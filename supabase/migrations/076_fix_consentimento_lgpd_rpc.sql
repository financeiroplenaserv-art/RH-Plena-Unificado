-- Migração 076: Corrige RPC registrar_consentimento_lgpd (jsonb -> text[])
--
-- Problema: a coluna perfis.consentimento_lgpd_finalidades é TEXT[] (migration
-- 036), mas o parâmetro p_finalidades da RPC é jsonb (migration 068). PostgreSQL
-- não converte jsonb para text[] automaticamente, então o UPDATE falhava com
-- erro de tipo e o usuário ficava preso na tela de consentimento ao clicar em
-- "Aceito e quero continuar".
--
-- O bug não apareceu antes porque todos os consentimentos existentes foram
-- gravados em 25-26/06/2026, antes da migration 068 (que criou a RPC).
--
-- Solução: recria a RPC convertendo o jsonb para text[] com
-- jsonb_array_elements_text. O restante da função é idêntico à migration 068.

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
  v_finalidades text[];
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

  -- Converte jsonb -> text[] (a coluna em perfis é TEXT[]).
  -- Se vier algo que não seja array jsonb, grava array vazio.
  SELECT coalesce(array_agg(v), '{}'::text[])
  INTO v_finalidades
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p_finalidades) = 'array' THEN p_finalidades ELSE '[]'::jsonb END
  ) AS v;

  -- Libera o gate do trigger de proteção para esta transação
  PERFORM set_config('app.consentimento_rpc', 'on', true);

  UPDATE public.perfis
  SET consentimento_lgpd = true,
      consentimento_lgpd_data = now(),
      consentimento_lgpd_versao = p_versao,
      consentimento_lgpd_finalidades = v_finalidades
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
