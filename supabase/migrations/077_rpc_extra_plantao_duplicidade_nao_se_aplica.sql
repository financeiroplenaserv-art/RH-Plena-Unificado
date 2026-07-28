-- 077_rpc_extra_plantao_duplicidade_nao_se_aplica.sql
-- Atualiza a RPC registrar_extra_plantao com a mesma regra aplicada ao
-- formulário web (ExtrasFormPage) em 28/07/2026:
--
--   "Gera extra para pagamento = Sim" + ausente "Não se aplica" (sem id/nome)
--   => PERMITE múltiplos lançamentos no mesmo cliente/data.
--
-- Caso de uso: um cliente pede 3-4 colaboradores para um serviço extra e
-- nenhum deles está substituindo ninguém. Antes, o 2º lançamento era
-- bloqueado como duplicidade porque já existia registro no mesmo dia/depto
-- com colaborador_ausente_id nulo.
--
-- Demais casos (com colaborador ausente, ou gera_extra = false / falta de
-- controle interno) mantêm a checagem de duplicidade normal.
--
-- APLICAR MANUALMENTE no SQL Editor do Supabase (projeto jmdjdogskvybsdjtmpmb).

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
  v_gera_extra boolean;
BEGIN
  -- Mesma regra do INSERT direto na tabela (migration 058)
  IF NOT (public.is_admin() OR public.is_editor()) THEN
    RAISE EXCEPTION 'Sem permissão para registrar extras';
  END IF;

  v_data := NULLIF(p_payload->>'data_ocorrencia', '')::date;
  v_dept := NULLIF(p_payload->>'departamento_id', '')::uuid;
  v_ausente_id := NULLIF(p_payload->>'colaborador_ausente_id', '')::uuid;
  v_ausente_nome := NULLIF(p_payload->>'colaborador_ausente_nome', '');
  v_gera_extra := COALESCE((p_payload->>'gera_extra')::boolean, true);

  IF v_data IS NULL OR v_dept IS NULL THEN
    RAISE EXCEPTION 'Data e departamento são obrigatórios';
  END IF;

  -- Checagem de duplicidade (mesma lógica de verificarDuplicado do frontend).
  -- Exceção (28/07/2026): gera_extra = true + ausente "não se aplica" permite
  -- vários lançamentos no mesmo cliente/data (equipe extra sem substituição).
  IF NOT (v_gera_extra AND v_ausente_id IS NULL AND v_ausente_nome IS NULL) THEN
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
  END IF;

  INSERT INTO public.extras (
    data_ocorrencia, turno, categoria, posto, departamento_id, departamento_nome,
    colaborador_ausente_id, colaborador_ausente_nome, substituto_id, substituto_nome,
    motivo, extra_faturado, gera_extra, reforco_contratual, valor, categoria_valor_id, categoria_valor_nome,
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
    COALESCE((p_payload->>'gera_extra')::boolean, true),
    COALESCE((p_payload->>'reforco_contratual')::boolean, false),
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
  'Registra extra pelo plantão mobile (/mobile/falta) com checagem de duplicidade, sem exigir SELECT em extras. Grava gera_extra e reforco_contratual (migration 074). Desde 077: gera_extra=true + ausente não se aplica permite duplicidade de cliente/data.';
