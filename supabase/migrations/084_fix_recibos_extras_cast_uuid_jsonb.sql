-- ============================================================================
-- Migration 084: Corrigir cast inválido uuid[]→jsonb nas RPCs de recibos de
-- extras (assinar_recibo_extras e cancelar_recibo_extras).
--
-- Contexto: a coluna recibos_extras.extras_ids é uuid[] (migration 026), mas
-- as RPCs criadas na migration 067 (e recriadas na 081) faziam
-- `r.extras_ids::jsonb` — cast que não existe no PostgreSQL e falha com
-- "cannot cast type uuid[] to jsonb". O bug ficou oculto desde a 067 porque o
-- financeiro (principal operador dessa tela) era barrado antes, na checagem de
-- permissão; quando a migration 081 alinhou as permissões, o cast inválido
-- passou a estourar ao confirmar a assinatura. Correção: usar unnest() sobre o
-- array uuid[], sem cast. Nenhuma outra lógica foi alterada (permissões,
-- atualização do recibo e reversão dos extras permanecem iguais à 081).
-- ============================================================================

-- RPC de assinatura: mesma lógica da migration 081, extras_ids via unnest().
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
  IF NOT public.pode_gerenciar_recibos_extras() THEN
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
      SELECT e.extra_id
      FROM public.recibos_extras r,
           LATERAL unnest(r.extras_ids) AS e(extra_id)
      WHERE r.id = p_recibo_id
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.assinar_recibo_extras(uuid, text, boolean, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assinar_recibo_extras(uuid, text, boolean, timestamptz) TO authenticated;

-- RPC de cancelamento: mesma lógica da migration 081, extras_ids via unnest().
CREATE OR REPLACE FUNCTION public.cancelar_recibo_extras(p_recibo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso = 'financeiro'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar recibo';
  END IF;

  UPDATE public.extras
  SET status = 'Pendente'
  WHERE id IN (
    SELECT e.extra_id
    FROM public.recibos_extras r,
         LATERAL unnest(r.extras_ids) AS e(extra_id)
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
