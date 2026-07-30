-- ============================================================================
-- Migration 093: consolidação de policies legadas + limpezas (bloco 3 da
-- varredura de segurança de 30/07/2026).
--
-- 1. departamentos: remove a policy legada write_admin_rh (ALL para admin/rh,
--    migration 014). INSERT/UPDATE de rh já são cobertos por is_editor() (037)
--    e SELECT por pode_ver_departamentos() (058); para DELETE, o perfil rh é
--    incorporado à policy "Permitir delete de departamentos" — comportamento
--    efetivo idêntico, uma única família de policies.
--    NOTA: a policy select_autenticado (using true) é MANTIDA de propósito:
--    removê-la tiraria o SELECT do visualizador (pode_ver_departamentos não
--    o inclui).
-- 2. permissoes_perfil: remove a linha dinâmica dp1/editar_vinculo — o mapa
--    padrão já concede desde a migration 089; a linha virou redundante.
-- 3. Comentário na RPC registrar_extra_plantao documentando a exceção de
--    duplicidade (gera_extra = true + ausente "Não se aplica" não checa
--    duplicidade — regra de negócio para equipe extra no mesmo serviço).
-- ============================================================================

DROP POLICY IF EXISTS "write_admin_rh" ON public.departamentos;

DROP POLICY IF EXISTS "Permitir delete de departamentos" ON public.departamentos;
CREATE POLICY "Permitir delete de departamentos"
  ON public.departamentos
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.perfis
      WHERE id = auth.uid()
        AND nivel_acesso IN ('gestor', 'financeiro', 'dp1', 'dp2', 'rh')
    )
  );

DELETE FROM public.permissoes_perfil
WHERE perfil = 'dp1' AND recurso = 'adicionais' AND acao = 'editar_vinculo';

COMMENT ON FUNCTION public.registrar_extra_plantao(jsonb) IS
  'Registra extras em lote (plantão). Exceção de duplicidade: lançamentos com gera_extra = true e ausente "Não se aplica" NÃO checam duplicidade de cliente/data — regra de negócio que permite equipe extra no mesmo serviço (migrations 075/077 e docs/REGRAS_NEGOCIO.md).';
