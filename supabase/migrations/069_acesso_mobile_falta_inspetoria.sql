-- Migração 069: Acesso da inspetoria ao lançamento mobile de falta
--
-- Problema resolvido:
-- 1) A permissão ('inspetoria', 'rota', 'mobile_falta') só existia dentro da
--    função reset_permissoes_perfil (054). Quem nunca resetou o perfil ficava
--    sem acesso à rota /mobile/falta (redirecionava para o dashboard).
-- 2) A página mobile usava verificarDuplicado (SELECT em extras) e
--    insert().select().single(). A inspetoria NÃO tem SELECT em extras
--    (pode_ver_extras: adm, mesa, financeiro, dp1) — regra de negócio que
--    queremos manter. Resultado: o INSERT era gravado, mas o SELECT do
--    retorno falhava e o usuário via "Erro ao registrar extra", podendo
--    tentar de novo e duplicar o lançamento.
--
-- Solução:
-- 1) Concede a permissão de rota de forma versionada.
-- 2) RPC registrar_extra_plantao (SECURITY DEFINER): valida o perfil,
--    checa duplicidade e insere — sem exigir SELECT em extras.

-- 1) Permissão de rota para a inspetoria
INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido)
VALUES ('inspetoria', 'rota', 'mobile_falta', true)
ON CONFLICT (perfil, recurso, acao) DO UPDATE SET permitido = true;

-- 2) RPC transacional de registro de extra pelo plantão mobile
CREATE OR REPLACE FUNCTION public.registrar_extra_plantao(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_data date;
  v_dept uuid;
  v_ausente_id uuid;
  v_ausente_nome text;
BEGIN
  -- Mesma regra do INSERT direto na tabela (migration 058)
  IF NOT (public.is_admin() OR public.is_editor()) THEN
    RAISE EXCEPTION 'Sem permissão para registrar extras';
  END IF;

  v_data := NULLIF(p_payload->>'data_ocorrencia', '')::date;
  v_dept := NULLIF(p_payload->>'departamento_id', '')::uuid;
  v_ausente_id := NULLIF(p_payload->>'colaborador_ausente_id', '')::uuid;
  v_ausente_nome := NULLIF(p_payload->>'colaborador_ausente_nome', '');

  IF v_data IS NULL OR v_dept IS NULL THEN
    RAISE EXCEPTION 'Data e departamento são obrigatórios';
  END IF;

  -- Checagem de duplicidade (mesma lógica de verificarDuplicado do frontend)
  IF EXISTS (
    SELECT 1
    FROM public.extras e
    WHERE e.data_ocorrencia = v_data
      AND e.departamento_id = v_dept
      AND e.status <> 'Cancelado'
      AND (
        (v_ausente_id IS NOT NULL AND e.colaborador_ausente_id = v_ausente_id)
        OR (v_ausente_id IS NULL AND v_ausente_nome IS NOT NULL AND e.colaborador_ausente_nome = v_ausente_nome)
        OR (v_ausente_id IS NULL AND v_ausente_nome IS NULL AND e.colaborador_ausente_id IS NULL)
      )
  ) THEN
    RAISE EXCEPTION 'Já existe um extra lançado para este colaborador/departamento nesta data';
  END IF;

  INSERT INTO public.extras (
    data_ocorrencia, turno, categoria, posto, departamento_id, departamento_nome,
    colaborador_ausente_id, colaborador_ausente_nome, substituto_id, substituto_nome,
    motivo, extra_faturado, valor, categoria_valor_id, categoria_valor_nome,
    comunicacao_tipo, comunicacao_data, comunicacao_hora, comunicacao_detalhes,
    observacoes, status, usuario_id, empresa_id
  )
  VALUES (
    v_data,
    p_payload->>'turno',
    p_payload->>'categoria',
    p_payload->>'posto',
    v_dept,
    p_payload->>'departamento_nome',
    v_ausente_id,
    v_ausente_nome,
    NULLIF(p_payload->>'substituto_id', '')::uuid,
    p_payload->>'substituto_nome',
    p_payload->>'motivo',
    COALESCE((p_payload->>'extra_faturado')::boolean, false),
    COALESCE(NULLIF(p_payload->>'valor', '')::numeric, 0),
    NULLIF(p_payload->>'categoria_valor_id', '')::uuid,
    p_payload->>'categoria_valor_nome',
    p_payload->>'comunicacao_tipo',
    NULLIF(p_payload->>'comunicacao_data', '')::date,
    NULLIF(p_payload->>'comunicacao_hora', '')::time,
    p_payload->>'comunicacao_detalhes',
    p_payload->>'observacoes',
    COALESCE(p_payload->>'status', 'Pendente'),
    NULLIF(p_payload->>'usuario_id', '')::uuid,
    NULLIF(p_payload->>'empresa_id', '')::uuid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_extra_plantao(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_extra_plantao(jsonb) TO authenticated;

COMMENT ON FUNCTION public.registrar_extra_plantao(jsonb) IS
  'Registra extra pelo plantão mobile (/mobile/falta) com checagem de duplicidade, sem exigir SELECT em extras. Usado pela inspetoria/mesa.';
