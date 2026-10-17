-- ============================================================
-- 147 — Materiais, Fase 2: compras ao fornecedor, destino por linha e entrega
-- ============================================================
-- Plano aprovado: docs/PLANO_MATERIAIS_FASE2.md §3.3 e §5 (decisões da gestora de
-- 17/10/2026). Depende da 146 (estoque e funções pode_*).
--
-- Rotina real (gestora, 17/10/2026): o pedido enviado ao fornecedor É a lista de
-- entrega — o próprio fornecedor separa e entrega posto a posto. Por isso a compra
-- guarda uma célula por item × variação × CONTRATO (a coluna do Excel). A
-- separação pela mesa só existe para o que sai do NOSSO estoque.
--
-- NADA é automático: não há job/cron. A compra é gerada e enviada por quem tem
-- pode_comprar_materiais() (gestor ou mesa), clicando. Antes do dia de início da
-- compra (materiais_config.dia_inicio_compra, padrão 20) a compra é aceita e
-- marcada "antes_da_janela" — a tela só avisa (decisão: "pode haver exceções").
--
-- A) mat_compras / mat_compra_itens (snapshots de nome, unidade, contrato e rota,
--    para o Excel enviado ser sempre o mesmo e o financeiro ler sem acessar o
--    catálogo). Escrita só por RPC.
-- B) mat_pedido_itens ganha o destino da linha (atendimento: fornecedor | estoque
--    | escritorio | nao_atendido; qtd_estoque/qtd_compra; compra_item_id) e a
--    entrega (qtd_entregue_estoque, qtd_recebida_fornecedor, qtd_entregue =
--    soma). Trigger de guarda: essas colunas só mudam pelas RPCs desta migration.
-- C) mat_pedidos.status_produtos aceita em_compra, entregue, entregue_parcial
--    (nenhum pedido nesses estados na data). Função interna
--    mat_recalcular_status_entrega().
-- D) RPCs: mat_previa_compra (leitura agregada no servidor — sem o corte de
--    1.000 linhas), mat_gerar_compras (destino + rascunho por fornecedor, numa
--    transação), mat_gerar_compra_reposicao, mat_enviar_compra (congela),
--    mat_cancelar_compra, mat_registrar_chegada, mat_registrar_separacao.
-- E) RPCs da Fase 1 recriadas a partir do pg_get_functiondef real (tabela 3.3 do
--    plano) + mat_salvar_config com os dias do calendário da compra.
-- F) Permissões mínimas: menu/rota.materiais_compras (o financeiro entra só na
--    aba Compras, como na aba Fornecedores) + reset_permissoes_perfil recriada
--    (= 129 + essas linhas). As ações (materiais.comprar, ver_compras etc.) valem
--    pelo PERMISSOES_PADRAO; o banco confere pelas pode_* da 146.
--
-- Idempotente. GRANT explícito nas tabelas novas. Backup prévio em
-- dados-locais/backup_materiais_146_147_2026-10-17/ (funções recriadas, linhas
-- de pedido, permissoes_perfil).
-- ============================================================

-- ============================================================
-- A) Compras
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mat_compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL CHECK (competencia = date_trunc('month', competencia)::date),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id),
  numero text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'mensal' CHECK (tipo IN ('mensal', 'avulsa', 'reposicao_estoque')),
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'enviada', 'recebida_parcial', 'recebida', 'cancelada')),
  -- Gerada antes do dia de início da compra (só registro; não é trava).
  antes_da_janela boolean NOT NULL DEFAULT false,
  data_corte timestamptz NOT NULL DEFAULT now(),
  entrega_prevista date,
  enviada_em timestamptz,
  enviada_por uuid,
  cancelada_em timestamptz,
  cancelada_por uuid,
  cancelada_motivo text,
  observacao text,
  criado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mat_compras_competencia_idx ON public.mat_compras (competencia, fornecedor_id);
CREATE INDEX IF NOT EXISTS mat_compras_status_idx ON public.mat_compras (status);

