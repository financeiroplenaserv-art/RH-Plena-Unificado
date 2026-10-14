-- Migração 130: CEU — entrega com recibo emitido é imutável (trigger + RPC de
-- correção auditada) e limpeza das policies legadas de entregas/itens
--
-- Origem: incidente de 13/07/2026 — a importação do histórico do sistema antigo
-- ligou 1.918 entregas ao item errado (relatório da revisão independente em
-- dados-locais/investigacao_revisao_independente_2026-10-14/relatorio_revisao.md).
-- Regra permanente (14/10/2026): entrega com recibo emitido é imutável e não
-- pode ser apagada; correção só com motivo e auditoria. Até aqui NADA no banco
-- impedia alterar/apagar essas entregas — o único trigger era o de auditoria
-- AFTER (migration 066), que registra mas não bloqueia.
--
-- 1) Trigger BEFORE UPDATE OR DELETE em public.entregas: quando
--    OLD.recibo_emitido = true, bloqueia DELETE e bloqueia UPDATE que mexa em
--    item_id, snapshot_item, quantidade, colaborador_id ou data_entrega.
--    numero_recibo, recibo_emitido, data_devolucao, situacao e observacao
--    seguem livres (fluxos normais de emissão/devolução). Vale para TODOS os
--    roles, inclusive service_role — scripts com service key passam por cima
--    de RLS, mas não de trigger. Única exceção: a variável de sessão
--    corh.correcao_autorizada = 'on', ligada com set_config(..., true) só pela
--    RPC abaixo (escopo da transação).
--
-- 2) Tabela public.entregas_correcoes_log — auditoria das correções (antes/
--    depois, motivo, autor). SELECT só is_admin(); sem policy de escrita (só a
--    RPC SECURITY DEFINER escreve). GRANT explícito (regra pós-30/10/2026).
--
-- 3) RPC corrigir_item_entrega (SECURITY DEFINER, guarda is_admin() OU role
--    service_role — a trigger obriga até os scripts com chave de serviço a
--    passar por este caminho auditado): troca o item de uma entrega
--    recalculando o snapshot a partir do cadastro do item novo (mesma
--    estrutura que o app grava — CeuEntregaFormPage/CeuImportarPage: nome,
--    codigo, tipo, ca, valor, prazo_uso_dias) OU usando p_snapshot_item quando
--    fornecido (correção do incidente precisa gravar o CA histórico da data da
--    entrega, não o CA atual do cadastro — e pode apontar para item inativo,
--    caso dos itens 645/673/677 que saíram de linha). Grava o log e devolve o
--    antes/depois.
--
-- 4) Limpeza parcial do drift: remove as policies legadas REDUNDANTES fora
--    das migrations — write_admin_rh (ALL para admin/rh; admin/adm já cobertos
--    por is_admin()/is_editor(), rh segue com INSERT/UPDATE por is_editor() e
--    não tem CEU na UI) e gestor_entregas (INSERT para gestor, já coberto por
--    is_editor()) — de entregas e itens. A select_autenticado (SELECT USING
--    true) NÃO é removida nesta migration: o financeiro tem concessão
--    dinâmica de menu.ceu/rota.ceu/ceu.ver_relatorios em permissoes_perfil
--    (2 usuários ativos) e só lê entregas/itens por ela, pois pode_ver_ceu()
--    (065) não inclui financeiro — dropar agora quebraria o CEU → Relatórios
--    de telas oficialmente acessíveis. Decisão pendente da gestão: confirmar o
--    acesso do financeiro (incluir financeiro em pode_ver_ceu e então dropar
--    select_autenticado) ou revogar as linhas dinâmicas (e então dropar).
--    Análise completa em
--    dados-locais/investigacao_revisao_independente_2026-10-14/w6_relatorio_migration.md.
--
-- Mensagens de RAISE EXCEPTION em ASCII puro (sem acento) de propósito: a
-- aplicação via Management API/PowerShell 5.1 corrompe acentos em literais
-- (precedentes nas migrations 109 e 118). Comentários acentuados são seguros —
-- se corrompidos, não afetam a execução.

