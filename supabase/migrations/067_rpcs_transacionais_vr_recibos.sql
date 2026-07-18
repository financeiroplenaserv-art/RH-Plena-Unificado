-- Migração 067: RPCs transacionais para resultados VR e recibos de extras
--
-- Resolve dois achados da auditoria (integridade):
--   • salvarLote de resultados_vr fazia delete-total + insert sem transação:
--     se o insert falhava, todos os resultados do projeto eram perdidos.
--   • Assinatura de recibo e marcação de "Pago" eram duas escritas separadas:
--     se a segunda falhava, o recibo dizia "pago" e os extras ficavam pendentes.
--     E a exclusão de recibo assinado não revertia os extras.
--
-- As funções rodam em transação única (plpgsql é atômico por definição) e
-- validam a mesma permissão exigida pelas policies de escrita atuais.

-- ============================================================
-- 1. Salvar resultados VR em lote (delete + insert atômicos)
-- ============================================================

CREATE OR REPLACE FUNCTION public.salvar_resultados_vr_lote(
  p_projeto_id uuid,
  p_itens jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_editor()) THEN
    RAISE EXCEPTION 'Sem permissão para salvar resultados VR';
  END IF;

  DELETE FROM public.resultados_vr WHERE projeto_id = p_projeto_id;

  INSERT INTO public.resultados_vr (
    projeto_id, colaborador_id, nome, cpf, matricula,
    dias_elegiveis, dias_pdf, dias_escala, dias_abatimento,
    valor_bruto, extra, detalhes_json
  )
  SELECT
    p_projeto_id,
    (item->>'colaborador_id')::uuid,
    item->>'nome',
    item->>'cpf',
    item->>'matricula',
    COALESCE((item->>'dias_elegiveis')::integer, 0),
    COALESCE((item->>'dias_pdf')::integer, 0),
    COALESCE((item->>'dias_escala')::integer, 0),
    COALESCE((item->>'dias_abatimento')::integer, 0),
    COALESCE((item->>'valor_bruto')::numeric, 0),
    COALESCE((item->>'extra')::numeric, 0),
    COALESCE(item->'detalhes_json', '{}'::jsonb)
  FROM jsonb_array_elements(p_itens) AS item;

  GET DIAGNOSTICS v_count := ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_resultados_vr_lote(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_resultados_vr_lote(uuid, jsonb) TO authenticated;

-- ============================================================
-- 2. Assinar recibo e marcar extras como Pago (atômico)
-- ============================================================

CREATE OR REPLACE FUNCTION public.assinar_recibo_extras(
  p_recibo_id uuid,
  p_assinatura_base64 text,
  p_marcar_pago boolean DEFAULT true,
  p_data_assinatura timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_editor()) THEN
    RAISE EXCEPTION 'Sem permissão para assinar recibo';
  END IF;

  UPDATE public.recibos_extras
  SET assinatura_colaborador = p_assinatura_base64,
      status = 'assinado',
      data_assinatura = p_data_assinatura,
      marcar_pago = p_marcar_pago,
      updated_at = now()
  WHERE id = p_recibo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo não encontrado';
  END IF;

  IF p_marcar_pago THEN
    UPDATE public.extras
    SET status = 'Pago'
    WHERE id IN (
      SELECT (e.value #>> '{}')::uuid
      FROM public.recibos_extras r,
           LATERAL jsonb_array_elements(r.extras_ids::jsonb) AS e(value)
      WHERE r.id = p_recibo_id
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.assinar_recibo_extras(uuid, text, boolean, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assinar_recibo_extras(uuid, text, boolean, timestamptz) TO authenticated;

-- ============================================================
-- 3. Cancelar recibo e reverter extras para Pendente (atômico)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancelar_recibo_extras(p_recibo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem cancelar recibos';
  END IF;

  UPDATE public.extras
  SET status = 'Pendente'
  WHERE id IN (
    SELECT (e.value #>> '{}')::uuid
    FROM public.recibos_extras r,
         LATERAL jsonb_array_elements(r.extras_ids::jsonb) AS e(value)
    WHERE r.id = p_recibo_id
  );

  UPDATE public.recibos_extras
  SET status = 'cancelado',
      updated_at = now()
  WHERE id = p_recibo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo não encontrado';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_recibo_extras(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_recibo_extras(uuid) TO authenticated;