CREATE TABLE IF NOT EXISTS public.mat_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.mat_compras(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.mat_itens(id),
  variacao_id uuid REFERENCES public.mat_item_variacoes(id),
  -- NULL = reposição do estoque (coluna "Estoque" do Excel).
  contrato_id uuid REFERENCES public.mat_contratos(id),
  -- Snapshots (o Excel enviado nunca muda).
  item_nome text NOT NULL,
  variacao_rotulo text,
  unidade text,
  categoria text,
  contrato_nome text,
  rota smallint CHECK (rota IN (1, 2, 3, 4)),
  quantidade numeric(12,2) NOT NULL CHECK (quantidade > 0),
  -- Preço vigente na data da compra (NULL = item sem preço cadastrado).
  preco_unitario numeric(12,2),
  qtd_recebida numeric(12,2) CHECK (qtd_recebida >= 0),
  motivo_recebimento text,
  recebido_em date,
  recebido_por uuid,
  entrega_local text NOT NULL CHECK (entrega_local IN ('posto', 'escritorio')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mat_compra_itens_local_ck CHECK ((contrato_id IS NULL) = (entrega_local = 'escritorio')),
  CONSTRAINT mat_compra_itens_recebido_ck CHECK (
    qtd_recebida IS NULL OR qtd_recebida >= quantidade OR btrim(coalesce(motivo_recebimento, '')) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS mat_compra_itens_celula_uq
  ON public.mat_compra_itens (compra_id, item_id,
     coalesce(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid),
     coalesce(contrato_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS mat_compra_itens_compra_idx ON public.mat_compra_itens (compra_id);

ALTER TABLE public.mat_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_compra_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mat_compras_select ON public.mat_compras;
CREATE POLICY mat_compras_select ON public.mat_compras
  FOR SELECT TO authenticated USING (public.pode_ver_compras_materiais());
DROP POLICY IF EXISTS mat_compra_itens_select ON public.mat_compra_itens;
CREATE POLICY mat_compra_itens_select ON public.mat_compra_itens
  FOR SELECT TO authenticated USING (public.pode_ver_compras_materiais());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_compras TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_compra_itens TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.mat_compras FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mat_compra_itens FROM authenticated;
REVOKE ALL ON public.mat_compras FROM anon;
REVOKE ALL ON public.mat_compra_itens FROM anon;

-- FK pendente da 146 (entrada de compra no estoque).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mat_estoque_mov_compra_item_fk') THEN
    ALTER TABLE public.mat_estoque_movimentos
      ADD CONSTRAINT mat_estoque_mov_compra_item_fk
      FOREIGN KEY (compra_item_id) REFERENCES public.mat_compra_itens(id);
  END IF;
END $$;

-- ============================================================
-- B) Destino e entrega por linha do pedido
-- ============================================================
ALTER TABLE public.mat_pedido_itens
  ADD COLUMN IF NOT EXISTS atendimento text,
  ADD COLUMN IF NOT EXISTS qtd_estoque numeric(12,2),
  ADD COLUMN IF NOT EXISTS qtd_compra numeric(12,2),
  ADD COLUMN IF NOT EXISTS compra_item_id uuid REFERENCES public.mat_compra_itens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_nao_atendido text,
  ADD COLUMN IF NOT EXISTS atendimento_por uuid,
  ADD COLUMN IF NOT EXISTS atendimento_em timestamptz,
  ADD COLUMN IF NOT EXISTS qtd_entregue_estoque numeric(12,2),
  ADD COLUMN IF NOT EXISTS qtd_recebida_fornecedor numeric(12,2),
  ADD COLUMN IF NOT EXISTS motivo_entrega text,
  ADD COLUMN IF NOT EXISTS entregue_em date,
  ADD COLUMN IF NOT EXISTS entregue_por uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mat_pedido_itens_atendimento_ck') THEN
    ALTER TABLE public.mat_pedido_itens ADD CONSTRAINT mat_pedido_itens_atendimento_ck CHECK (
      atendimento IS NULL OR atendimento IN ('fornecedor', 'estoque', 'escritorio', 'nao_atendido'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mat_pedido_itens_destino_qtd_ck') THEN
    ALTER TABLE public.mat_pedido_itens ADD CONSTRAINT mat_pedido_itens_destino_qtd_ck CHECK (
      coalesce(qtd_estoque, 0) >= 0 AND coalesce(qtd_compra, 0) >= 0
      AND coalesce(qtd_entregue_estoque, 0) >= 0 AND coalesce(qtd_recebida_fornecedor, 0) >= 0
      AND (atendimento IS NULL
           OR (qtd_aprovada IS NOT NULL AND coalesce(qtd_estoque, 0) + coalesce(qtd_compra, 0) <= qtd_aprovada)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mat_pedido_itens_nao_atendido_ck') THEN
    ALTER TABLE public.mat_pedido_itens ADD CONSTRAINT mat_pedido_itens_nao_atendido_ck CHECK (
      atendimento IS DISTINCT FROM 'nao_atendido' OR btrim(coalesce(motivo_nao_atendido, '')) <> '');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mat_pedido_itens_compra_ck') THEN
    ALTER TABLE public.mat_pedido_itens ADD CONSTRAINT mat_pedido_itens_compra_ck CHECK (
      compra_item_id IS NULL OR coalesce(qtd_compra, 0) > 0);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS mat_pedido_itens_compra_item_idx ON public.mat_pedido_itens (compra_item_id);
CREATE INDEX IF NOT EXISTS mat_pedido_itens_sem_destino_idx
  ON public.mat_pedido_itens (pedido_id) WHERE atendimento IS NULL AND qtd_aprovada > 0;

COMMENT ON COLUMN public.mat_pedido_itens.atendimento IS
  'Destino da linha aprovada (Fase 2, migration 147): fornecedor (entrega no posto; pode ter parte do estoque), estoque, escritorio (itens preparados no escritório) ou nao_atendido (com motivo). Só muda pelas RPCs de compra.';

-- Guarda: as colunas de destino/entrega só mudam pelas RPCs da Fase 2 (que ligam
-- corh.mat_fase2 com set_config e o desligam antes de retornar). Também impede apagar linha que já tem destino.
CREATE OR REPLACE FUNCTION public.mat_pedido_itens_guarda_fase2()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(current_setting('corh.mat_fase2', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.atendimento IS NOT NULL THEN
      RAISE EXCEPTION 'Linha com destino na compra não pode ser apagada';
    END IF;
    RETURN OLD;
  END IF;
  IF (NEW.atendimento, NEW.qtd_estoque, NEW.qtd_compra, NEW.compra_item_id, NEW.motivo_nao_atendido,
      NEW.atendimento_por, NEW.atendimento_em, NEW.qtd_entregue_estoque, NEW.qtd_recebida_fornecedor,
      NEW.qtd_entregue, NEW.motivo_entrega, NEW.entregue_em, NEW.entregue_por)
     IS DISTINCT FROM
     (OLD.atendimento, OLD.qtd_estoque, OLD.qtd_compra, OLD.compra_item_id, OLD.motivo_nao_atendido,
      OLD.atendimento_por, OLD.atendimento_em, OLD.qtd_entregue_estoque, OLD.qtd_recebida_fornecedor,
      OLD.qtd_entregue, OLD.motivo_entrega, OLD.entregue_em, OLD.entregue_por) THEN
    RAISE EXCEPTION 'Destino e entrega da linha só mudam pelas telas de compra, separação e chegada';
  END IF;
  IF OLD.atendimento IS NOT NULL AND (NEW.qtd_aprovada IS DISTINCT FROM OLD.qtd_aprovada
       OR NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.variacao_id IS DISTINCT FROM OLD.variacao_id) THEN
    RAISE EXCEPTION 'Linha com destino na compra não muda mais (item e quantidade aprovada)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mat_pedido_itens_guarda_fase2 ON public.mat_pedido_itens;
CREATE TRIGGER trg_mat_pedido_itens_guarda_fase2
  BEFORE UPDATE OR DELETE ON public.mat_pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.mat_pedido_itens_guarda_fase2();

-- ============================================================
-- C) Status do pedido
-- ============================================================
ALTER TABLE public.mat_pedidos DROP CONSTRAINT IF EXISTS mat_pedidos_status_produtos_check;
ALTER TABLE public.mat_pedidos ADD CONSTRAINT mat_pedidos_status_produtos_check CHECK (status_produtos IN
  ('nao_se_aplica', 'rascunho', 'enviado', 'em_validacao', 'validado', 'aprovado', 'cancelado',
   'em_compra', 'entregue', 'entregue_parcial'));

-- Linha "fechada" para a entrega: não atendida, ou todas as partes registradas.
CREATE OR REPLACE FUNCTION public.mat_linha_entrega_fechada(l public.mat_pedido_itens)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$
  SELECT l.atendimento = 'nao_atendido'
      OR (l.atendimento IS NOT NULL
          AND (CASE WHEN l.atendimento = 'escritorio' THEN l.qtd_entregue_estoque IS NOT NULL
                    ELSE coalesce(l.qtd_estoque, 0) = 0 OR l.qtd_entregue_estoque IS NOT NULL END)
          AND (coalesce(l.qtd_compra, 0) = 0 OR l.qtd_recebida_fornecedor IS NOT NULL));
$$;

-- Quantidade que a linha planeja entregar (estoque + fornecedor, ou a aprovada no escritório).
CREATE OR REPLACE FUNCTION public.mat_linha_planejada(l public.mat_pedido_itens)
RETURNS numeric LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN l.atendimento = 'escritorio' THEN coalesce(l.qtd_aprovada, 0)
              WHEN l.atendimento = 'nao_atendido' THEN 0
              ELSE coalesce(l.qtd_estoque, 0) + coalesce(l.qtd_compra, 0) END;
$$;

-- Interna (chamada só pelas RPCs): avança o pedido pela entrega.
--  aprovado → em_compra: todas as linhas aprovadas (> 0) têm destino e a parte
--    do fornecedor está numa compra já ENVIADA;
--  em_compra → entregue / entregue_parcial: todas as linhas fechadas; parcial se
--    alguma entregou menos que a aprovada (inclui corte parcial na compra e
--    falta na chegada). Linha inteira "não atendida" conta como fechada e não
--    torna o pedido parcial (plano §3.3) — o motivo aparece na carta ao líder.
-- Pedidos ainda na fila do inspetor/gestor (em_validacao/validado) não mudam.
CREATE OR REPLACE FUNCTION public.mat_recalcular_status_entrega(p_pedido uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p public.mat_pedidos%ROWTYPE; v_novo text; n_total integer; n_sem integer; n_rasc integer;
        n_abertas integer; n_parcial integer;
BEGIN
  SELECT * INTO p FROM public.mat_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND OR p.status_produtos NOT IN ('aprovado', 'em_compra', 'entregue', 'entregue_parcial') THEN
    RETURN p.status_produtos;
  END IF;
  SELECT count(*),
         count(*) FILTER (WHERE l.atendimento IS NULL),
         count(*) FILTER (WHERE l.compra_item_id IS NOT NULL AND c.status = 'rascunho'),
         count(*) FILTER (WHERE NOT public.mat_linha_entrega_fechada(l)),
         count(*) FILTER (WHERE public.mat_linha_entrega_fechada(l)
                            AND l.atendimento <> 'nao_atendido' AND coalesce(l.qtd_entregue, 0) < l.qtd_aprovada)
    INTO n_total, n_sem, n_rasc, n_abertas, n_parcial
    FROM public.mat_pedido_itens l
    LEFT JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
    LEFT JOIN public.mat_compras c ON c.id = ci.compra_id
   WHERE l.pedido_id = p_pedido AND l.qtd_aprovada > 0;

  IF n_total = 0 THEN RETURN p.status_produtos; END IF;
  IF n_sem > 0 OR n_rasc > 0 THEN v_novo := 'aprovado';
  ELSIF n_abertas > 0 THEN v_novo := 'em_compra';
  ELSIF n_parcial > 0 THEN v_novo := 'entregue_parcial';
  ELSE v_novo := 'entregue';
  END IF;
  IF v_novo IS DISTINCT FROM p.status_produtos THEN
    UPDATE public.mat_pedidos SET status_produtos = v_novo WHERE id = p_pedido;
  END IF;
  RETURN v_novo;
END $$;

-- Dia configurável (materiais_config), com padrão.
CREATE OR REPLACE FUNCTION public.mat_config_dia(p_chave text, p_padrao integer)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v text; j jsonb;
BEGIN
  SELECT valor INTO v FROM public.configuracoes WHERE chave = 'materiais_config';
  IF v IS NULL THEN RETURN p_padrao; END IF;
  BEGIN j := v::jsonb; EXCEPTION WHEN others THEN RETURN p_padrao; END;
  IF jsonb_typeof(j -> p_chave) = 'number' THEN RETURN (j ->> p_chave)::integer; END IF;
  RETURN p_padrao;
END $$;

-- Nome do contrato e rota efetiva (para snapshots).
CREATE OR REPLACE FUNCTION public.mat_rota_efetiva_linha(p_linha uuid)
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(p.rota_override, c.rota)::smallint
    FROM public.mat_pedido_itens l
    JOIN public.mat_pedidos p ON p.id = l.pedido_id
    JOIN public.mat_contratos c ON c.id = p.contrato_id
   WHERE l.id = p_linha;
$$;

-- ============================================================
-- D) Prévia da compra (somente leitura, agregada no servidor)
-- ============================================================
-- Devolve: linhas aprovadas e ainda sem destino da competência E das anteriores
-- (selo "do mês anterior" na tela), pendências da fila (extras aguardando
-- inspetor/gestor — ficam de fora), lista do escritório, contratos sem rota,
-- data da última contagem fechada e o calendário configurado.
CREATE OR REPLACE FUNCTION public.mat_previa_compra(p_competencia date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_comp date := date_trunc('month', p_competencia)::date; v_hoje date := public.mat_hoje();
        v_linhas jsonb; v_pend jsonb; v_escr jsonb;
BEGIN
  IF NOT (public.pode_comprar_materiais() OR public.pode_ver_compras_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para ver a compra de materiais';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'linha_id', l.id, 'pedido_id', p.id, 'pedido_tipo', p.tipo, 'competencia', p.competencia,
           'status_pedido', p.status_produtos, 'contrato_id', c.id, 'contrato_nome', c.nome,
           'rota', coalesce(p.rota_override, c.rota), 'parte', l.parte,
           'item_id', l.item_id, 'variacao_id', l.variacao_id, 'descricao_livre', l.descricao_livre,
           'item_nome', it.nome, 'variacao_rotulo', v.rotulo, 'unidade', it.unidade_pedido,
           'categoria', it.categoria, 'ordem', it.ordem,
           'preparo_escritorio', coalesce(it.preparo_escritorio, false),
           'qtd_aprovada', l.qtd_aprovada, 'preco_pedido', l.preco_unitario,
           'preco_vigente', CASE WHEN l.item_id IS NULL THEN NULL
                                 ELSE public.mat_preco_vigente(l.item_id, l.variacao_id, v_hoje) END,
           'fornecedor_padrao_id', it.fornecedor_id, 'fornecedor_padrao_nome', f.nome,
           'saldo_estoque', CASE WHEN l.item_id IS NULL OR it.preparo_escritorio THEN NULL
                                 ELSE public.mat_saldo_estoque(l.item_id, l.variacao_id) END,
           'created_at', l.created_at)
         ORDER BY it.ordem NULLS LAST, it.nome, v.rotulo, c.nome), '[]'::jsonb)
    INTO v_linhas
    FROM public.mat_pedido_itens l
    JOIN public.mat_pedidos p ON p.id = l.pedido_id
    JOIN public.mat_contratos c ON c.id = p.contrato_id
    LEFT JOIN public.mat_itens it ON it.id = l.item_id
    LEFT JOIN public.mat_item_variacoes v ON v.id = l.variacao_id
    LEFT JOIN public.fornecedores f ON f.id = it.fornecedor_id
   WHERE p.competencia <= v_comp
     AND p.status_produtos NOT IN ('cancelado', 'rascunho', 'nao_se_aplica')
     AND l.qtd_aprovada > 0
     AND l.atendimento IS NULL;

  -- Extras da competência ainda na fila (não entram nesta compra).
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'contrato_nome'), '[]'::jsonb) INTO v_pend
    FROM (
      SELECT jsonb_build_object('pedido_id', p.id, 'contrato_id', c.id, 'contrato_nome', c.nome,
               'status_pedido', p.status_produtos,
               'linhas_pendentes', count(*) FILTER (WHERE l.qtd_aprovada IS NULL AND l.qtd_pedida > 0)) AS x
        FROM public.mat_pedidos p
        JOIN public.mat_contratos c ON c.id = p.contrato_id
        JOIN public.mat_pedido_itens l ON l.pedido_id = p.id
       WHERE p.competencia = v_comp AND p.status_produtos IN ('enviado', 'em_validacao', 'validado')
       GROUP BY p.id, c.id, c.nome, p.status_produtos
      HAVING count(*) FILTER (WHERE l.qtd_aprovada IS NULL AND l.qtd_pedida > 0) > 0
    ) s;

  -- Lista do escritório: itens preparados no escritório, total do mês.
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'item_nome'), '[]'::jsonb) INTO v_escr
    FROM (
      SELECT jsonb_build_object('item_id', it.id, 'item_nome', it.nome, 'unidade', it.unidade_pedido,
               'total_aprovado', sum(coalesce(l.qtd_aprovada, 0)),
               'total_pendente', sum(CASE WHEN l.qtd_aprovada IS NULL THEN l.qtd_pedida ELSE 0 END),
               'separado', sum(coalesce(l.qtd_entregue_estoque, 0)),
               'contratos', count(DISTINCT p.contrato_id)) AS x
        FROM public.mat_pedido_itens l
        JOIN public.mat_pedidos p ON p.id = l.pedido_id
        JOIN public.mat_itens it ON it.id = l.item_id AND it.preparo_escritorio
       WHERE p.competencia = v_comp AND p.status_produtos NOT IN ('cancelado', 'rascunho', 'nao_se_aplica')
       GROUP BY it.id, it.nome, it.unidade_pedido
    ) s;

  RETURN jsonb_build_object(
    'competencia', v_comp, 'hoje', v_hoje,
    'linhas', v_linhas, 'pendentes', v_pend, 'escritorio', v_escr,
    'contratos_sem_rota', (SELECT count(*) FROM public.mat_contratos WHERE ativo AND rota IS NULL),
    'ultima_contagem', (SELECT max(data) FROM public.mat_estoque_contagens WHERE status = 'fechada'),
    'dia_inicio_compra', public.mat_config_dia('dia_inicio_compra', 20),
    'dia_fim_compra', public.mat_config_dia('dia_fim_compra', 25),
    'dia_limite_aprovacao', public.mat_config_dia('dia_limite_aprovacao', 20));
END $$;

-- ============================================================
-- D) Gerar compras (destino de cada linha + rascunho por fornecedor)
-- ============================================================
-- Cria (ou reaproveita, se já existir) o rascunho do fornecedor na competência.
CREATE OR REPLACE FUNCTION public.mat_rascunho_compra(p_competencia date, p_fornecedor uuid, p_tipo text,
                                                      p_observacao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; n integer; v_hoje date := public.mat_hoje();
BEGIN
  SELECT id INTO v_id FROM public.mat_compras
   WHERE competencia = p_competencia AND fornecedor_id = p_fornecedor AND tipo = p_tipo AND status = 'rascunho'
   ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN v_id; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mat_compras_numero' || p_competencia::text, 0));
  SELECT count(*) + 1 INTO n FROM public.mat_compras WHERE competencia = p_competencia;
  INSERT INTO public.mat_compras (competencia, fornecedor_id, numero, tipo, antes_da_janela, observacao)
  VALUES (p_competencia, p_fornecedor,
          'COMP-' || to_char(p_competencia, 'YYYY-MM') || '-' || lpad(n::text, 3, '0'),
          p_tipo,
          p_tipo <> 'reposicao_estoque'
            AND extract(day FROM v_hoje) < public.mat_config_dia('dia_inicio_compra', 20)
            AND date_trunc('month', v_hoje)::date = p_competencia,
          nullif(btrim(coalesce(p_observacao, '')), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Soma a quantidade na célula (item × variação × contrato) da compra.
CREATE OR REPLACE FUNCTION public.mat_somar_celula_compra(p_compra uuid, p_item uuid, p_variacao uuid,
                                                          p_contrato uuid, p_rota smallint, p_qtd numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; it public.mat_itens%ROWTYPE;
BEGIN
  SELECT id INTO v_id FROM public.mat_compra_itens
   WHERE compra_id = p_compra AND item_id = p_item AND variacao_id IS NOT DISTINCT FROM p_variacao
     AND contrato_id IS NOT DISTINCT FROM p_contrato
   FOR UPDATE;
  IF FOUND THEN
    UPDATE public.mat_compra_itens SET quantidade = quantidade + p_qtd WHERE id = v_id;
    RETURN v_id;
  END IF;
  SELECT * INTO it FROM public.mat_itens WHERE id = p_item;
  INSERT INTO public.mat_compra_itens (compra_id, item_id, variacao_id, contrato_id, item_nome, variacao_rotulo,
    unidade, categoria, contrato_nome, rota, quantidade, preco_unitario, entrega_local)
  VALUES (p_compra, p_item, p_variacao, p_contrato, it.nome,
    (SELECT rotulo FROM public.mat_item_variacoes WHERE id = p_variacao),
    it.unidade_pedido, it.categoria,
    (SELECT nome FROM public.mat_contratos WHERE id = p_contrato),
    p_rota, p_qtd, public.mat_preco_vigente(p_item, p_variacao, public.mat_hoje()),
    CASE WHEN p_contrato IS NULL THEN 'escritorio' ELSE 'posto' END)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- p_linhas: [{id, qtd_estoque, qtd_compra, fornecedor_id, motivo, nao_atender}]
--  - item preparado no escritório: destino 'escritorio' (nunca vai a compra);
--  - texto livre não ligado ao catálogo: só 'nao_atender' (ou ligar antes);
--  - qtd_estoque + qtd_compra ≤ aprovada; menor que a aprovada exige motivo;
--  - soma zero (ou nao_atender) = 'nao_atendido' com motivo.
-- Tudo numa transação: ou todas as linhas ganham destino, ou nenhuma.
CREATE OR REPLACE FUNCTION public.mat_gerar_compras(p_competencia date, p_tipo text, p_linhas jsonb,
                                                    p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_comp date := date_trunc('month', p_competencia)::date;
  e jsonb; l public.mat_pedido_itens%ROWTYPE; p public.mat_pedidos%ROWTYPE; it public.mat_itens%ROWTYPE;
  v_qe numeric; v_qc numeric; v_forn uuid; v_motivo text; v_nao boolean; v_atend text;
  v_compra uuid; v_celula uuid; v_compras uuid[] := '{}'; v_pedidos uuid[] := '{}'; n integer := 0;
BEGIN
  -- Sinal para a guarda de mat_pedido_itens; desligado antes de retornar.
  PERFORM set_config('corh.mat_fase2', 'on', true);
  IF NOT public.pode_comprar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para comprar materiais';
  END IF;
  IF p_tipo NOT IN ('mensal', 'avulsa') THEN RAISE EXCEPTION 'Tipo de compra inválido: %', p_tipo; END IF;
  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' OR jsonb_array_length(p_linhas) = 0 THEN
    RAISE EXCEPTION 'Nenhuma linha informada';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    SELECT * INTO l FROM public.mat_pedido_itens WHERE id = (e->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não encontrada', e->>'id'; END IF;
    SELECT * INTO p FROM public.mat_pedidos WHERE id = l.pedido_id FOR UPDATE;
    IF p.status_produtos IN ('cancelado', 'rascunho', 'nao_se_aplica') THEN
      RAISE EXCEPTION 'A linha % é de um pedido que não pode ser comprado (%)', l.id, p.status_produtos;
    END IF;
    IF p.competencia > v_comp THEN RAISE EXCEPTION 'A linha % é de competência posterior à compra', l.id; END IF;
    IF l.qtd_aprovada IS NULL OR l.qtd_aprovada <= 0 THEN
      RAISE EXCEPTION 'A linha % ainda não foi aprovada', l.id;
    END IF;
    IF l.atendimento IS NOT NULL THEN RAISE EXCEPTION 'A linha % já tem destino', l.id; END IF;

    v_motivo := nullif(btrim(coalesce(e->>'motivo', '')), '');
    v_nao := coalesce((e->>'nao_atender')::boolean, false);
    v_qe := coalesce(nullif(e->>'qtd_estoque', '')::numeric, 0);
    v_qc := coalesce(nullif(e->>'qtd_compra', '')::numeric, 0);
    v_forn := nullif(e->>'fornecedor_id', '')::uuid;
    v_celula := NULL;
    IF v_qe < 0 OR v_qc < 0 THEN RAISE EXCEPTION 'Quantidade negativa na linha %', l.id; END IF;

    IF l.item_id IS NULL AND NOT v_nao THEN
      RAISE EXCEPTION 'A linha "%" é texto livre: ligue ao catálogo antes de comprar, ou marque como não atendida', l.descricao_livre;
    END IF;
    IF l.item_id IS NOT NULL THEN SELECT * INTO it FROM public.mat_itens WHERE id = l.item_id; END IF;

    IF v_nao OR (l.item_id IS NOT NULL AND NOT it.preparo_escritorio AND v_qe + v_qc = 0) THEN
      IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo de não atender a linha %', l.id; END IF;
      v_atend := 'nao_atendido'; v_qe := 0; v_qc := 0;
    ELSIF it.preparo_escritorio THEN
      v_atend := 'escritorio'; v_qe := 0; v_qc := 0;
    ELSE
      IF v_qe + v_qc > l.qtd_aprovada THEN
        RAISE EXCEPTION 'A linha % passa da quantidade aprovada (% > %)', l.id, v_qe + v_qc, l.qtd_aprovada;
      END IF;
      IF v_qe + v_qc < l.qtd_aprovada AND v_motivo IS NULL THEN
        RAISE EXCEPTION 'Informe o motivo de atender menos que o aprovado na linha %', l.id;
      END IF;
      v_atend := CASE WHEN v_qc > 0 THEN 'fornecedor' ELSE 'estoque' END;
      IF v_qc > 0 THEN
        IF v_forn IS NULL OR NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = v_forn) THEN
          RAISE EXCEPTION 'Escolha o fornecedor da linha %', l.id;
        END IF;
        v_compra := public.mat_rascunho_compra(v_comp, v_forn, p_tipo, p_observacao);
        IF NOT v_compra = ANY (v_compras) THEN v_compras := v_compras || v_compra; END IF;
        v_celula := public.mat_somar_celula_compra(v_compra, l.item_id, l.variacao_id, p.contrato_id,
                      coalesce(p.rota_override, (SELECT rota FROM public.mat_contratos WHERE id = p.contrato_id))::smallint,
                      v_qc);
      END IF;
    END IF;

    UPDATE public.mat_pedido_itens
       SET atendimento = v_atend,
           qtd_estoque = CASE WHEN v_qe > 0 THEN v_qe END,
           qtd_compra = CASE WHEN v_qc > 0 THEN v_qc END,
           compra_item_id = v_celula,
           motivo_nao_atendido = CASE WHEN v_atend = 'nao_atendido' OR v_qe + v_qc < l.qtd_aprovada
                                        AND v_atend IN ('fornecedor', 'estoque') THEN v_motivo END,
           atendimento_por = auth.uid(), atendimento_em = now()
     WHERE id = l.id;
    IF NOT l.pedido_id = ANY (v_pedidos) THEN v_pedidos := v_pedidos || l.pedido_id; END IF;
    n := n + 1;
  END LOOP;

  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(v_pedidos) x;

  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('linhas', n,
    'compras', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'numero', c.numero,
                  'fornecedor_id', c.fornecedor_id, 'antes_da_janela', c.antes_da_janela,
                  'celulas', (SELECT count(*) FROM public.mat_compra_itens ci WHERE ci.compra_id = c.id))
                  ORDER BY c.numero), '[]'::jsonb)
                  FROM public.mat_compras c WHERE c.id = ANY (v_compras)));
END $$;

-- Reposição do estoque: itens sem contrato, entrega no escritório.
-- p_itens: [{item_id, variacao_id, quantidade}]
CREATE OR REPLACE FUNCTION public.mat_gerar_compra_reposicao(p_fornecedor uuid, p_itens jsonb,
                                                             p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE e jsonb; v_compra uuid; v_comp date := date_trunc('month', public.mat_hoje())::date;
        v_item uuid; v_var uuid; v_qtd numeric; n integer := 0;
BEGIN
  IF NOT public.pode_comprar_materiais() THEN RAISE EXCEPTION 'Sem permissão para comprar materiais'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = p_fornecedor) THEN
    RAISE EXCEPTION 'Fornecedor não encontrado';
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Nenhum item informado';
  END IF;
  v_compra := public.mat_rascunho_compra(v_comp, p_fornecedor, 'reposicao_estoque', p_observacao);
  FOR e IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_item := (e->>'item_id')::uuid; v_var := nullif(e->>'variacao_id', '')::uuid;
    v_qtd := nullif(e->>'quantidade', '')::numeric;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    PERFORM public.mat_validar_item_estoque(v_item, v_var);
    PERFORM public.mat_somar_celula_compra(v_compra, v_item, v_var, NULL, NULL, v_qtd);
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('id', v_compra, 'numero', (SELECT numero FROM public.mat_compras WHERE id = v_compra),
                            'itens', n);
END $$;

-- Rascunho → enviada: congela as quantidades; a rota da célula passa a ser a do envio.
CREATE OR REPLACE FUNCTION public.mat_enviar_compra(p_compra uuid, p_entrega_prevista date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.mat_compras%ROWTYPE; v_pedidos uuid[];
BEGIN
  IF NOT public.pode_comprar_materiais() THEN RAISE EXCEPTION 'Sem permissão para enviar a compra'; END IF;
  SELECT * INTO c FROM public.mat_compras WHERE id = p_compra FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
  IF c.status <> 'rascunho' THEN RAISE EXCEPTION 'Só compra em rascunho pode ser enviada (%)', c.status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mat_compra_itens WHERE compra_id = p_compra) THEN
    RAISE EXCEPTION 'Compra sem itens';
  END IF;
  UPDATE public.mat_compra_itens ci
     SET rota = coalesce((SELECT public.mat_rota_efetiva_linha(l.id) FROM public.mat_pedido_itens l
                           WHERE l.compra_item_id = ci.id ORDER BY l.created_at LIMIT 1), ci.rota)
   WHERE ci.compra_id = p_compra AND ci.contrato_id IS NOT NULL;
  UPDATE public.mat_compras
     SET status = 'enviada', enviada_em = now(), enviada_por = auth.uid(),
         entrega_prevista = coalesce(p_entrega_prevista, entrega_prevista)
   WHERE id = p_compra;
  SELECT array_agg(DISTINCT l.pedido_id) INTO v_pedidos
    FROM public.mat_pedido_itens l JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
   WHERE ci.compra_id = p_compra;
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(coalesce(v_pedidos, '{}')) x;
  RETURN jsonb_build_object('id', p_compra, 'numero', c.numero, 'pedidos', coalesce(array_length(v_pedidos, 1), 0));
END $$;

-- Cancelar: só rascunho, ou enviada sem nada recebido. As linhas voltam a "sem destino".
CREATE OR REPLACE FUNCTION public.mat_cancelar_compra(p_compra uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.mat_compras%ROWTYPE; v_pedidos uuid[]; n integer;
BEGIN
  -- Sinal para a guarda de mat_pedido_itens; desligado antes de retornar.
  PERFORM set_config('corh.mat_fase2', 'on', true);
  IF NOT public.pode_comprar_materiais() THEN RAISE EXCEPTION 'Sem permissão para cancelar a compra'; END IF;
  IF btrim(coalesce(p_motivo, '')) = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  SELECT * INTO c FROM public.mat_compras WHERE id = p_compra FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
  IF c.status NOT IN ('rascunho', 'enviada') THEN
    RAISE EXCEPTION 'Esta compra não pode mais ser cancelada (%)', c.status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.mat_compra_itens WHERE compra_id = p_compra AND qtd_recebida IS NOT NULL) THEN
    RAISE EXCEPTION 'Já há chegada registrada nesta compra: não dá para cancelar';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mat_pedido_itens l JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
              WHERE ci.compra_id = p_compra AND l.qtd_entregue_estoque IS NOT NULL) THEN
    RAISE EXCEPTION 'Há linhas desta compra com parte já separada do estoque: não dá para cancelar';
  END IF;
  SELECT array_agg(DISTINCT l.pedido_id) INTO v_pedidos
    FROM public.mat_pedido_itens l JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
   WHERE ci.compra_id = p_compra;
  UPDATE public.mat_pedido_itens l
     SET atendimento = NULL, qtd_estoque = NULL, qtd_compra = NULL, compra_item_id = NULL,
         motivo_nao_atendido = NULL, atendimento_por = NULL, atendimento_em = NULL
    FROM public.mat_compra_itens ci
   WHERE ci.id = l.compra_item_id AND ci.compra_id = p_compra;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.mat_compras
     SET status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), cancelada_motivo = p_motivo
   WHERE id = p_compra;
  -- Pedido que já estava em_compra volta para aprovado (linhas sem destino).
  UPDATE public.mat_pedidos SET status_produtos = 'aprovado'
   WHERE id = ANY (coalesce(v_pedidos, '{}')) AND status_produtos = 'em_compra';
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(coalesce(v_pedidos, '{}')) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('id', p_compra, 'linhas_liberadas', n);
END $$;

-- ============================================================
-- D) Chegada (o que o fornecedor entregou) e separação (o que sai do estoque)
-- ============================================================
-- p_itens: [{id (célula), qtd_recebida, motivo}]. Pode registrar de novo
-- (completar depois). Célula de contrato: distribui nas linhas ligadas — kit
-- primeiro, depois extras, por ordem de criação. Célula de reposição: entra no
-- estoque (só aumenta; reduzir exige estorno pela tela de estoque).
CREATE OR REPLACE FUNCTION public.mat_registrar_chegada(p_compra uuid, p_itens jsonb, p_data date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.mat_compras%ROWTYPE; e jsonb; ci public.mat_compra_itens%ROWTYPE; l record;
        v_qtd numeric; v_motivo text; v_resto numeric; v_r numeric; v_data date := coalesce(p_data, public.mat_hoje());
        v_pedidos uuid[] := '{}'; n integer := 0; v_status text;
BEGIN
  -- Sinal para a guarda de mat_pedido_itens; desligado antes de retornar.
  PERFORM set_config('corh.mat_fase2', 'on', true);
  IF NOT public.pode_registrar_chegada_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para registrar a chegada';
  END IF;
  SELECT * INTO c FROM public.mat_compras WHERE id = p_compra FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
  IF c.status NOT IN ('enviada', 'recebida_parcial', 'recebida') THEN
    RAISE EXCEPTION 'Só compra enviada recebe registro de chegada (%)', c.status;
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) LOOP
    SELECT * INTO ci FROM public.mat_compra_itens WHERE id = (e->>'id')::uuid AND compra_id = p_compra FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item % não pertence à compra', e->>'id'; END IF;
    v_qtd := nullif(e->>'qtd_recebida', '')::numeric;
    v_motivo := nullif(btrim(coalesce(e->>'motivo', '')), '');
    IF v_qtd IS NULL OR v_qtd < 0 THEN RAISE EXCEPTION 'Quantidade recebida inválida'; END IF;
    IF v_qtd > ci.quantidade THEN
      RAISE EXCEPTION 'Recebido (%) maior que o comprado (%) em "%"', v_qtd, ci.quantidade, ci.item_nome;
    END IF;
    IF v_qtd < ci.quantidade AND v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo da entrega menor em "%"%', ci.item_nome,
        coalesce(' — ' || ci.contrato_nome, '');
    END IF;

    IF ci.contrato_id IS NULL THEN
      IF v_qtd < coalesce(ci.qtd_recebida, 0) THEN
        RAISE EXCEPTION 'Reposição do estoque só aumenta (já registrado %); corrija pelo estoque', ci.qtd_recebida;
      END IF;
      IF v_qtd > coalesce(ci.qtd_recebida, 0) THEN
        INSERT INTO public.mat_estoque_movimentos (item_id, variacao_id, tipo, quantidade, data, compra_item_id, motivo)
        VALUES (ci.item_id, ci.variacao_id, 'entrada_compra', v_qtd - coalesce(ci.qtd_recebida, 0), v_data, ci.id,
                'Compra ' || c.numero);
      END IF;
    ELSE
      v_resto := v_qtd;
      FOR l IN SELECT * FROM public.mat_pedido_itens WHERE compra_item_id = ci.id
                ORDER BY (parte = 'kit') DESC, created_at FOR UPDATE LOOP
        v_r := least(v_resto, l.qtd_compra);
        v_resto := v_resto - v_r;
        UPDATE public.mat_pedido_itens
           SET qtd_recebida_fornecedor = v_r,
               qtd_entregue = coalesce(qtd_entregue_estoque, 0) + v_r,
               motivo_entrega = CASE WHEN v_r < l.qtd_compra THEN v_motivo ELSE motivo_entrega END,
               entregue_em = v_data, entregue_por = auth.uid()
         WHERE id = l.id;
        IF NOT l.pedido_id = ANY (v_pedidos) THEN v_pedidos := v_pedidos || l.pedido_id; END IF;
      END LOOP;
    END IF;
    UPDATE public.mat_compra_itens
       SET qtd_recebida = v_qtd, motivo_recebimento = CASE WHEN v_qtd < quantidade THEN v_motivo END,
           recebido_em = v_data, recebido_por = auth.uid()
     WHERE id = ci.id;
    n := n + 1;
  END LOOP;

  v_status := CASE WHEN EXISTS (SELECT 1 FROM public.mat_compra_itens WHERE compra_id = p_compra AND qtd_recebida IS NULL)
                   THEN 'recebida_parcial' ELSE 'recebida' END;
  UPDATE public.mat_compras SET status = v_status WHERE id = p_compra;
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(v_pedidos) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('itens', n, 'status', v_status);
END $$;

-- Separação: o que sai do NOSSO estoque (baixa aqui — decisão 4) e os itens do
-- escritório (sem movimento de estoque). p_linhas: [{id, qtd, motivo}] — uma vez por linha.
CREATE OR REPLACE FUNCTION public.mat_registrar_separacao(p_linhas jsonb, p_data date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE e jsonb; l public.mat_pedido_itens%ROWTYPE; p public.mat_pedidos%ROWTYPE; v_plan numeric; v_qtd numeric;
        v_motivo text; v_data date := coalesce(p_data, public.mat_hoje()); v_pedidos uuid[] := '{}'; n integer := 0;
BEGIN
  -- Sinal para a guarda de mat_pedido_itens; desligado antes de retornar.
  PERFORM set_config('corh.mat_fase2', 'on', true);
  IF NOT public.pode_movimentar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para registrar a separação';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) LOOP
    SELECT * INTO l FROM public.mat_pedido_itens WHERE id = (e->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não encontrada', e->>'id'; END IF;
    SELECT * INTO p FROM public.mat_pedidos WHERE id = l.pedido_id;
    IF l.atendimento = 'escritorio' THEN v_plan := l.qtd_aprovada;
    ELSIF l.atendimento IN ('estoque', 'fornecedor') AND coalesce(l.qtd_estoque, 0) > 0 THEN v_plan := l.qtd_estoque;
    ELSE RAISE EXCEPTION 'A linha % não tem parte a sair do estoque ou do escritório', l.id;
    END IF;
    IF l.qtd_entregue_estoque IS NOT NULL THEN RAISE EXCEPTION 'A linha % já foi separada', l.id; END IF;
    v_qtd := coalesce(nullif(e->>'qtd', '')::numeric, v_plan);
    v_motivo := nullif(btrim(coalesce(e->>'motivo', '')), '');
    IF v_qtd < 0 OR v_qtd > v_plan THEN RAISE EXCEPTION 'Quantidade separada inválida na linha %', l.id; END IF;
    IF v_qtd < v_plan AND v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo de separar menos na linha %', l.id;
    END IF;
    IF l.atendimento <> 'escritorio' AND v_qtd > 0 THEN
      INSERT INTO public.mat_estoque_movimentos (item_id, variacao_id, tipo, quantidade, data, pedido_item_id, contrato_id)
      VALUES (l.item_id, l.variacao_id, 'saida_pedido', -v_qtd, v_data, l.id, p.contrato_id);
    END IF;
    UPDATE public.mat_pedido_itens
       SET qtd_entregue_estoque = v_qtd,
           qtd_entregue = v_qtd + coalesce(qtd_recebida_fornecedor, 0),
           motivo_entrega = coalesce(v_motivo, motivo_entrega),
           entregue_em = v_data, entregue_por = auth.uid()
     WHERE id = l.id;
    IF NOT l.pedido_id = ANY (v_pedidos) THEN v_pedidos := v_pedidos || l.pedido_id; END IF;
    n := n + 1;
  END LOOP;
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(v_pedidos) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('linhas', n);
END $$;

-- ============================================================
-- Execução das funções novas
-- ============================================================
DO $$
DECLARE f text;
BEGIN
  -- Chamadas pela tela (reconferem perfil e estado).
  FOREACH f IN ARRAY ARRAY[
    'public.mat_previa_compra(date)',
    'public.mat_gerar_compras(date, text, jsonb, text)',
    'public.mat_gerar_compra_reposicao(uuid, jsonb, text)',
    'public.mat_enviar_compra(uuid, date)',
    'public.mat_cancelar_compra(uuid, text)',
    'public.mat_registrar_chegada(uuid, jsonb, date)',
    'public.mat_registrar_separacao(jsonb, date)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
  -- Internas (sem checagem de perfil própria): nunca expostas ao PostgREST.
  FOREACH f IN ARRAY ARRAY[
    'public.mat_recalcular_status_entrega(uuid)',
    'public.mat_rascunho_compra(date, uuid, text, text)',
    'public.mat_somar_celula_compra(uuid, uuid, uuid, uuid, smallint, numeric)',
    'public.mat_rota_efetiva_linha(uuid)',
    'public.mat_config_dia(text, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ============================================================
-- F) Permissões mínimas do Marco A: aba Compras
-- ============================================================
-- O financeiro entra SÓ na aba Compras (consulta com valores, sem alterar —
-- decisão 14), no mesmo molde de menu/rota.materiais_fornecedores. Quem tem o
-- módulo inteiro (gestor, mesa, inspetoria) vê a aba pelo shell; as linhas abaixo
-- só deixam o valor explícito na tela Permissões.
INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
  ('visualizador', 'menu', 'materiais_compras', false),
  ('visualizador', 'rota', 'materiais_compras', false),
  ('gestor', 'menu', 'materiais_compras', true),
  ('gestor', 'rota', 'materiais_compras', true),
  ('rh', 'menu', 'materiais_compras', false),
  ('rh', 'rota', 'materiais_compras', false),
  ('dp1', 'menu', 'materiais_compras', false),
  ('dp1', 'rota', 'materiais_compras', false),
  ('dp2', 'menu', 'materiais_compras', false),
  ('dp2', 'rota', 'materiais_compras', false),
  ('mesa', 'menu', 'materiais_compras', true),
  ('mesa', 'rota', 'materiais_compras', true),
  ('inspetoria', 'menu', 'materiais_compras', true),
  ('inspetoria', 'rota', 'materiais_compras', true),
  ('financeiro', 'menu', 'materiais_compras', true),
  ('financeiro', 'rota', 'materiais_compras', true),
  ('dp3', 'menu', 'materiais_compras', false),
  ('dp3', 'rota', 'materiais_compras', false)
ON CONFLICT (perfil, recurso, acao) DO UPDATE SET permitido = EXCLUDED.permitido;

-- ============================================================
-- E) RPCs da Fase 1 recriadas (verbatim do pg_get_functiondef de 17/10/2026 +
--    as travas da Fase 2) e reset_permissoes_perfil (= 129 + materiais_compras)
-- ============================================================
-- ajustar_linha_kit_materiais (135) + recusa linha com destino

CREATE OR REPLACE FUNCTION public.ajustar_linha_kit_materiais(p_linha uuid, p_qtd numeric, p_motivo text, p_item uuid DEFAULT NULL::uuid, p_variacao uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l public.mat_pedido_itens%ROWTYPE; p public.mat_pedidos%ROWTYPE;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_teto numeric; v_item uuid; v_var uuid; v_troca boolean := false;
  v_aprova boolean; v_nome_de text; v_nome_para text; v_texto text;
BEGIN
  IF NOT (public.pode_validar_materiais() OR public.pode_aprovar_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para ajustar o kit do pedido';
  END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo do ajuste'; END IF;
  SELECT * INTO l FROM public.mat_pedido_itens WHERE id = p_linha FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha não encontrada'; END IF;
  -- Fase 2 (147): linha com destino na compra não muda mais (decisão 8).
  IF l.atendimento IS NOT NULL THEN
    RAISE EXCEPTION 'Esta linha já tem destino na compra e não pode mais ser ajustada';
  END IF;
  IF l.parte <> 'kit' THEN
    RAISE EXCEPTION 'Só linha do kit é ajustada aqui (o pedido extra segue pela validação/aprovação)';
  END IF;
  SELECT * INTO p FROM public.mat_pedidos WHERE id = l.pedido_id FOR UPDATE;
  IF p.status_produtos NOT IN ('em_validacao', 'validado', 'aprovado') THEN
    RAISE EXCEPTION 'O kit deste pedido não pode mais ser ajustado (%)', p.status_produtos;
  END IF;
  IF p_qtd IS NULL OR p_qtd < 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  v_teto := greatest(coalesce(l.qtd_kit, 0), l.qtd_pedida);
  IF p_qtd > v_teto THEN
    RAISE EXCEPTION 'O kit só diminui (máximo %). Para dar mais, use o pedido extra.', trim_scale(v_teto);
  END IF;

  v_item := coalesce(p_item, l.item_id);
  v_var := CASE WHEN p_item IS NULL THEN coalesce(p_variacao, l.variacao_id) ELSE p_variacao END;
  v_troca := v_item IS DISTINCT FROM l.item_id OR v_var IS DISTINCT FROM l.variacao_id;
  IF v_troca THEN
    IF NOT EXISTS (SELECT 1 FROM public.mat_itens WHERE id = v_item AND ativo) THEN
      RAISE EXCEPTION 'Item de troca inexistente ou inativo';
    END IF;
    IF v_var IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.mat_item_variacoes WHERE id = v_var AND item_id = v_item AND ativo) THEN
      RAISE EXCEPTION 'Opção (variação) inválida para o item de troca';
    END IF;
    IF v_var IS NULL AND EXISTS (SELECT 1 FROM public.mat_item_variacoes WHERE item_id = v_item AND ativo) THEN
      RAISE EXCEPTION 'Escolha a opção (variação) do item de troca';
    END IF;
  END IF;

  v_aprova := l.aprovado_automatico OR l.qtd_aprovada IS NOT NULL OR p.status_produtos = 'aprovado';
  SELECT nome INTO v_nome_de FROM public.mat_itens WHERE id = l.item_id;
  SELECT nome INTO v_nome_para FROM public.mat_itens WHERE id = v_item;

  UPDATE public.mat_pedido_itens
     SET qtd_validada = p_qtd,
         qtd_aprovada = CASE WHEN v_aprova THEN p_qtd ELSE qtd_aprovada END,
         item_original_id = CASE WHEN v_troca THEN coalesce(item_original_id, l.item_id) ELSE item_original_id END,
         variacao_original_id = CASE WHEN v_troca THEN coalesce(variacao_original_id, l.variacao_id) ELSE variacao_original_id END,
         item_id = v_item,
         variacao_id = v_var,
         preco_unitario = CASE WHEN v_troca THEN public.mat_preco_vigente(v_item, v_var, p.competencia) ELSE preco_unitario END,
         motivo_ajuste = v_motivo,
         ajustado_por = auth.uid(),
         ajustado_em = now()
   WHERE id = l.id;

  v_texto := 'Kit ajustado: ' || coalesce(v_nome_de, 'item')
    || CASE WHEN v_troca THEN ' → ' || coalesce(v_nome_para, 'item') ELSE '' END
    || ', ' || trim_scale(coalesce(l.qtd_validada, l.qtd_pedida))::text || ' → '
    || trim_scale(p_qtd)::text || '. Motivo: ' || v_motivo;
  INSERT INTO public.mat_comentarios (pedido_id, linha_tabela, linha_id, autor_id, autor_nome, texto)
  VALUES (l.pedido_id, 'mat_pedido_itens', l.id, auth.uid(), (SELECT nome FROM public.perfis WHERE id = auth.uid()), v_texto);
END $function$;

-- incluir_linha_pedido_materiais (139) + recusa depois da compra enviada

CREATE OR REPLACE FUNCTION public.incluir_linha_pedido_materiais(p_pedido uuid, p_item uuid, p_variacao uuid, p_qtd numeric, p_motivo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.mat_pedidos%ROWTYPE; c public.mat_contratos%ROWTYPE; it public.mat_itens%ROWTYPE;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_kit numeric; v_no_kit boolean; v_id uuid; v_validada numeric;
BEGIN
  IF NOT (public.pode_validar_materiais() OR public.pode_aprovar_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para incluir item no pedido';
  END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'Qual o motivo? Informe o motivo da inclusão'; END IF;
  IF p_qtd IS NULL OR p_qtd <= 0 OR p_qtd > 999 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

  SELECT * INTO p FROM public.mat_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_produtos IN ('em_compra', 'entregue', 'entregue_parcial') THEN
    RAISE EXCEPTION 'A compra deste pedido já foi enviada e o pedido não muda mais. Para um item novo, lance um pedido extra (vai para uma compra avulsa)';
  END IF;
  IF p.status_produtos NOT IN ('em_validacao', 'validado', 'aprovado') THEN
    RAISE EXCEPTION 'Não dá para incluir item neste pedido (%)', p.status_produtos;
  END IF;
  IF p.status_produtos = 'aprovado' AND NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Pedido já aprovado: só o gestor pode incluir item (o pedido volta para aprovação)';
  END IF;

  SELECT * INTO it FROM public.mat_itens WHERE id = p_item AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item inexistente ou inativo'; END IF;
  IF p_variacao IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.mat_item_variacoes WHERE id = p_variacao AND item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Opção (variação) inválida para o item';
  END IF;
  IF p_variacao IS NULL AND EXISTS (SELECT 1 FROM public.mat_item_variacoes WHERE item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Escolha a opção (variação) do item';
  END IF;

  SELECT * INTO c FROM public.mat_contratos WHERE id = p.contrato_id;
  IF FOUND AND NOT c.recebe_limpeza AND it.categoria <> 'portaria' THEN
    RAISE EXCEPTION 'Este contrato recebe apenas material de portaria';
  END IF;

  SELECT max(quantidade) INTO v_kit FROM public.mat_kit_itens
   WHERE contrato_id = p.contrato_id AND item_id = p_item
     AND (variacao_id IS NULL OR variacao_id IS NOT DISTINCT FROM p_variacao);
  v_no_kit := v_kit IS NOT NULL;
  -- Já validado pelo inspetor/gestor que incluiu: nasce validada.
  v_validada := CASE WHEN p.status_produtos IN ('validado', 'aprovado') THEN p_qtd ELSE NULL END;

  INSERT INTO public.mat_pedido_itens (
    pedido_id, item_id, variacao_id, qtd_kit, qtd_pedida, qtd_validada, preco_unitario,
    justificativa, excecao_acima_kit, excecao_fora_kit, parte, incluido_por, incluido_em)
  VALUES (
    p_pedido, p_item, p_variacao, v_kit, p_qtd, v_validada,
    public.mat_preco_vigente(p_item, p_variacao, p.competencia),
    v_motivo, v_no_kit, NOT v_no_kit, 'extra', auth.uid(), now())
  RETURNING id INTO v_id;

  IF p.status_produtos = 'aprovado' THEN
    UPDATE public.mat_pedidos SET status_produtos = 'validado' WHERE id = p_pedido;
  END IF;

  INSERT INTO public.mat_comentarios (pedido_id, linha_tabela, linha_id, autor_id, autor_nome, texto)
  VALUES (p_pedido, 'mat_pedido_itens', v_id, auth.uid(), (SELECT nome FROM public.perfis WHERE id = auth.uid()),
    'Item incluído pelo escritório: ' || it.nome || ', ' || trim_scale(p_qtd)::text || '. Motivo: ' || v_motivo
    || CASE WHEN p.status_produtos = 'aprovado' THEN ' (pedido voltou para aprovação do gestor)' ELSE '' END);
  RETURN v_id;
END $function$;

-- ligar_linha_catalogo_materiais (139) + recusa linha com destino

CREATE OR REPLACE FUNCTION public.ligar_linha_catalogo_materiais(p_linha uuid, p_item uuid, p_variacao uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l public.mat_pedido_itens%ROWTYPE; p public.mat_pedidos%ROWTYPE; it public.mat_itens%ROWTYPE;
  c public.mat_contratos%ROWTYPE;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF NOT (public.pode_validar_materiais() OR public.pode_aprovar_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para ligar a linha ao catálogo';
  END IF;
  SELECT * INTO l FROM public.mat_pedido_itens WHERE id = p_linha FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha não encontrada'; END IF;
  IF l.atendimento IS NOT NULL THEN
    RAISE EXCEPTION 'Esta linha já tem destino na compra e não pode mais ser ligada';
  END IF;
  IF l.item_id IS NOT NULL OR l.descricao_livre IS NULL THEN
    RAISE EXCEPTION 'Só linha de texto livre (sem item do catálogo) pode ser ligada';
  END IF;
  SELECT * INTO p FROM public.mat_pedidos WHERE id = l.pedido_id FOR UPDATE;
  IF p.status_produtos NOT IN ('em_validacao', 'validado', 'aprovado') THEN
    RAISE EXCEPTION 'Não dá para ligar linhas neste pedido (%)', p.status_produtos;
  END IF;
  IF p.status_produtos = 'aprovado' AND NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Pedido já aprovado: só o gestor pode ligar a linha ao catálogo';
  END IF;
  SELECT * INTO it FROM public.mat_itens WHERE id = p_item AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item inexistente ou inativo'; END IF;
  IF p_variacao IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.mat_item_variacoes WHERE id = p_variacao AND item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Opção (variação) inválida para o item';
  END IF;
  IF p_variacao IS NULL AND EXISTS (SELECT 1 FROM public.mat_item_variacoes WHERE item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Escolha a opção (variação) do item';
  END IF;
  SELECT * INTO c FROM public.mat_contratos WHERE id = p.contrato_id;
  IF FOUND AND NOT c.recebe_limpeza AND it.categoria <> 'portaria' THEN
    RAISE EXCEPTION 'Este contrato recebe apenas material de portaria';
  END IF;

  UPDATE public.mat_pedido_itens
     SET item_id = p_item,
         variacao_id = p_variacao,
         preco_unitario = public.mat_preco_vigente(p_item, p_variacao, p.competencia),
         ligado_por = auth.uid(),
         ligado_em = now()
   WHERE id = l.id;

  INSERT INTO public.mat_comentarios (pedido_id, linha_tabela, linha_id, autor_id, autor_nome, texto)
  VALUES (l.pedido_id, 'mat_pedido_itens', l.id, auth.uid(), (SELECT nome FROM public.perfis WHERE id = auth.uid()),
    'Ligado ao catálogo: “' || l.descricao_livre || '” → ' || it.nome
    || CASE WHEN v_motivo IS NOT NULL THEN '. Motivo: ' || v_motivo ELSE '' END);
END $function$;

-- validar_pedido_materiais (135) + recusa linha com destino

CREATE OR REPLACE FUNCTION public.validar_pedido_materiais(p_pedido uuid, p_itens jsonb DEFAULT '[]'::jsonb, p_comentario text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.mat_pedidos%ROWTYPE; e jsonb; l public.mat_pedido_itens%ROWTYPE;
  v_qtd numeric; v_motivo text; v_dec text;
BEGIN
  IF NOT public.pode_validar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para validar pedidos';
  END IF;
  SELECT * INTO p FROM public.mat_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_produtos <> 'em_validacao' THEN
    RAISE EXCEPTION 'Pedido não está em validação (%)', p.status_produtos;
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) LOOP
    SELECT * INTO l FROM public.mat_pedido_itens WHERE id = (e->>'id')::uuid AND pedido_id = p_pedido;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não pertence ao pedido', e->>'id'; END IF;
    -- Kit aprovado automaticamente: só muda por ajustar_linha_kit_materiais.
    IF l.aprovado_automatico THEN CONTINUE; END IF;
    IF l.atendimento IS NOT NULL THEN
      RAISE EXCEPTION 'A linha % já tem destino na compra e não pode mais mudar', l.id;
    END IF;
    v_dec := nullif(e->>'decisao_repeticao', '');
    v_motivo := nullif(btrim(coalesce(e->>'motivo', '')), '');
    v_qtd := coalesce(nullif(e->>'qtd_validada', '')::numeric, l.qtd_pedida);
    IF v_dec = 'descartar' THEN
      v_qtd := 0;
      v_motivo := coalesce(v_motivo, 'repetição');
    END IF;
    IF v_qtd < l.qtd_pedida AND v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo do corte da linha %', l.id;
    END IF;
    UPDATE public.mat_pedido_itens
       SET qtd_validada = v_qtd, decisao_repeticao = v_dec,
           motivo_ajuste = coalesce(v_motivo, motivo_ajuste),
           ajustado_por = auth.uid(), ajustado_em = now()
     WHERE id = l.id;
  END LOOP;

  UPDATE public.mat_pedido_itens SET qtd_validada = qtd_pedida
   WHERE pedido_id = p_pedido AND qtd_validada IS NULL;
  UPDATE public.mat_pedidos SET status_produtos = 'validado' WHERE id = p_pedido;

  IF btrim(coalesce(p_comentario, '')) <> '' THEN
    INSERT INTO public.mat_comentarios (pedido_id, autor_id, autor_nome, texto)
    VALUES (p_pedido, auth.uid(), (SELECT nome FROM public.perfis WHERE id = auth.uid()), p_comentario);
  END IF;
END $function$;

-- aprovar_pedido_materiais (135) + recusa linha com destino

CREATE OR REPLACE FUNCTION public.aprovar_pedido_materiais(p_pedido uuid, p_itens jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.mat_pedidos%ROWTYPE; e jsonb; l public.mat_pedido_itens%ROWTYPE;
        v_qtd numeric; v_motivo text;
BEGIN
  IF NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para aprovar pedidos';
  END IF;
  SELECT * INTO p FROM public.mat_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_produtos <> 'validado' THEN
    RAISE EXCEPTION 'Só pedido validado pode ser aprovado (%)', p.status_produtos;
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) LOOP
    SELECT * INTO l FROM public.mat_pedido_itens WHERE id = (e->>'id')::uuid AND pedido_id = p_pedido;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não pertence ao pedido', e->>'id'; END IF;
    -- Kit aprovado automaticamente: só muda por ajustar_linha_kit_materiais.
    IF l.aprovado_automatico THEN CONTINUE; END IF;
    IF l.atendimento IS NOT NULL THEN
      RAISE EXCEPTION 'A linha % já tem destino na compra e não pode mais mudar', l.id;
    END IF;
    v_qtd := nullif(e->>'qtd_aprovada', '')::numeric;
    v_motivo := nullif(btrim(coalesce(e->>'motivo_ajuste', '')), '');
    IF v_qtd IS NOT NULL THEN
      IF v_qtd < l.qtd_pedida AND v_motivo IS NULL AND btrim(coalesce(l.motivo_ajuste, '')) = '' THEN
        RAISE EXCEPTION 'Informe o motivo do ajuste da linha %', l.id;
      END IF;
      UPDATE public.mat_pedido_itens
         SET qtd_aprovada = v_qtd, motivo_ajuste = coalesce(v_motivo, motivo_ajuste),
             ajustado_por = auth.uid(), ajustado_em = now()
       WHERE id = l.id;
    END IF;
  END LOOP;

  UPDATE public.mat_pedido_itens SET qtd_aprovada = coalesce(qtd_validada, qtd_pedida)
   WHERE pedido_id = p_pedido AND qtd_aprovada IS NULL;
  UPDATE public.mat_pedidos SET status_produtos = 'aprovado' WHERE id = p_pedido;
  -- Fase 2: se todas as linhas aprovadas já têm destino, segue a entrega.
  PERFORM public.mat_recalcular_status_entrega(p_pedido);
END $function$;

-- preencher_pedido_pelo_kit (135) + periodicidade com os estados da Fase 2

CREATE OR REPLACE FUNCTION public.preencher_pedido_pelo_kit(p_contrato uuid, p_competencia date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comp date := date_trunc('month', p_competencia)::date;
  v_zero constant uuid := '00000000-0000-0000-0000-000000000000';
  v_ped uuid; v_env uuid; v_seq smallint; k record; v_existente public.mat_pedidos%ROWTYPE;
  v_nome text := (SELECT nome FROM public.perfis WHERE id = auth.uid());
  v_auto boolean := public.mat_kit_aprovacao_automatica();
  v_status text;
BEGIN
  IF NOT public.pode_validar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para preencher pedidos pelo kit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mat_contratos WHERE id = p_contrato AND ativo) THEN
    RAISE EXCEPTION 'Contrato inexistente ou inativo';
  END IF;
  -- Configuração ligada: o kit já sai aprovado; desligada: segue ao gestor.
  v_status := CASE WHEN v_auto THEN 'aprovado' ELSE 'validado' END;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contrato::text || v_comp::text, 0));

  SELECT * INTO v_existente FROM public.mat_pedidos
   WHERE contrato_id = p_contrato AND competencia = v_comp
     AND tipo = 'mensal' AND status_produtos <> 'cancelado'
   FOR UPDATE;

  IF FOUND THEN
    -- O líder enviou só uniforme/EPI/crachá: aproveita o pedido do mês.
    IF v_existente.status_produtos <> 'nao_se_aplica'
       OR EXISTS (SELECT 1 FROM public.mat_pedido_itens WHERE pedido_id = v_existente.id) THEN
      RAISE EXCEPTION 'Já existe pedido mensal de produtos deste contrato na competência';
    END IF;
    v_ped := v_existente.id;
    SELECT coalesce(max(sequencia), 0) + 1 INTO v_seq FROM public.mat_pedido_envios WHERE pedido_id = v_ped;
    INSERT INTO public.mat_pedido_envios (pedido_id, sequencia, origem, seu_nome)
    VALUES (v_ped, v_seq, 'complemento', coalesce(v_nome, 'Escritório'))
    RETURNING id INTO v_env;
    UPDATE public.mat_pedidos
       SET preenchido_pelo_escritorio = true, status_produtos = v_status
     WHERE id = v_ped;
  ELSE
    INSERT INTO public.mat_pedidos (contrato_id, competencia, tipo, origem, preenchido_pelo_escritorio,
      responsavel_nome, status_produtos, status_ceu, enviado_em, criado_por)
    VALUES (p_contrato, v_comp, 'mensal', 'escritorio', true, v_nome,
      v_status, 'nao_se_aplica', now(), auth.uid())
    RETURNING id INTO v_ped;
    INSERT INTO public.mat_pedido_envios (pedido_id, sequencia, origem, seu_nome)
    VALUES (v_ped, 1, 'original', coalesce(v_nome, 'Escritório'))
    RETURNING id INTO v_env;
  END IF;

  FOR k IN SELECT * FROM public.mat_kit_itens WHERE contrato_id = p_contrato AND quantidade > 0 LOOP
    IF k.periodicidade_meses > 1 AND (
         EXISTS (SELECT 1 FROM public.mat_historico_consumo h
                  WHERE h.contrato_id = p_contrato AND h.item_id = k.item_id
                    AND coalesce(h.variacao_id, v_zero) = coalesce(k.variacao_id, v_zero)
                    AND h.quantidade > 0
                    AND h.competencia >= (v_comp - make_interval(months => k.periodicidade_meses - 1))::date
                    AND h.competencia < v_comp)
      OR EXISTS (SELECT 1 FROM public.mat_pedido_itens i JOIN public.mat_pedidos pp ON pp.id = i.pedido_id
                  WHERE pp.contrato_id = p_contrato AND pp.status_produtos IN ('aprovado', 'em_compra', 'entregue', 'entregue_parcial')
                    AND i.item_id = k.item_id
                    AND coalesce(i.variacao_id, v_zero) = coalesce(k.variacao_id, v_zero)
                    AND coalesce(i.qtd_aprovada, 0) > 0
                    AND pp.competencia >= (v_comp - make_interval(months => k.periodicidade_meses - 1))::date
                    AND pp.competencia < v_comp)
    ) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.mat_pedido_itens (pedido_id, envio_id, item_id, variacao_id, qtd_kit, qtd_pedida,
      qtd_validada, qtd_aprovada, preco_unitario, parte, aprovado_automatico)
    VALUES (v_ped, v_env, k.item_id, k.variacao_id, k.quantidade, k.quantidade, k.quantidade,
      CASE WHEN v_auto THEN k.quantidade END,
      public.mat_preco_vigente(k.item_id, k.variacao_id, v_comp), 'kit', v_auto);
  END LOOP;
  RETURN v_ped;
END $function$;

-- mat_salvar_config (135) + dias do calendário da compra (Fase 2)

CREATE OR REPLACE FUNCTION public.mat_salvar_config(p_config jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v text; atual jsonb := '{}'::jsonb; novo jsonb := '{}'::jsonb; k text;
BEGIN
  IF NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para alterar a configuração de materiais';
  END IF;
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Configuração inválida';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_config) LOOP
    IF k NOT IN ('kit_aprovacao_automatica', 'dia_aviso', 'dia_limite',
                 'dia_limite_validacao', 'dia_limite_aprovacao', 'dia_inicio_compra', 'dia_fim_compra') THEN
      RAISE EXCEPTION 'Chave de configuração desconhecida: %', k;
    END IF;
  END LOOP;
  IF p_config ? 'kit_aprovacao_automatica' AND jsonb_typeof(p_config -> 'kit_aprovacao_automatica') <> 'boolean' THEN
    RAISE EXCEPTION 'kit_aprovacao_automatica deve ser verdadeiro ou falso';
  END IF;
  IF p_config ? 'dia_aviso' AND NOT (jsonb_typeof(p_config -> 'dia_aviso') = 'number'
       AND (p_config ->> 'dia_aviso')::numeric BETWEEN 1 AND 28) THEN
    RAISE EXCEPTION 'dia_aviso deve ser de 1 a 28';
  END IF;
  IF p_config ? 'dia_limite' AND NOT (jsonb_typeof(p_config -> 'dia_limite') = 'number'
       AND (p_config ->> 'dia_limite')::numeric BETWEEN 1 AND 28) THEN
    RAISE EXCEPTION 'dia_limite deve ser de 1 a 28';
  END IF;

  FOREACH k IN ARRAY ARRAY['dia_limite_validacao', 'dia_limite_aprovacao', 'dia_inicio_compra', 'dia_fim_compra'] LOOP
    IF p_config ? k AND NOT (jsonb_typeof(p_config -> k) = 'number'
         AND (p_config ->> k)::numeric BETWEEN 1 AND 28) THEN
      RAISE EXCEPTION '% deve ser de 1 a 28', k;
    END IF;
  END LOOP;

  SELECT valor INTO v FROM public.configuracoes WHERE chave = 'materiais_config' FOR UPDATE;
  IF v IS NOT NULL THEN
    BEGIN
      atual := v::jsonb;
    EXCEPTION WHEN others THEN
      atual := '{}'::jsonb;
    END;
    IF jsonb_typeof(atual) <> 'object' THEN atual := '{}'::jsonb; END IF;
  END IF;
  novo := atual || p_config;

  UPDATE public.configuracoes SET valor = novo::text, updated_at = now() WHERE chave = 'materiais_config';
  IF NOT FOUND THEN
    INSERT INTO public.configuracoes (chave, valor, descricao)
    VALUES ('materiais_config', novo::text, 'Módulo Materiais: prazo, aviso e aprovação automática do kit (migration 135)');
  END IF;
  RETURN novo;
END $function$;

-- reset_permissoes_perfil (129) + menu/rota.materiais_compras

CREATE OR REPLACE FUNCTION public.reset_permissoes_perfil(p_perfil text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Apenas administradores podem executar esta função
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar permissões';
  END IF;

  IF p_perfil IS NULL OR p_perfil = '' THEN
    RAISE EXCEPTION 'Perfil não informado';
  END IF;

  -- Remove as permissões atuais do perfil
  DELETE FROM public.permissoes_perfil
  WHERE perfil = p_perfil;

  -- ============================================================
  -- ADM / ADMIN: acesso total
  -- ============================================================
  IF p_perfil IN ('adm', 'admin') THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('adm', 'todos', 'todos', true),
      ('admin', 'todos', 'todos', true),
      ('adm', 'menu', 'todos', true),
      ('admin', 'menu', 'todos', true),
      ('adm', 'rota', 'todos', true),
      ('admin', 'rota', 'todos', true);
    RETURN;
  END IF;

  -- ============================================================
  -- VISUALIZADOR
  -- ============================================================
  IF p_perfil = 'visualizador' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('visualizador', 'dashboard', 'ver', true),
      ('visualizador', 'colaboradores', 'ver', true),
      ('visualizador', 'empresas', 'ver', true),
      ('visualizador', 'departamentos', 'ver', true),
      ('visualizador', 'extras', 'ver_balanco', true),
      ('visualizador', 'menu', 'dashboard', true),
      ('visualizador', 'menu', 'colaboradores', true),
      ('visualizador', 'menu', 'empresas', true),
      ('visualizador', 'menu', 'departamentos', true),
      ('visualizador', 'menu', 'relatorios', true),
      ('visualizador', 'menu', 'ferias', true),
      ('visualizador', 'rota', 'empresas', true),
      ('visualizador', 'rota', 'departamentos', true),
      ('visualizador', 'rota', 'colaboradores', true),
      ('visualizador', 'rota', 'relatorios', true),
      ('visualizador', 'rota', 'ferias', true),
      ('visualizador', 'rota', 'mobile_falta', true),
      ('visualizador', 'menu', 'escalas', true),
      ('visualizador', 'rota', 'escalas', true),
      ('visualizador', 'escala', 'visualizar', true),
      ('visualizador', 'menu', 'bi', false),
      ('visualizador', 'rota', 'bi', false),
      ('visualizador', 'ocorrencia', 'validar', false),
      ('visualizador', 'menu', 'materiais', false),
      ('visualizador', 'rota', 'materiais', false),
      ('visualizador', 'menu', 'materiais_fornecedores', false),
      ('visualizador', 'rota', 'materiais_fornecedores', false),
      ('visualizador', 'menu', 'materiais_kit', false),
      ('visualizador', 'rota', 'materiais_kit', false),
      ('visualizador', 'menu', 'materiais_compras', false),
      ('visualizador', 'rota', 'materiais_compras', false),
      ('visualizador', 'materiais', 'editar_kit_uniforme', false);
    RETURN;
  END IF;

  -- ============================================================
  -- GESTOR
  -- ============================================================
  IF p_perfil = 'gestor' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('gestor', 'empresa', 'editar', true),
      ('gestor', 'departamento', 'editar', true),
      ('gestor', 'departamento', 'excluir', true),
      ('gestor', 'departamento', 'importar', true),
      ('gestor', 'colaborador', 'editar_basico', true),
      ('gestor', 'colaborador', 'editar_completo', true),
      ('gestor', 'colaborador', 'exportar', true),
      ('gestor', 'ocorrencia', 'criar', true),
      ('gestor', 'ocorrencia', 'editar', true),
      ('gestor', 'ocorrencia', 'cancelar', true),
      ('gestor', 'ocorrencia', 'ver_detalhes', true),
      ('gestor', 'ocorrencia', 'aprovar', true),
      ('gestor', 'ocorrencia', 'anexar', true),
      ('gestor', 'ocorrencia', 'adicionar_testemunha', true),
      ('gestor', 'ocorrencia', 'gerar_pdf', true),
      ('gestor', 'adicionais', 'editar_contrato', true),
      ('gestor', 'adicionais', 'ver_relatorio', false),
      ('gestor', 'auditoria', 'ver', true),
      ('gestor', 'configuracoes', 'ver', true),
      ('gestor', 'menu', 'dashboard', true),
      ('gestor', 'menu', 'colaboradores', true),
      ('gestor', 'menu', 'empresas', true),
      ('gestor', 'menu', 'departamentos', true),
      ('gestor', 'menu', 'rh', true),
      ('gestor', 'menu', 'ceu', true),
      ('gestor', 'menu', 'adicionais', true),
      ('gestor', 'menu', 'configuracoes', true),
      ('gestor', 'menu', 'auditoria', true),
      ('gestor', 'menu', 'relatorios', true),
      ('gestor', 'menu', 'ferias', true),
      ('gestor', 'rota', 'empresas', true),
      ('gestor', 'rota', 'departamentos', true),
      ('gestor', 'rota', 'colaboradores', true),
      ('gestor', 'rota', 'ocorrencias', true),
      ('gestor', 'rota', 'ceu', true),
      ('gestor', 'rota', 'adicionais', true),
      ('gestor', 'rota', 'configuracoes', true),
      ('gestor', 'rota', 'auditoria', true),
      ('gestor', 'rota', 'relatorios', true),
      ('gestor', 'rota', 'ferias', true),
      ('gestor', 'rota', 'mobile_falta', true),
      ('gestor', 'menu', 'escalas', true),
      ('gestor', 'rota', 'escalas', true),
      ('gestor', 'escala', 'visualizar', true),
      ('gestor', 'escala', 'editar_local', true),
      ('gestor', 'escala', 'mapear_flit', true),
      ('gestor', 'escala', 'importar', true),
      ('gestor', 'escala', 'confirmar_manual', true),
      ('gestor', 'escala', 'editar_dia', true),
      ('gestor', 'menu', 'bi', true),
      ('gestor', 'rota', 'bi', true),
      ('gestor', 'ocorrencia', 'validar', false),
      ('gestor', 'materiais', 'editar_catalogo', true),
      ('gestor', 'materiais', 'gerenciar_fornecedores', true),
      ('gestor', 'materiais', 'editar_kit', true),
      ('gestor', 'materiais', 'editar_rota', true),
      ('gestor', 'materiais', 'alterar_rota_pedido', true),
      ('gestor', 'materiais', 'decidir_alteracao_kit', true),
      ('gestor', 'materiais', 'gerenciar_links', true),
      ('gestor', 'materiais', 'ver_sem_pedido', true),
      ('gestor', 'materiais', 'preencher_pelo_kit', true),
      ('gestor', 'materiais', 'validar', true),
      ('gestor', 'materiais', 'aprovar', true),
      ('gestor', 'materiais', 'reabrir_pedido', true),
      ('gestor', 'ceu', 'conferir_pedido', true),
      ('gestor', 'ceu', 'atender_pedido', true),
      ('gestor', 'menu', 'materiais', true),
      ('gestor', 'rota', 'materiais', true),
      ('gestor', 'menu', 'materiais_fornecedores', true),
      ('gestor', 'rota', 'materiais_fornecedores', true),
      ('gestor', 'menu', 'materiais_kit', true),
      ('gestor', 'rota', 'materiais_kit', true),
      ('gestor', 'menu', 'materiais_compras', true),
      ('gestor', 'rota', 'materiais_compras', true),
      ('gestor', 'materiais', 'editar_kit_uniforme', true);
    RETURN;
  END IF;

  -- ============================================================
  -- RH
  -- ============================================================
  IF p_perfil = 'rh' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('rh', 'colaborador', 'editar_basico', true),
      ('rh', 'colaborador', 'editar_completo', true),
      ('rh', 'colaborador', 'cadastrar', true),
      ('rh', 'colaborador', 'exportar', true),
      ('rh', 'departamento', 'importar', true),
      ('rh', 'ocorrencia', 'criar', true),
      ('rh', 'ocorrencia', 'editar', true),
      ('rh', 'ocorrencia', 'cancelar', true),
      ('rh', 'ocorrencia', 'ver_detalhes', true),
      ('rh', 'ocorrencia', 'aprovar', true),
      ('rh', 'ocorrencia', 'anexar', true),
      ('rh', 'ocorrencia', 'adicionar_testemunha', true),
      ('rh', 'ocorrencia', 'gerar_pdf', true),
      ('rh', 'ocorrencia', 'gerenciar_modelos', true),
      ('rh', 'menu', 'dashboard', true),
      ('rh', 'menu', 'colaboradores', true),
      ('rh', 'menu', 'empresas', true),
      ('rh', 'menu', 'departamentos', true),
      ('rh', 'menu', 'rh', true),
      ('rh', 'menu', 'relatorios', true),
      ('rh', 'menu', 'ferias', true),
      ('rh', 'rota', 'empresas', true),
      ('rh', 'rota', 'departamentos', true),
      ('rh', 'rota', 'colaboradores', true),
      ('rh', 'rota', 'ocorrencias', true),
      ('rh', 'rota', 'relatorios', true),
      ('rh', 'rota', 'ferias', true),
      ('rh', 'rota', 'mobile_falta', true),
      ('rh', 'menu', 'escalas', true),
      ('rh', 'rota', 'escalas', true),
      ('rh', 'escala', 'visualizar', true),
      ('rh', 'escala', 'editar_local', true),
      ('rh', 'escala', 'mapear_flit', true),
      ('rh', 'escala', 'importar', true),
      ('rh', 'escala', 'confirmar_manual', true),
      ('rh', 'escala', 'editar_dia', true),
      ('rh', 'menu', 'bi', false),
      ('rh', 'rota', 'bi', false),
      ('rh', 'ocorrencia', 'validar', false),
      ('rh', 'menu', 'materiais', false),
      ('rh', 'rota', 'materiais', false),
      ('rh', 'menu', 'materiais_fornecedores', false),
      ('rh', 'rota', 'materiais_fornecedores', false),
      ('rh', 'menu', 'materiais_kit', false),
      ('rh', 'rota', 'materiais_kit', false),
      ('rh', 'menu', 'materiais_compras', false),
      ('rh', 'rota', 'materiais_compras', false),
      ('rh', 'materiais', 'editar_kit_uniforme', false);
    RETURN;
  END IF;

  -- ============================================================
  -- DP1
  -- ============================================================
  IF p_perfil = 'dp1' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('dp1', 'empresa', 'editar', true),
      ('dp1', 'departamento', 'editar', true),
      ('dp1', 'colaborador', 'editar_basico', true),
      ('dp1', 'colaborador', 'editar_completo', true),
      ('dp1', 'colaborador', 'cadastrar', true),
      ('dp1', 'colaborador', 'excluir', true),
      ('dp1', 'colaborador', 'importar', true),
      ('dp1', 'colaborador', 'exportar', true),
      ('dp1', 'departamento', 'importar', true),
      ('dp1', 'econtador', 'gerenciar', true),
      ('dp1', 'ocorrencia', 'criar', true),
      ('dp1', 'ocorrencia', 'editar', true),
      ('dp1', 'ocorrencia', 'cancelar', true),
      ('dp1', 'ocorrencia', 'ver_detalhes', true),
      ('dp1', 'ocorrencia', 'aprovar', true),
      ('dp1', 'ocorrencia', 'anexar', true),
      ('dp1', 'ocorrencia', 'adicionar_testemunha', true),
      ('dp1', 'ocorrencia', 'gerar_pdf', true),
      ('dp1', 'ocorrencia', 'gerenciar_modelos', true),
      ('dp1', 'alertas', 'gerenciar', true),
      ('dp1', 'vr', 'visualizar', true),
      ('dp1', 'extras', 'gerenciar_recibo', true),
      ('dp1', 'adicionais', 'ver_relatorio', true),
      ('dp1', 'menu', 'dashboard', true),
      ('dp1', 'menu', 'colaboradores', true),
      ('dp1', 'menu', 'empresas', true),
      ('dp1', 'menu', 'departamentos', true),
      ('dp1', 'menu', 'rh', true),
      ('dp1', 'menu', 'extras', true),
      ('dp1', 'menu', 'vr', true),
      ('dp1', 'menu', 'ceu', true),
      ('dp1', 'menu', 'adicionais', true),
      ('dp1', 'menu', 'alertas', true),
      ('dp1', 'menu', 'relatorios', true),
      ('dp1', 'menu', 'ferias', true),
      ('dp1', 'rota', 'empresas', true),
      ('dp1', 'rota', 'departamentos', true),
      ('dp1', 'rota', 'colaboradores', true),
      ('dp1', 'rota', 'ocorrencias', true),
      ('dp1', 'rota', 'extras', true),
      ('dp1', 'rota', 'vr', true),
      ('dp1', 'rota', 'ceu', true),
      ('dp1', 'rota', 'adicionais', true),
      ('dp1', 'rota', 'importar_econtador', true),
      ('dp1', 'rota', 'alertas', true),
      ('dp1', 'rota', 'relatorios', true),
      ('dp1', 'rota', 'ferias', true),
      ('dp1', 'rota', 'mobile_falta', true),
      ('dp1', 'menu', 'escalas', true),
      ('dp1', 'rota', 'escalas', true),
      ('dp1', 'escala', 'visualizar', true),
      ('dp1', 'escala', 'editar_local', true),
      ('dp1', 'escala', 'mapear_flit', true),
      ('dp1', 'escala', 'importar', true),
      ('dp1', 'escala', 'confirmar_manual', true),
      ('dp1', 'escala', 'editar_dia', true),
      ('dp1', 'menu', 'bi', false),
      ('dp1', 'rota', 'bi', false),
      ('dp1', 'ocorrencia', 'validar', true),
      ('dp1', 'menu', 'materiais', false),
      ('dp1', 'rota', 'materiais', false),
      ('dp1', 'menu', 'materiais_fornecedores', false),
      ('dp1', 'rota', 'materiais_fornecedores', false),
      ('dp1', 'menu', 'materiais_kit', false),
      ('dp1', 'rota', 'materiais_kit', false),
      ('dp1', 'menu', 'materiais_compras', false),
      ('dp1', 'rota', 'materiais_compras', false),
      ('dp1', 'materiais', 'editar_kit_uniforme', false);
    RETURN;
  END IF;

  -- ============================================================
  -- DP2
  -- ============================================================
  IF p_perfil = 'dp2' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('dp2', 'empresa', 'editar', true),
      ('dp2', 'departamento', 'editar', true),
      ('dp2', 'colaborador', 'editar_basico', true),
      ('dp2', 'colaborador', 'editar_completo', true),
      ('dp2', 'colaborador', 'cadastrar', true),
      ('dp2', 'colaborador', 'excluir', true),
      ('dp2', 'colaborador', 'importar', true),
      ('dp2', 'colaborador', 'exportar', true),
      ('dp2', 'departamento', 'importar', true),
      ('dp2', 'econtador', 'gerenciar', true),
      ('dp2', 'configuracoes', 'configurar_token', true),
      ('dp2', 'ocorrencia', 'criar', true),
      ('dp2', 'ocorrencia', 'editar', true),
      ('dp2', 'ocorrencia', 'ver_detalhes', true),
      ('dp2', 'ocorrencia', 'aprovar', true),
      ('dp2', 'ocorrencia', 'anexar', true),
      ('dp2', 'ocorrencia', 'adicionar_testemunha', true),
      ('dp2', 'ocorrencia', 'gerar_pdf', true),
      ('dp2', 'ocorrencia', 'gerenciar_modelos', true),
      ('dp2', 'vr', 'visualizar', true),
      ('dp2', 'vr', 'gerenciar', true),
      ('dp2', 'adicionais', 'editar_contrato', true),
      ('dp2', 'adicionais', 'editar_vinculo', true),
      ('dp2', 'adicionais', 'editar_calendario', true),
      ('dp2', 'adicionais', 'ver_relatorio', true),
      ('dp2', 'extras', 'gerenciar_recibo', true),
      ('dp2', 'menu', 'dashboard', true),
      ('dp2', 'menu', 'colaboradores', true),
      ('dp2', 'menu', 'empresas', true),
      ('dp2', 'menu', 'departamentos', true),
      ('dp2', 'menu', 'rh', true),
      ('dp2', 'menu', 'extras', true),
      ('dp2', 'menu', 'vr', true),
      ('dp2', 'menu', 'ceu', true),
      ('dp2', 'menu', 'adicionais', true),
      ('dp2', 'menu', 'configuracoes', true),
      ('dp2', 'menu', 'relatorios', true),
      ('dp2', 'menu', 'ferias', true),
      ('dp2', 'rota', 'empresas', true),
      ('dp2', 'rota', 'departamentos', true),
      ('dp2', 'rota', 'colaboradores', true),
      ('dp2', 'rota', 'ocorrencias', true),
      ('dp2', 'rota', 'extras', true),
      ('dp2', 'rota', 'vr', true),
      ('dp2', 'rota', 'ceu', true),
      ('dp2', 'rota', 'adicionais', true),
      ('dp2', 'rota', 'importar_econtador', true),
      ('dp2', 'rota', 'configuracoes', true),
      ('dp2', 'rota', 'relatorios', true),
      ('dp2', 'rota', 'ferias', true),
      ('dp2', 'rota', 'mobile_falta', true),
      ('dp2', 'menu', 'escalas', true),
      ('dp2', 'rota', 'escalas', true),
      ('dp2', 'escala', 'visualizar', true),
      ('dp2', 'escala', 'editar_local', true),
      ('dp2', 'escala', 'mapear_flit', true),
      ('dp2', 'escala', 'importar', true),
      ('dp2', 'escala', 'confirmar_manual', true),
      ('dp2', 'escala', 'editar_dia', true),
      ('dp2', 'menu', 'bi', false),
      ('dp2', 'rota', 'bi', false),
      ('dp2', 'ocorrencia', 'validar', true),
      ('dp2', 'ceu', 'emitir_cracha', true),
      ('dp2', 'ceu', 'atender_pedido', true),
      ('dp2', 'menu', 'materiais', false),
      ('dp2', 'rota', 'materiais', false),
      ('dp2', 'materiais', 'gerenciar_fornecedores', true),
      ('dp2', 'menu', 'materiais_fornecedores', true),
      ('dp2', 'rota', 'materiais_fornecedores', true),
      ('dp2', 'menu', 'materiais_kit', true),
      ('dp2', 'rota', 'materiais_kit', true),
      ('dp2', 'menu', 'materiais_compras', false),
      ('dp2', 'rota', 'materiais_compras', false),
      ('dp2', 'materiais', 'editar_kit_uniforme', true);
    RETURN;
  END IF;

  -- ============================================================
  -- MESA
  -- ============================================================
  IF p_perfil = 'mesa' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('mesa', 'colaborador', 'editar_basico', true),
      ('mesa', 'colaborador', 'exportar', true),
      ('mesa', 'departamento', 'editar', true),
      ('mesa', 'departamento', 'importar', true),
      ('mesa', 'ocorrencia', 'criar', true),
      ('mesa', 'ocorrencia', 'editar', true),
      ('mesa', 'ocorrencia', 'cancelar', true),
      ('mesa', 'ocorrencia', 'ver_detalhes', true),
      ('mesa', 'ocorrencia', 'anexar', true),
      ('mesa', 'ocorrencia', 'adicionar_testemunha', true),
      ('mesa', 'ocorrencia', 'gerar_pdf', true),
      ('mesa', 'extras', 'editar', true),
      ('mesa', 'extras', 'editar_categoria', true),
      ('mesa', 'extras', 'excluir_categoria', true),
      ('mesa', 'extras', 'gerenciar_recibo', true),
      ('mesa', 'extras', 'ver_relatorio', true),
      ('mesa', 'adicionais', 'editar_contrato', true),
      ('mesa', 'adicionais', 'editar_vinculo', true),
      ('mesa', 'adicionais', 'editar_calendario', true),
      ('mesa', 'extras', 'enviar_comunicacao', true),
      ('mesa', 'extras', 'ver_balanco', true),
      ('mesa', 'menu', 'dashboard', true),
      ('mesa', 'menu', 'colaboradores', true),
      ('mesa', 'menu', 'empresas', true),
      ('mesa', 'menu', 'departamentos', true),
      ('mesa', 'menu', 'rh', true),
      ('mesa', 'menu', 'extras', true),
      ('mesa', 'menu', 'ceu', true),
      ('mesa', 'menu', 'adicionais', true),
      ('mesa', 'menu', 'relatorios', true),
      ('mesa', 'menu', 'ferias', true),
      ('mesa', 'rota', 'empresas', true),
      ('mesa', 'rota', 'departamentos', true),
      ('mesa', 'rota', 'colaboradores', true),
      ('mesa', 'rota', 'ocorrencias', true),
      ('mesa', 'rota', 'extras', true),
      ('mesa', 'rota', 'ceu', true),
      ('mesa', 'rota', 'adicionais', true),
      ('mesa', 'rota', 'relatorios', true),
      ('mesa', 'rota', 'ferias', true),
      ('mesa', 'rota', 'mobile_falta', true),
      ('mesa', 'menu', 'escalas', true),
      ('mesa', 'rota', 'escalas', true),
      ('mesa', 'escala', 'visualizar', true),
      ('mesa', 'escala', 'confirmar_manual', true),
      ('mesa', 'escala', 'editar_dia', true),
      ('mesa', 'menu', 'bi', true),
      ('mesa', 'rota', 'bi', true),
      ('mesa', 'ocorrencia', 'validar', false),
      ('mesa', 'ceu', 'emitir_cracha', true),
      ('mesa', 'materiais', 'editar_rota', true),
      ('mesa', 'materiais', 'gerenciar_fornecedores', true),
      ('mesa', 'materiais', 'alterar_rota_pedido', true),
      ('mesa', 'materiais', 'solicitar_alteracao_kit', true),
      ('mesa', 'materiais', 'ver_sem_pedido', true),
      ('mesa', 'materiais', 'pedido_extra', true),
      ('mesa', 'materiais', 'reabrir_pedido', true),
      ('mesa', 'menu', 'materiais', true),
      ('mesa', 'rota', 'materiais', true),
      ('mesa', 'menu', 'materiais_fornecedores', true),
      ('mesa', 'rota', 'materiais_fornecedores', true),
      ('mesa', 'menu', 'materiais_kit', true),
      ('mesa', 'rota', 'materiais_kit', true),
      ('mesa', 'menu', 'materiais_compras', true),
      ('mesa', 'rota', 'materiais_compras', true),
      ('mesa', 'materiais', 'editar_kit_uniforme', false);
    RETURN;
  END IF;

  -- ============================================================
  -- INSPETORIA
  -- ============================================================
  IF p_perfil = 'inspetoria' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('inspetoria', 'ocorrencia', 'ver_detalhes', true),
      ('inspetoria', 'ocorrencia', 'anexar', true),
      ('inspetoria', 'ocorrencia', 'adicionar_testemunha', true),
      ('inspetoria', 'ocorrencia', 'gerar_pdf', true),
      ('inspetoria', 'extras', 'editar', true),
      ('inspetoria', 'extras', 'editar_categoria', true),
      ('inspetoria', 'extras', 'enviar_comunicacao', true),
      ('inspetoria', 'extras', 'ver_balanco', true),
      ('inspetoria', 'menu', 'dashboard', true),
      ('inspetoria', 'menu', 'colaboradores', true),
      ('inspetoria', 'menu', 'departamentos', true),
      ('inspetoria', 'menu', 'rh', true),
      ('inspetoria', 'menu', 'extras', true),
      ('inspetoria', 'menu', 'ceu', true),
      ('inspetoria', 'menu', 'relatorios', true),
      ('inspetoria', 'menu', 'ferias', true),
      ('inspetoria', 'rota', 'departamentos', true),
      ('inspetoria', 'rota', 'colaboradores', true),
      ('inspetoria', 'rota', 'ocorrencias', true),
      ('inspetoria', 'rota', 'extras', true),
      ('inspetoria', 'rota', 'ceu', true),
      ('inspetoria', 'rota', 'relatorios', true),
      ('inspetoria', 'rota', 'ferias', true),
      ('inspetoria', 'rota', 'mobile_falta', true),
      ('inspetoria', 'menu', 'escalas', true),
      ('inspetoria', 'rota', 'escalas', true),
      ('inspetoria', 'escala', 'visualizar', true),
      ('inspetoria', 'menu', 'bi', true),
      ('inspetoria', 'rota', 'bi', true),
      ('inspetoria', 'ocorrencia', 'validar', false),
      ('inspetoria', 'materiais', 'solicitar_alteracao_kit', true),
      ('inspetoria', 'materiais', 'ver_sem_pedido', true),
      ('inspetoria', 'materiais', 'preencher_pelo_kit', true),
      ('inspetoria', 'materiais', 'validar', true),
      ('inspetoria', 'materiais', 'pedido_extra', true),
      ('inspetoria', 'ceu', 'conferir_pedido', true),
      ('inspetoria', 'menu', 'materiais', true),
      ('inspetoria', 'rota', 'materiais', true),
      ('inspetoria', 'menu', 'materiais_fornecedores', true),
      ('inspetoria', 'rota', 'materiais_fornecedores', true),
      ('inspetoria', 'menu', 'materiais_kit', true),
      ('inspetoria', 'rota', 'materiais_kit', true),
      ('inspetoria', 'menu', 'materiais_compras', true),
      ('inspetoria', 'rota', 'materiais_compras', true),
      ('inspetoria', 'materiais', 'editar_kit_uniforme', false);
    RETURN;
  END IF;

  -- ============================================================
  -- FINANCEIRO
  -- ============================================================
  IF p_perfil = 'financeiro' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('financeiro', 'empresa', 'editar', true),
      ('financeiro', 'departamento', 'editar', true),
      ('financeiro', 'departamento', 'excluir', true),
      ('financeiro', 'colaborador', 'exportar', true),
      ('financeiro', 'adicionais', 'editar_contrato', true),
      ('financeiro', 'adicionais', 'ver_relatorio', true),
      ('financeiro', 'extras', 'editar_categoria', true),
      ('financeiro', 'extras', 'excluir_categoria', true),
      ('financeiro', 'extras', 'gerenciar_recibo', true),
      ('financeiro', 'extras', 'marcar_pago', true),
      ('financeiro', 'extras', 'cancelar_recibo', true),
      ('financeiro', 'extras', 'ver_relatorio', true),
      ('financeiro', 'extras', 'ver_balanco', true),
      ('financeiro', 'menu', 'dashboard', true),
      ('financeiro', 'menu', 'colaboradores', true),
      ('financeiro', 'menu', 'empresas', true),
      ('financeiro', 'menu', 'departamentos', true),
      ('financeiro', 'menu', 'extras', true),
      ('financeiro', 'menu', 'adicionais', true),
      ('financeiro', 'menu', 'relatorios', true),
      ('financeiro', 'menu', 'ferias', true),
      ('financeiro', 'rota', 'empresas', true),
      ('financeiro', 'rota', 'departamentos', true),
      ('financeiro', 'rota', 'colaboradores', true),
      ('financeiro', 'rota', 'extras', true),
      ('financeiro', 'rota', 'adicionais', true),
      ('financeiro', 'rota', 'relatorios', true),
      ('financeiro', 'rota', 'ferias', true),
      ('financeiro', 'rota', 'mobile_falta', true),
      ('financeiro', 'menu', 'escalas', true),
      ('financeiro', 'rota', 'escalas', true),
      ('financeiro', 'escala', 'visualizar', true),
      ('financeiro', 'menu', 'bi', false),
      ('financeiro', 'rota', 'bi', false),
      ('financeiro', 'ocorrencia', 'validar', false),
      ('financeiro', 'menu', 'materiais', false),
      ('financeiro', 'rota', 'materiais', false),
      ('financeiro', 'materiais', 'gerenciar_fornecedores', true),
      ('financeiro', 'menu', 'materiais_fornecedores', true),
      ('financeiro', 'rota', 'materiais_fornecedores', true),
      ('financeiro', 'menu', 'materiais_kit', false),
      ('financeiro', 'rota', 'materiais_kit', false),
      ('financeiro', 'menu', 'materiais_compras', true),
      ('financeiro', 'rota', 'materiais_compras', true),
      ('financeiro', 'materiais', 'editar_kit_uniforme', false);
    RETURN;
  END IF;

  -- ============================================================
  -- DP3 (estagiária — SÓ emite crachás; ver migration 117)
  -- ============================================================
  IF p_perfil = 'dp3' THEN
    INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
      ('dp3', 'ceu', 'emitir_cracha', true),
      ('dp3', 'menu', 'crachas', true),
      ('dp3', 'menu', 'dashboard', false),
      ('dp3', 'menu', 'materiais', false),
      ('dp3', 'rota', 'materiais', false),
      ('dp3', 'menu', 'materiais_fornecedores', false),
      ('dp3', 'rota', 'materiais_fornecedores', false),
      ('dp3', 'menu', 'materiais_kit', false),
      ('dp3', 'rota', 'materiais_kit', false),
      ('dp3', 'menu', 'materiais_compras', false),
      ('dp3', 'rota', 'materiais_compras', false),
      ('dp3', 'materiais', 'editar_kit_uniforme', false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Perfil desconhecido: %', p_perfil;
END;
$function$;

-- ============================================================
-- Conferência
-- ============================================================
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
   WHERE s.nspname = 'public'
     AND (p.proname LIKE 'mat\_%' OR p.proname LIKE '%\_materiais' OR p.proname = 'reset_permissoes_perfil'
          OR p.proname = 'preencher_pedido_pelo_kit')
     AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%';
  IF n > 0 THEN RAISE EXCEPTION 'Conferência: % função(ões) com caractere corrompido', n; END IF;
  SELECT count(*) INTO n FROM public.mat_pedidos WHERE status_produtos IN ('em_compra', 'entregue', 'entregue_parcial');
  IF n > 0 THEN RAISE EXCEPTION 'Conferência: % pedido(s) já em estado da Fase 2 na aplicação', n; END IF;
  SELECT count(*) INTO n FROM public.permissoes_perfil WHERE recurso IN ('menu', 'rota') AND acao = 'materiais_compras';
  IF n <> 18 THEN RAISE EXCEPTION 'Conferência: esperava 18 linhas materiais_compras, achei %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_permissoes_perfil'
                  AND pg_get_functiondef(oid) LIKE '%(''financeiro'', ''rota'', ''materiais_compras'', true)%') THEN
    RAISE EXCEPTION 'Conferência: reset_permissoes_perfil sem materiais_compras';
  END IF;
END $$;
