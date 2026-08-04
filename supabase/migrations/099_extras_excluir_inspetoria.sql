-- Migration 099: inspetoria pode excluir extra lançado errado.
--
-- Contexto (04/08/2026): a gestão concedeu extras.excluir à inspetoria na
-- tela Permissões (linha dinâmica em permissoes_perfil já gravada como
-- permitido=true), mas a policy de DELETE em extras só aceitava is_admin()
-- ou mesa (migration 082). Sem esta migration, o inspetor via a lixeira na
-- tela mas o DELETE era barrado pelo RLS (o hook checa linhas afetadas e
-- mostrava "Sem permissão para excluir este extra").
-- Caso de uso: o inspetor lança um extra que não acontece e precisa excluir.
--
-- O PERMISSOES_PADRAO (src/lib/permissoes.ts) foi espelhado:
-- extras.excluir passa a ser ['mesa', 'inspetoria'].

DROP POLICY IF EXISTS "Permitir delete de extras" ON public.extras;
CREATE POLICY "Permitir delete de extras"
  ON public.extras
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid() AND nivel_acesso IN ('mesa', 'inspetoria')
    )
  );
