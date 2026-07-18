-- Migração 064: Correções críticas de segurança (auditoria pré-go-live)
--
-- Achados da auditoria que esta migration resolve:
--
-- 1. CRÍTICO — Escalonamento de privilégio via tabela perfis.
--    As policies "Perfis insert proprio" e "Perfis update proprio" (migration 042)
--    nunca foram removidas, e a policy de UPDATE da migration 059 permite
--    self-update sem restrição de colunas. Qualquer usuário autenticado podia
--    executar: update perfis set nivel_acesso='admin' where id = auth.uid().
--    Correção: remove as policies órfãs, limita o self-INSERT ao nível
--    'visualizador' (mantém o fluxo de primeiro acesso) e cria trigger que
--    impede não-admin de alterar nivel_acesso/empresa_id.
--
-- 2. CRÍTICO — calendario_adicionais com CRUD aberto a qualquer autenticado.
--    Policies da migration 003 (USING true) nunca foram substituídas.
--    Correção: policies no mesmo padrão de contratos/vínculos (058).
--
-- 3. ALTO — Mudanças em perfis não eram auditadas.
--    Correção: trigger de auditoria (auditar_operacao) também em perfis.
--
-- 4. Seed das permissões do módulo CEU (bloco novo na tela Permissões),
--    refletindo os perfis que já operam o módulo hoje.

-- ============================================================
-- 1. perfis: remove policies órfãs e restringe self-INSERT
-- ============================================================

DROP POLICY IF EXISTS "Perfis insert proprio" ON public.perfis;
DROP POLICY IF EXISTS "Perfis update proprio" ON public.perfis;
DROP POLICY IF EXISTS "Perfis insert proprio visualizador" ON public.perfis;

-- Usuário novo pode criar o próprio perfil apenas como 'visualizador'
-- (necessário para o fluxo de primeiro acesso em useAuth). A elevação de
-- nível passa a exigir um admin (policy "Permitir insert de perfis" da 059
-- continua valendo para admins).
CREATE POLICY "Perfis insert proprio visualizador"
  ON public.perfis
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND nivel_acesso = 'visualizador');

-- Trigger: impede não-admin de alterar nivel_acesso ou empresa_id,
-- inclusive no próprio registro. O consentimento LGPD (self-update) não é
-- afetado, pois só dispara quando essas colunas mudam.
CREATE OR REPLACE FUNCTION public.proteger_campos_sensiveis_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.nivel_acesso IS DISTINCT FROM OLD.nivel_acesso
      OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão para alterar nivel_acesso ou empresa_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perfis_proteger_sensiveis ON public.perfis;
CREATE TRIGGER trg_perfis_proteger_sensiveis
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_campos_sensiveis_perfil();

-- ============================================================
-- 2. perfis: auditoria de INSERT/UPDATE/DELETE
-- ============================================================

DROP TRIGGER IF EXISTS trg_auditoria_perfis ON public.perfis;
CREATE TRIGGER trg_auditoria_perfis
  AFTER INSERT OR UPDATE OR DELETE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.auditar_operacao();

-- ============================================================
-- 3. calendario_adicionais e departamentos: policies restritas
-- ============================================================
-- A migration 037 criou "Permitir select para autenticados" (USING true) em
-- 22 tabelas via loop; 058/059 limparam a maioria, mas estas duas sobraram.
-- Como policies permissivas se combinam com OR, a policy restrita da 063/064
-- NAO tem efeito enquanto a aberta existir. Por isso o DROP e obrigatorio.

DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.departamentos;
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem ler calendário" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir calendário" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar calendário" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar calendário" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Permitir select de calendario_adicionais" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Permitir insert de calendario_adicionais" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Permitir update de calendario_adicionais" ON public.calendario_adicionais;
DROP POLICY IF EXISTS "Permitir delete de calendario_adicionais" ON public.calendario_adicionais;

CREATE POLICY "Permitir select de calendario_adicionais"
  ON public.calendario_adicionais
  FOR SELECT TO authenticated
  USING (public.pode_ver_adicionais());

CREATE POLICY "Permitir insert de calendario_adicionais"
  ON public.calendario_adicionais
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir update de calendario_adicionais"
  ON public.calendario_adicionais
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_editor())
  WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Permitir delete de calendario_adicionais"
  ON public.calendario_adicionais
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 4. Seed: permissões do módulo CEU (reflete os fallbacks do app)
-- ============================================================

INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
  -- Registrar entrega / devolução / recibo / relatórios: perfis operacionais
  ('gestor', 'ceu', 'registrar_entrega', true),
  ('dp1', 'ceu', 'registrar_entrega', true),
  ('dp2', 'ceu', 'registrar_entrega', true),
  ('mesa', 'ceu', 'registrar_entrega', true),
  ('inspetoria', 'ceu', 'registrar_entrega', true),
  ('gestor', 'ceu', 'devolver', true),
  ('dp1', 'ceu', 'devolver', true),
  ('dp2', 'ceu', 'devolver', true),
  ('mesa', 'ceu', 'devolver', true),
  ('inspetoria', 'ceu', 'devolver', true),
  ('gestor', 'ceu', 'emitir_recibo', true),
  ('dp1', 'ceu', 'emitir_recibo', true),
  ('dp2', 'ceu', 'emitir_recibo', true),
  ('mesa', 'ceu', 'emitir_recibo', true),
  ('inspetoria', 'ceu', 'emitir_recibo', true),
  ('gestor', 'ceu', 'ver_relatorios', true),
  ('dp1', 'ceu', 'ver_relatorios', true),
  ('dp2', 'ceu', 'ver_relatorios', true),
  ('mesa', 'ceu', 'ver_relatorios', true),
  ('inspetoria', 'ceu', 'ver_relatorios', true),
  -- Ações restritas: excluir entrega, itens, fornecedores, importar
  ('gestor', 'ceu', 'excluir_entrega', true),
  ('dp1', 'ceu', 'excluir_entrega', true),
  ('dp2', 'ceu', 'excluir_entrega', true),
  ('gestor', 'ceu', 'editar_itens', true),
  ('dp1', 'ceu', 'editar_itens', true),
  ('dp2', 'ceu', 'editar_itens', true),
  ('gestor', 'ceu', 'excluir_itens', true),
  ('dp1', 'ceu', 'excluir_itens', true),
  ('dp2', 'ceu', 'excluir_itens', true),
  ('gestor', 'ceu', 'gerenciar_fornecedores', true),
  ('dp1', 'ceu', 'gerenciar_fornecedores', true),
  ('dp2', 'ceu', 'gerenciar_fornecedores', true),
  ('gestor', 'ceu', 'importar', true),
  ('dp1', 'ceu', 'importar', true),
  ('dp2', 'ceu', 'importar', true)
ON CONFLICT (perfil, recurso, acao) DO UPDATE
SET permitido = EXCLUDED.permitido,
    updated_at = now();