-- ============================================================
-- 1. Trigger de imutabilidade
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_entregas_recibo_imutavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Excecao: a RPC corrigir_item_entrega liga esta variavel com
  -- set_config('corh.correcao_autorizada', 'on', true) — escopo da transacao.
  IF current_setting('corh.correcao_autorizada', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.recibo_emitido IS TRUE THEN
      RAISE EXCEPTION 'Entrega com recibo emitido (%) nao pode ser excluida', COALESCE(OLD.numero_recibo, 'sem numero');
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: campos do documento emitido sao imutaveis; os demais
  -- (numero_recibo, recibo_emitido, data_devolucao, situacao, observacao)
  -- seguem livres para os fluxos normais de emissao e devolucao.
  IF OLD.recibo_emitido IS TRUE AND (
       NEW.item_id        IS DISTINCT FROM OLD.item_id
    OR NEW.snapshot_item  IS DISTINCT FROM OLD.snapshot_item
    OR NEW.quantidade     IS DISTINCT FROM OLD.quantidade
    OR NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id
    OR NEW.data_entrega   IS DISTINCT FROM OLD.data_entrega
  ) THEN
    RAISE EXCEPTION 'Entrega com recibo emitido (%) e imutavel: item, snapshot, quantidade, colaborador e data de entrega nao podem mudar', COALESCE(OLD.numero_recibo, 'sem numero');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entregas_recibo_imutavel ON public.entregas;
CREATE TRIGGER trg_entregas_recibo_imutavel
  BEFORE UPDATE OR DELETE ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_entregas_recibo_imutavel();

-- ============================================================
-- 2. Log de correções
-- ============================================================

CREATE TABLE IF NOT EXISTS public.entregas_correcoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid,
  colaborador_id uuid,
  item_id_anterior uuid,
  item_id_novo uuid,
  snapshot_anterior jsonb,
  snapshot_novo jsonb,
  motivo text NOT NULL,
  usuario_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.entregas_correcoes_log IS 'Auditoria das correções de item em entregas do CEU feitas pela RPC corrigir_item_entrega: antes/depois do item e do snapshot, motivo e autor. Sem policy de escrita — só a RPC (SECURITY DEFINER) grava.';

CREATE INDEX IF NOT EXISTS idx_entregas_correcoes_log_entrega
  ON public.entregas_correcoes_log(entrega_id);
CREATE INDEX IF NOT EXISTS idx_entregas_correcoes_log_created_at
  ON public.entregas_correcoes_log(created_at);

ALTER TABLE public.entregas_correcoes_log ENABLE ROW LEVEL SECURITY;

-- Leitura só para admin/adm (o log contém dados de entrega por colaborador).
DROP POLICY IF EXISTS "Permitir select do log de correcoes de entregas" ON public.entregas_correcoes_log;
CREATE POLICY "Permitir select do log de correcoes de entregas"
  ON public.entregas_correcoes_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- GRANT explícito (obrigatório desde a mudança do Supabase de 30/10/2026).
-- authenticated: só SELECT (a RLS restringe a admin). service_role: SELECT e
-- INSERT (scripts de correção em lote com service key, se necessário). A RPC é
-- SECURITY DEFINER e escreve como dona, independente de GRANT. Nada para anon.
GRANT SELECT ON public.entregas_correcoes_log TO authenticated;
GRANT SELECT, INSERT ON public.entregas_correcoes_log TO service_role;

-- ============================================================
-- 3. RPC de correção auditada
-- ============================================================

CREATE OR REPLACE FUNCTION public.corrigir_item_entrega(
  p_entrega_id uuid,
  p_novo_item_id uuid,
  p_motivo text,
  p_snapshot_item jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega public.entregas%ROWTYPE;
  v_item public.itens%ROWTYPE;
  v_snapshot jsonb;
BEGIN
  IF NOT (public.is_admin() OR (auth.jwt() ->> 'role') = 'service_role') THEN
    RAISE EXCEPTION 'Apenas admin/adm (ou script autorizado com chave de servico) podem corrigir o item de uma entrega';
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da correcao';
  END IF;

  SELECT * INTO v_entrega FROM public.entregas WHERE id = p_entrega_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega nao encontrada';
  END IF;

  SELECT * INTO v_item FROM public.itens WHERE id = p_novo_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item nao encontrado';
  END IF;
  -- Convencao do app: item ativo = situacao diferente de 'I' (null conta como ativo).
  -- Excecao: correcao historica com snapshot fornecido (p_snapshot_item) pode
  -- apontar para item inativo — e o caso dos itens 645/673/677 do incidente,
  -- que sao o registro fiel do sistema antigo e sairam de linha no cadastro.
  IF v_item.situacao = 'I' AND p_snapshot_item IS NULL THEN
    RAISE EXCEPTION 'O item de destino esta inativo no cadastro (%)', v_item.nome;
  END IF;

  IF v_entrega.item_id = p_novo_item_id AND p_snapshot_item IS NULL THEN
    RAISE EXCEPTION 'O item informado ja e o item atual da entrega';
  END IF;

  IF p_snapshot_item IS NOT NULL THEN
    -- Correcao do incidente: o snapshot historico (CA da data da entrega) vem
    -- pronto do chamador; nao se deve gravar o CA atual do cadastro.
    v_snapshot := p_snapshot_item;
  ELSE
    -- Mesma estrutura que o app grava (CeuEntregaFormPage/CeuImportarPage).
    v_snapshot := jsonb_build_object(
      'nome', v_item.nome,
      'codigo', COALESCE(v_item.codigo, ''),
      'tipo', v_item.tipo,
      'ca', COALESCE(v_item.ca, ''),
      'valor', v_item.valor,
      'prazo_uso_dias', v_item.prazo_uso_dias
    );
  END IF;

  -- Libera a trigger de imutabilidade apenas dentro desta transacao.
  PERFORM set_config('corh.correcao_autorizada', 'on', true);

  UPDATE public.entregas
  SET item_id = p_novo_item_id,
      snapshot_item = v_snapshot
  WHERE id = p_entrega_id;

  INSERT INTO public.entregas_correcoes_log (
    entrega_id, colaborador_id, item_id_anterior, item_id_novo,
    snapshot_anterior, snapshot_novo, motivo, usuario_id
  ) VALUES (
    v_entrega.id, v_entrega.colaborador_id, v_entrega.item_id, p_novo_item_id,
    v_entrega.snapshot_item, v_snapshot, btrim(p_motivo), auth.uid()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'entrega_id', v_entrega.id,
    'antes', jsonb_build_object('item_id', v_entrega.item_id, 'snapshot_item', v_entrega.snapshot_item),
    'depois', jsonb_build_object('item_id', p_novo_item_id, 'snapshot_item', v_snapshot)
  );
END;
$$;

-- A guarda interna (is_admin ou role service_role) é a autorização; como nas
-- demais RPCs do projeto, o EXECUTE fica liberado para autenticados. O grant
-- para service_role é o caminho dos scripts de correção em lote (a trigger de
-- imutabilidade os obriga a passar por esta RPC auditada).
GRANT EXECUTE ON FUNCTION public.corrigir_item_entrega(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.corrigir_item_entrega(uuid, uuid, text, jsonb) TO service_role;

-- ============================================================
-- 4. Limpeza das policies legadas (drift fora das migrations)
-- ============================================================
--
-- write_admin_rh (ALL para admin/rh): redundante. admin/adm já são cobertos
-- por is_admin() (DELETE) e is_editor() (INSERT/UPDATE); rh mantém INSERT/
-- UPDATE por is_editor() e perde SELECT/DELETE no nível da API — alinhamento,
-- pois rh não tem CEU na UI (menu.ceu/rota.ceu = false em permissoes_perfil).
-- gestor_entregas (INSERT para gestor): redundante — gestor está em
-- is_editor() ("Permitir insert para editores", migration 037).
--
-- select_autenticado (SELECT USING true) é MANTIDA de propósito — ver o item 4
-- do cabeçalho: o financeiro depende dela para as telas CEU que lhe foram
-- concedidas dinamicamente.

DROP POLICY IF EXISTS write_admin_rh ON public.entregas;
DROP POLICY IF EXISTS gestor_entregas ON public.entregas;

DROP POLICY IF EXISTS write_admin_rh ON public.itens;
DROP POLICY IF EXISTS gestor_entregas ON public.itens;
