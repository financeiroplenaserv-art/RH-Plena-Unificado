-- ============================================================================
-- Migration 081: Permitir que o perfil financeiro gerencie recibos de extras.
--
-- Contexto: quem assina o recibo é o colaborador que recebeu o extra, mas ele
-- assina com o dedo/mouse no dispositivo do operador logado (tela Extras →
-- Recibos). A sessão é do operador, então a RPC precisa aceitar os perfis que
-- a UI autoriza. O mapa de permissões (PERMISSOES_PADRAO, recurso "extras")
-- define:
--   - gerenciar_recibo: mesa, dp1, financeiro (+ admin/adm, acesso total)
--   - cancelar_recibo:  financeiro (+ admin/adm)
-- Porém o banco estava desalinhado:
--   - RPC assinar_recibo_extras exigia is_admin() OR is_editor() — e
--     is_editor() NÃO inclui financeiro → "Sem permissão para assinar recibo".
--   - RPC cancelar_recibo_extras exigia is_admin() → bloqueava o financeiro.
--   - Policies INSERT/UPDATE de recibos_extras (migration 059) idem.
-- ============================================================================

-- Função auxiliar: quem pode gerar/assinar recibos de extras.
CREATE OR REPLACE FUNCTION public.pode_gerenciar_recibos_extras()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'financeiro')
  );
$$;

GRANT EXECUTE ON FUNCTION public.pode_gerenciar_recibos_extras() TO authenticated;

-- Policies de recibos_extras alinhadas ao mapa de permissões da UI.
DROP POLICY IF EXISTS "Permitir insert de recibos_extras" ON public.recibos_extras;
CREATE POLICY "Permitir insert de recibos_extras"
  ON public.recibos_extras
  FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerenciar_recibos_extras());

DROP POLICY IF EXISTS "Permitir update de recibos_extras" ON public.recibos_extras;
CREATE POLICY "Permitir update de recibos_extras"
  ON public.recibos_extras
  FOR UPDATE TO authenticated
  USING (public.pode_gerenciar_recibos_extras())
  WITH CHECK (public.pode_gerenciar_recibos_extras());

-- RPC de assinatura: mesma lógica da migration 067, nova checagem de perfil.
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

-- RPC de cancelamento: admin/adm ou financeiro (espelha "cancelar_recibo" da UI).
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
