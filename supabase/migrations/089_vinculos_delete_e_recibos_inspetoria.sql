-- ============================================================================
-- Migration 089: Vínculos — mesa/dp1/dp2 com mesmos poderes do admin;
-- Inspetoria — gerar recibo de extras para assinatura e marcar como pago.
--
-- Decisões da gestão (30/07/2026):
-- 1. "mesa, dp1 e dp2 podem fazer em vínculos tudo que admin faz."
--    SELECT já cobria (pode_ver_adicionais, com dp1 desde a 087) e
--    INSERT/UPDATE já cobria (is_editor inclui os três); faltava o DELETE,
--    que era só is_admin() — falha silenciosa, pois a UI mostra a lixeira
--    para editar_vinculo. O mapa padrão editar_vinculo ganhou dp1 (o dinâmico
--    já concedia).
-- 2. "inspetoria pode gerar o recibo para o colaborador assinar e marcar
--    como pago." A função pode_gerenciar_recibos_extras() (INSERT/UPDATE de
--    recibos_extras e RPC assinar_recibo_extras) passa a incluir inspetoria;
--    o UPDATE de extras (marcar Pago) já estava liberado para inspetoria
--    desde a 087. As linhas dinâmicas da tela Permissões são viradas para
--    true (o dinâmico tem precedência sobre o mapa padrão).
-- ============================================================================

-- (1) DELETE de vínculos: mesa, dp1 e dp2 além do admin.
DROP POLICY IF EXISTS "Permitir delete de vinculos_adicionais" ON public.vinculos_adicionais;
CREATE POLICY "Permitir delete de vinculos_adicionais"
  ON public.vinculos_adicionais
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('mesa', 'dp1', 'dp2')
    )
  );

-- (2) Recibos de extras: inclui inspetoria.
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
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'financeiro', 'inspetoria')
  );
$$;

-- (2) Tela Permissões: vira as linhas dinâmicas da inspetoria (elas têm
-- precedência sobre o PERMISSOES_PADRAO, que também foi atualizado no código).
UPDATE public.permissoes_perfil
SET permitido = true, updated_at = now()
WHERE perfil = 'inspetoria'
  AND recurso = 'extras'
  AND acao IN ('gerenciar_recibo', 'marcar_pago');
