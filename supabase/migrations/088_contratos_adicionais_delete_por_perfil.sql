-- ============================================================================
-- Migration 088: DELETE de contratos_adicionais alinhado à tela.
--
-- Contexto: a UI mostra o botão de excluir contrato para quem tem
-- adicionais.editar_contrato (gestor, dp2, mesa, financeiro), mas a policy
-- DELETE era só is_admin() — DELETE bloqueado por RLS falha EM SILÊNCIO
-- (0 linhas, sem erro) e o usuário via o toast "Contrato removido" sem nada
-- ser apagado. Decisão da gestão (30/07/2026): gestor, dp2, mesa e financeiro
-- também podem excluir contratos.
--
-- vínculos_adicionais NÃO foi alterado (segue só admin) — decisão pendente;
-- o hook foi ajustado para não fingir sucesso quando o RLS bloqueia.
-- ============================================================================

DROP POLICY IF EXISTS "Permitir delete de contratos_adicionais" ON public.contratos_adicionais;
CREATE POLICY "Permitir delete de contratos_adicionais"
  ON public.contratos_adicionais
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('gestor', 'dp2', 'mesa', 'financeiro')
    )
  );
