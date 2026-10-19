-- ============================================================
-- 151 — Materiais: destino "remanejado de outro posto", confirmação do
--       remanejamento (tela Chegadas) e pedido de "Implantação de contrato"
-- ============================================================
-- Decisões da gestora (19/10/2026). Depende da 146, 147 e 150 (aplicadas).
--
-- A) REMANEJADO: o produto que já está num posto (contrato A) é levado para
--    outro (contrato B). A linha aprovada de B NÃO é comprada nem sai do
--    estoque central — recebe o destino 'remanejado', com o contrato de origem
--    (obrigatório) e uma observação opcional. Pode dividir a linha com
--    estoque/fornecedor, como já se divide estoque × fornecedor. Nada é
--    automático (é o comprador que escolhe na preparação da compra). Não mexe
--    no estoque central (posto → posto, sem movimento).
--    Colunas novas em mat_pedido_itens: qtd_remanejada, remanejado_de_contrato_id,
--    remanejamento_obs, qtd_entregue_remanejada, remanejado_confirmado_em/por.
--    'atendimento' continua sendo UM valor por linha, com a mesma precedência
--    da 147: fornecedor (se há parte comprada) > estoque (se há parte do
--    estoque) > remanejado (só remanejado).
--    ENTREGA: a parte remanejada só conta como entregue quando alguém CONFIRMA
--    "remanejamento feito" (RPC mat_confirmar_remanejamento, tela Chegadas —
--    mesmas pessoas que registram chegada). Sem a confirmação a linha fica
--    aberta e o pedido não vira "entregue" sem ninguém ter levado. Confirmar
--    menos que o remanejado exige motivo (vai para a carta ao líder).
-- B) mat_previa_compra devolve também a lista de contratos ativos (seletor da
--    origem) e o flag de implantação do pedido; mat_gerar_compras aceita
--    qtd_remanejada / remanejado_de_contrato_id / remanejamento_obs (MANTÉM o
--    lote da 150); mat_cancelar_compra devolve também o remanejado (e bloqueia
--    se o remanejamento já foi confirmado); chegada e separação somam a parte
--    remanejada confirmada em qtd_entregue; mat_linha_planejada /
--    mat_linha_entrega_fechada passam a considerar a parte remanejada.
--    mat_recalcular_status_entrega NÃO muda (lê mat_linha_entrega_fechada).
-- C) Leitura: mat_chegadas(p_competencia) — compras a receber/recebidas, status
--    dos pedidos ligados e remanejamentos (agregado no servidor, sem o corte de
--    1.000 linhas). Para quem registra chegada ou consulta compras.
-- D) mat_desfazer_destino_linha: devolve à prévia uma linha com destino SEM
--    compra (estoque, escritório, não atendido, remanejado) que ainda não teve
--    entrega registrada — corrige escolha errada quando a geração não criou
--    nenhuma compra (sem compra, não há o que cancelar). Comprador.
-- E) IMPLANTAÇÃO DE CONTRATO: mat_pedidos.implantacao (boolean) +
--    implantacao_inicio (date, opcional). Só em pedido extra (tipo continua
--    'extra': segue o fluxo normal — inspetor valida, gestor aprova, entra na
--    compra). Gravado no INSERT do rascunho pela tela (a policy de INSERT já
--    cobre o pedido extra do escritório; enviar_pedido_interno não muda).
--    O app tira esses pedidos da média de consumo e da comparação com o limite.
--
-- Recriadas a partir do pg_get_functiondef REAL de 19/10/2026 (backup em
-- dados-locais/backup_materiais_151_2026-10-19/). CREATE OR REPLACE preserva os
-- EXECUTE já concedidos; funções novas com REVOKE/GRANT explícitos. Sem tabela
-- nova — sem GRANT de tabela. Idempotente. NÃO aplicada.
-- ============================================================

-- ============================================================
-- A) Colunas e checks
-- ============================================================
ALTER TABLE public.mat_pedido_itens
  ADD COLUMN IF NOT EXISTS qtd_remanejada numeric(12,2),
  ADD COLUMN IF NOT EXISTS remanejado_de_contrato_id uuid REFERENCES public.mat_contratos(id),
  ADD COLUMN IF NOT EXISTS remanejamento_obs text,
  ADD COLUMN IF NOT EXISTS qtd_entregue_remanejada numeric(12,2),
  ADD COLUMN IF NOT EXISTS remanejado_confirmado_em date,
  ADD COLUMN IF NOT EXISTS remanejado_confirmado_por uuid;

COMMENT ON COLUMN public.mat_pedido_itens.qtd_remanejada IS
  'Parte da linha atendida com produto levado de outro posto (remanejado_de_contrato_id) — 151. Não é comprada nem sai do estoque central.';
COMMENT ON COLUMN public.mat_pedido_itens.qtd_entregue_remanejada IS
  'Quantidade do remanejamento confirmada como levada ao posto (tela Chegadas, mat_confirmar_remanejamento — 151).';

ALTER TABLE public.mat_pedido_itens DROP CONSTRAINT IF EXISTS mat_pedido_itens_atendimento_ck;
ALTER TABLE public.mat_pedido_itens ADD CONSTRAINT mat_pedido_itens_atendimento_ck CHECK (
  atendimento IS NULL OR atendimento IN ('fornecedor', 'estoque', 'escritorio', 'nao_atendido', 'remanejado'));

ALTER TABLE public.mat_pedido_itens DROP CONSTRAINT IF EXISTS mat_pedido_itens_destino_qtd_ck;
ALTER TABLE public.mat_pedido_itens ADD CONSTRAINT mat_pedido_itens_destino_qtd_ck CHECK (
  coalesce(qtd_estoque, 0) >= 0 AND coalesce(qtd_compra, 0) >= 0 AND coalesce(qtd_remanejada, 0) >= 0
  AND coalesce(qtd_entregue_estoque, 0) >= 0 AND coalesce(qtd_recebida_fornecedor, 0) >= 0
  AND coalesce(qtd_entregue_remanejada, 0) >= 0
  AND (atendimento IS NULL
       OR (qtd_aprovada IS NOT NULL
           AND coalesce(qtd_estoque, 0) + coalesce(qtd_compra, 0) + coalesce(qtd_remanejada, 0) <= qtd_aprovada)));

ALTER TABLE public.mat_pedido_itens DROP CONSTRAINT IF EXISTS mat_pedido_itens_remanejado_ck;
ALTER TABLE public.mat_pedido_itens ADD CONSTRAINT mat_pedido_itens_remanejado_ck CHECK (
  ((coalesce(qtd_remanejada, 0) > 0) = (remanejado_de_contrato_id IS NOT NULL))
  AND (qtd_entregue_remanejada IS NULL OR qtd_entregue_remanejada <= coalesce(qtd_remanejada, 0))
  AND (atendimento IS DISTINCT FROM 'remanejado' OR coalesce(qtd_remanejada, 0) > 0));

CREATE INDEX IF NOT EXISTS mat_pedido_itens_remanejado_idx
  ON public.mat_pedido_itens (remanejado_de_contrato_id) WHERE qtd_remanejada > 0;

-- Implantação de contrato (E)
ALTER TABLE public.mat_pedidos
  ADD COLUMN IF NOT EXISTS implantacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS implantacao_inicio date;
COMMENT ON COLUMN public.mat_pedidos.implantacao IS
  'Pedido extra de implantação de contrato (enxoval inicial do posto que vai começar) — 151. Fluxo normal; fora da média de consumo e do limite mensal.';
ALTER TABLE public.mat_pedidos DROP CONSTRAINT IF EXISTS mat_pedidos_implantacao_ck;
ALTER TABLE public.mat_pedidos ADD CONSTRAINT mat_pedidos_implantacao_ck CHECK (
  (NOT implantacao OR tipo = 'extra') AND (implantacao_inicio IS NULL OR implantacao));

-- ============================================================
-- Guarda (147) com as colunas novas
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_pedido_itens_guarda_fase2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
      NEW.qtd_entregue, NEW.motivo_entrega, NEW.entregue_em, NEW.entregue_por,
      NEW.qtd_remanejada, NEW.remanejado_de_contrato_id, NEW.remanejamento_obs,
      NEW.qtd_entregue_remanejada, NEW.remanejado_confirmado_em, NEW.remanejado_confirmado_por)
     IS DISTINCT FROM
     (OLD.atendimento, OLD.qtd_estoque, OLD.qtd_compra, OLD.compra_item_id, OLD.motivo_nao_atendido,
      OLD.atendimento_por, OLD.atendimento_em, OLD.qtd_entregue_estoque, OLD.qtd_recebida_fornecedor,
      OLD.qtd_entregue, OLD.motivo_entrega, OLD.entregue_em, OLD.entregue_por,
      OLD.qtd_remanejada, OLD.remanejado_de_contrato_id, OLD.remanejamento_obs,
      OLD.qtd_entregue_remanejada, OLD.remanejado_confirmado_em, OLD.remanejado_confirmado_por) THEN
    RAISE EXCEPTION 'Destino e entrega da linha só mudam pelas telas de compra, separação e chegada';
  END IF;
  IF OLD.atendimento IS NOT NULL AND (NEW.qtd_aprovada IS DISTINCT FROM OLD.qtd_aprovada
       OR NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.variacao_id IS DISTINCT FROM OLD.variacao_id) THEN
    RAISE EXCEPTION 'Linha com destino na compra não muda mais (item e quantidade aprovada)';
  END IF;
  RETURN NEW;
END $function$;

-- ============================================================
-- Linha planejada / entrega fechada (147) com a parte remanejada
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_linha_planejada(l mat_pedido_itens)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE WHEN l.atendimento = 'escritorio' THEN coalesce(l.qtd_aprovada, 0)
              WHEN l.atendimento = 'nao_atendido' THEN 0
              ELSE coalesce(l.qtd_estoque, 0) + coalesce(l.qtd_compra, 0) + coalesce(l.qtd_remanejada, 0) END;
$function$;

CREATE OR REPLACE FUNCTION public.mat_linha_entrega_fechada(l mat_pedido_itens)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT l.atendimento = 'nao_atendido'
      OR (l.atendimento IS NOT NULL
          AND (CASE WHEN l.atendimento = 'escritorio' THEN l.qtd_entregue_estoque IS NOT NULL
                    ELSE coalesce(l.qtd_estoque, 0) = 0 OR l.qtd_entregue_estoque IS NOT NULL END)
          AND (coalesce(l.qtd_compra, 0) = 0 OR l.qtd_recebida_fornecedor IS NOT NULL)
          -- 151: a parte remanejada só fecha com "remanejamento feito" confirmado.
          AND (coalesce(l.qtd_remanejada, 0) = 0 OR l.qtd_entregue_remanejada IS NOT NULL));
$function$;

-- ============================================================
-- B) mat_previa_compra (+ contratos ativos e implantação)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_previa_compra(p_competencia date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_comp date := date_trunc('month', p_competencia)::date; v_hoje date := public.mat_hoje();
        v_linhas jsonb; v_pend jsonb; v_escr jsonb; v_contratos jsonb;
BEGIN
  IF NOT (public.pode_comprar_materiais() OR public.pode_ver_compras_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para ver a compra de materiais';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'linha_id', l.id, 'pedido_id', p.id, 'pedido_tipo', p.tipo, 'competencia', p.competencia,
           'implantacao', coalesce(p.implantacao, false),
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

  -- 151: contratos ativos (seletor "remanejado de qual posto").
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'rota', c.rota) ORDER BY c.nome), '[]'::jsonb)
    INTO v_contratos FROM public.mat_contratos c WHERE c.ativo;

  RETURN jsonb_build_object(
    'competencia', v_comp, 'hoje', v_hoje,
    'linhas', v_linhas, 'pendentes', v_pend, 'escritorio', v_escr, 'contratos', v_contratos,
    'contratos_sem_rota', (SELECT count(*) FROM public.mat_contratos WHERE ativo AND rota IS NULL),
    'ultima_contagem', (SELECT max(data) FROM public.mat_estoque_contagens WHERE status = 'fechada'),
    'dia_inicio_compra', public.mat_config_dia('dia_inicio_compra', 20),
    'dia_fim_compra', public.mat_config_dia('dia_fim_compra', 25),
    'dia_limite_aprovacao', public.mat_config_dia('dia_limite_aprovacao', 20));
END $function$;

-- ============================================================
-- B) mat_gerar_compras (150 + remanejado; MANTÉM v_lote / lote_compra / lotes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_gerar_compras(p_competencia date, p_tipo text, p_linhas jsonb, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comp date := date_trunc('month', p_competencia)::date;
  e jsonb; l public.mat_pedido_itens%ROWTYPE; p public.mat_pedidos%ROWTYPE; it public.mat_itens%ROWTYPE;
  v_qe numeric; v_qc numeric; v_qr numeric; v_origem uuid; v_obs text;
  v_forn uuid; v_motivo text; v_nao boolean; v_atend text;
  v_compra uuid; v_celula uuid; v_compras uuid[] := '{}'; v_pedidos uuid[] := '{}'; n integer := 0;
  v_lote uuid := gen_random_uuid();  -- 150: marca TODAS as linhas tocadas por esta chamada
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
    v_qr := coalesce(nullif(e->>'qtd_remanejada', '')::numeric, 0);
    v_origem := nullif(e->>'remanejado_de_contrato_id', '')::uuid;
    v_obs := nullif(btrim(coalesce(e->>'remanejamento_obs', '')), '');
    v_forn := nullif(e->>'fornecedor_id', '')::uuid;
    v_celula := NULL;
    IF v_qe < 0 OR v_qc < 0 OR v_qr < 0 THEN RAISE EXCEPTION 'Quantidade negativa na linha %', l.id; END IF;

    IF l.item_id IS NULL AND NOT v_nao THEN
      RAISE EXCEPTION 'A linha "%" é texto livre: ligue ao catálogo antes de comprar, ou marque como não atendida', l.descricao_livre;
    END IF;
    IF l.item_id IS NOT NULL THEN SELECT * INTO it FROM public.mat_itens WHERE id = l.item_id; END IF;

    IF v_nao OR (l.item_id IS NOT NULL AND NOT it.preparo_escritorio AND v_qe + v_qc + v_qr = 0) THEN
      IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo de não atender a linha %', l.id; END IF;
      v_atend := 'nao_atendido'; v_qe := 0; v_qc := 0; v_qr := 0;
    ELSIF it.preparo_escritorio THEN
      IF v_qr > 0 THEN
        RAISE EXCEPTION 'Item preparado no escritório não é remanejado (linha %)', l.id;
      END IF;
      v_atend := 'escritorio'; v_qe := 0; v_qc := 0;
    ELSE
      IF v_qe + v_qc + v_qr > l.qtd_aprovada THEN
        RAISE EXCEPTION 'A linha % passa da quantidade aprovada (% > %)', l.id, v_qe + v_qc + v_qr, l.qtd_aprovada;
      END IF;
      IF v_qe + v_qc + v_qr < l.qtd_aprovada AND v_motivo IS NULL THEN
        RAISE EXCEPTION 'Informe o motivo de atender menos que o aprovado na linha %', l.id;
      END IF;
      -- 151: remanejado de outro posto (contrato de origem obrigatório, ativo e diferente do destino).
      IF v_qr > 0 THEN
        IF v_origem IS NULL THEN
          RAISE EXCEPTION 'Informe de qual posto vem o remanejado (linha %)', l.id;
        END IF;
        IF v_origem = p.contrato_id THEN
          RAISE EXCEPTION 'O posto de origem do remanejado não pode ser o próprio posto (linha %)', l.id;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.mat_contratos WHERE id = v_origem AND ativo) THEN
          RAISE EXCEPTION 'Posto de origem do remanejado inexistente ou inativo (linha %)', l.id;
        END IF;
      ELSE
        v_origem := NULL; v_obs := NULL;
      END IF;
      v_atend := CASE WHEN v_qc > 0 THEN 'fornecedor' WHEN v_qe > 0 THEN 'estoque' ELSE 'remanejado' END;
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
    IF v_atend IN ('nao_atendido', 'escritorio') THEN v_qr := 0; v_origem := NULL; v_obs := NULL; END IF;

    UPDATE public.mat_pedido_itens
       SET atendimento = v_atend,
           qtd_estoque = CASE WHEN v_qe > 0 THEN v_qe END,
           qtd_compra = CASE WHEN v_qc > 0 THEN v_qc END,
           qtd_remanejada = CASE WHEN v_qr > 0 THEN v_qr END,
           remanejado_de_contrato_id = v_origem,
           remanejamento_obs = v_obs,
           compra_item_id = v_celula,
           motivo_nao_atendido = CASE WHEN v_atend = 'nao_atendido' OR v_qe + v_qc + v_qr < l.qtd_aprovada
                                        AND v_atend IN ('fornecedor', 'estoque', 'remanejado') THEN v_motivo END,
           atendimento_por = auth.uid(), atendimento_em = now(),
           lote_compra = v_lote
     WHERE id = l.id;
    IF NOT l.pedido_id = ANY (v_pedidos) THEN v_pedidos := v_pedidos || l.pedido_id; END IF;
    n := n + 1;
  END LOOP;

  -- 150: cada compra (rascunho) que recebeu linhas nesta chamada guarda o lote, para o cancelamento desfazer
  -- também as linhas sem compra (escritório, estoque, não atendido, remanejado) marcadas na mesma geração.
  UPDATE public.mat_compras SET lotes = array_append(lotes, v_lote)
   WHERE id = ANY (v_compras) AND NOT v_lote = ANY (lotes);

  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(v_pedidos) x;

  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('linhas', n,
    'compras', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'numero', c.numero,
                  'fornecedor_id', c.fornecedor_id, 'antes_da_janela', c.antes_da_janela,
                  'celulas', (SELECT count(*) FROM public.mat_compra_itens ci WHERE ci.compra_id = c.id))
                  ORDER BY c.numero), '[]'::jsonb)
                  FROM public.mat_compras c WHERE c.id = ANY (v_compras)));
END $function$;

-- ============================================================
-- B) mat_cancelar_compra (150 + remanejado)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_cancelar_compra(p_compra uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.mat_compras%ROWTYPE; v_pedidos uuid[]; n integer; n_lote integer := 0; v_lotes uuid[];
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
  -- 151: parte remanejada já confirmada como levada ao posto.
  IF EXISTS (SELECT 1 FROM public.mat_pedido_itens l JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
              WHERE ci.compra_id = p_compra AND l.qtd_entregue_remanejada IS NOT NULL) THEN
    RAISE EXCEPTION 'Há linhas desta compra com remanejamento já confirmado: não dá para cancelar';
  END IF;

  -- 150: lotes (gerações) desta compra que NÃO têm mais nenhuma outra compra ativa. Só nesses lotes as linhas sem
  -- compra (escritório, estoque, não atendido, remanejado) voltam para a prévia; se outra compra do mesmo lote
  -- continua ativa, essas linhas pertencem também à geração dela e ficam como estão.
  SELECT coalesce(array_agg(x), '{}') INTO v_lotes
    FROM unnest(c.lotes) x
   WHERE NOT EXISTS (SELECT 1 FROM public.mat_compras o
                      WHERE o.id <> p_compra AND o.status <> 'cancelada' AND x = ANY (o.lotes));
  IF EXISTS (SELECT 1 FROM public.mat_pedido_itens l
              WHERE l.lote_compra = ANY (v_lotes) AND l.compra_item_id IS NULL AND l.atendimento IS NOT NULL
                AND (l.qtd_entregue_estoque IS NOT NULL OR l.qtd_entregue IS NOT NULL
                     OR l.qtd_entregue_remanejada IS NOT NULL)) THEN
    RAISE EXCEPTION 'Há linhas desta geração (estoque/escritório/remanejado) com entrega já registrada: não dá para cancelar';
  END IF;

  SELECT array_agg(DISTINCT pid) INTO v_pedidos FROM (
    SELECT l.pedido_id AS pid FROM public.mat_pedido_itens l JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
     WHERE ci.compra_id = p_compra
    UNION
    SELECT l.pedido_id FROM public.mat_pedido_itens l
     WHERE l.lote_compra = ANY (v_lotes) AND l.compra_item_id IS NULL AND l.atendimento IS NOT NULL) s;

  UPDATE public.mat_pedido_itens l
     SET atendimento = NULL, qtd_estoque = NULL, qtd_compra = NULL, compra_item_id = NULL,
         qtd_remanejada = NULL, remanejado_de_contrato_id = NULL, remanejamento_obs = NULL,
         motivo_nao_atendido = NULL, atendimento_por = NULL, atendimento_em = NULL, lote_compra = NULL
    FROM public.mat_compra_itens ci
   WHERE ci.id = l.compra_item_id AND ci.compra_id = p_compra;
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Linhas da mesma geração que não foram para a compra (escritório / estoque / não atendido / remanejado).
  UPDATE public.mat_pedido_itens l
     SET atendimento = NULL, qtd_estoque = NULL, qtd_compra = NULL, compra_item_id = NULL,
         qtd_remanejada = NULL, remanejado_de_contrato_id = NULL, remanejamento_obs = NULL,
         motivo_nao_atendido = NULL, atendimento_por = NULL, atendimento_em = NULL, lote_compra = NULL
   WHERE l.lote_compra = ANY (v_lotes) AND l.compra_item_id IS NULL AND l.atendimento IS NOT NULL;
  GET DIAGNOSTICS n_lote = ROW_COUNT;

  UPDATE public.mat_compras
     SET status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), cancelada_motivo = p_motivo
   WHERE id = p_compra;
  -- O status do pedido volta a ser calculado pelas linhas (em_compra -> aprovado quando restam linhas sem destino).
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(coalesce(v_pedidos, '{}')) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('id', p_compra, 'linhas_liberadas', n + n_lote, 'linhas_da_compra', n, 'linhas_da_geracao', n_lote);
END $function$;

-- ============================================================
-- B) Chegada e separação: qtd_entregue soma também a parte remanejada confirmada
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_registrar_chegada(p_compra uuid, p_itens jsonb, p_data date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
               qtd_entregue = coalesce(qtd_entregue_estoque, 0) + v_r + coalesce(qtd_entregue_remanejada, 0),
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
END $function$;

CREATE OR REPLACE FUNCTION public.mat_registrar_separacao(p_linhas jsonb, p_data date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
           qtd_entregue = v_qtd + coalesce(qtd_recebida_fornecedor, 0) + coalesce(qtd_entregue_remanejada, 0),
           motivo_entrega = coalesce(v_motivo, motivo_entrega),
           entregue_em = v_data, entregue_por = auth.uid()
     WHERE id = l.id;
    IF NOT l.pedido_id = ANY (v_pedidos) THEN v_pedidos := v_pedidos || l.pedido_id; END IF;
    n := n + 1;
  END LOOP;
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(v_pedidos) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('linhas', n);
END $function$;

-- ============================================================
-- A) Confirmar "remanejamento feito" (tela Chegadas)
-- p_linhas: [{id, qtd (padrão = remanejado), motivo (obrigatório se menor)}]
-- Pode ser refeito (corrige a quantidade confirmada), como a chegada.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_confirmar_remanejamento(p_linhas jsonb, p_data date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE e jsonb; l public.mat_pedido_itens%ROWTYPE; p public.mat_pedidos%ROWTYPE; v_qtd numeric; v_motivo text;
        v_data date := coalesce(p_data, public.mat_hoje()); v_pedidos uuid[] := '{}'; n integer := 0;
BEGIN
  PERFORM set_config('corh.mat_fase2', 'on', true);
  IF NOT public.pode_registrar_chegada_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para confirmar o remanejamento';
  END IF;
  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' OR jsonb_array_length(p_linhas) = 0 THEN
    RAISE EXCEPTION 'Nenhuma linha informada';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    SELECT * INTO l FROM public.mat_pedido_itens WHERE id = (e->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não encontrada', e->>'id'; END IF;
    IF coalesce(l.qtd_remanejada, 0) <= 0 THEN
      RAISE EXCEPTION 'A linha % não tem parte remanejada', l.id;
    END IF;
    SELECT * INTO p FROM public.mat_pedidos WHERE id = l.pedido_id;
    IF p.status_produtos = 'cancelado' THEN RAISE EXCEPTION 'O pedido da linha % foi cancelado', l.id; END IF;
    v_qtd := coalesce(nullif(e->>'qtd', '')::numeric, l.qtd_remanejada);
    v_motivo := nullif(btrim(coalesce(e->>'motivo', '')), '');
    IF v_qtd < 0 OR v_qtd > l.qtd_remanejada THEN
      RAISE EXCEPTION 'Quantidade confirmada inválida na linha % (remanejado: %)', l.id, trim_scale(l.qtd_remanejada);
    END IF;
    IF v_qtd < l.qtd_remanejada AND v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo de levar menos que o remanejado na linha %', l.id;
    END IF;
    UPDATE public.mat_pedido_itens
       SET qtd_entregue_remanejada = v_qtd,
           qtd_entregue = coalesce(qtd_entregue_estoque, 0) + coalesce(qtd_recebida_fornecedor, 0) + v_qtd,
           motivo_entrega = CASE WHEN v_qtd < l.qtd_remanejada THEN v_motivo ELSE motivo_entrega END,
           remanejado_confirmado_em = v_data, remanejado_confirmado_por = auth.uid(),
           entregue_em = v_data, entregue_por = auth.uid()
     WHERE id = l.id;
    IF NOT l.pedido_id = ANY (v_pedidos) THEN v_pedidos := v_pedidos || l.pedido_id; END IF;
    n := n + 1;
  END LOOP;
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(v_pedidos) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('linhas', n,
    'status', (SELECT coalesce(jsonb_agg(jsonb_build_object('pedido_id', id, 'status', status_produtos)), '[]'::jsonb)
                 FROM public.mat_pedidos WHERE id = ANY (v_pedidos)));
END $function$;
REVOKE ALL ON FUNCTION public.mat_confirmar_remanejamento(jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_confirmar_remanejamento(jsonb, date) TO authenticated, service_role;

-- ============================================================
-- D) Desfazer o destino de uma linha SEM compra (antes de qualquer entrega)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_desfazer_destino_linha(p_linha uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.mat_pedido_itens%ROWTYPE; v_status text;
BEGIN
  PERFORM set_config('corh.mat_fase2', 'on', true);
  IF NOT public.pode_comprar_materiais() THEN RAISE EXCEPTION 'Sem permissão para desfazer o destino'; END IF;
  IF btrim(coalesce(p_motivo, '')) = '' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  SELECT * INTO l FROM public.mat_pedido_itens WHERE id = p_linha FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha não encontrada'; END IF;
  IF l.atendimento IS NULL THEN RAISE EXCEPTION 'Esta linha não tem destino'; END IF;
  IF l.compra_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta linha está numa compra ao fornecedor: cancele a compra para refazer o destino';
  END IF;
  IF l.qtd_entregue_estoque IS NOT NULL OR l.qtd_entregue_remanejada IS NOT NULL OR l.qtd_entregue IS NOT NULL THEN
    RAISE EXCEPTION 'Esta linha já tem entrega registrada: não dá para desfazer o destino';
  END IF;
  UPDATE public.mat_pedido_itens
     SET atendimento = NULL, qtd_estoque = NULL, qtd_compra = NULL, compra_item_id = NULL,
         qtd_remanejada = NULL, remanejado_de_contrato_id = NULL, remanejamento_obs = NULL,
         motivo_nao_atendido = NULL, atendimento_por = NULL, atendimento_em = NULL, lote_compra = NULL
   WHERE id = l.id;
  INSERT INTO public.mat_comentarios (pedido_id, linha_tabela, linha_id, autor_id, autor_nome, texto)
  VALUES (l.pedido_id, 'mat_pedido_itens', l.id, auth.uid(), (SELECT nome FROM public.perfis WHERE id = auth.uid()),
          'Destino da compra desfeito (' || l.atendimento || '). Motivo: ' || btrim(p_motivo));
  v_status := public.mat_recalcular_status_entrega(l.pedido_id);
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('id', l.id, 'status', v_status);
END $function$;
REVOKE ALL ON FUNCTION public.mat_desfazer_destino_linha(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_desfazer_destino_linha(uuid, text) TO authenticated, service_role;

-- ============================================================
-- C) Leitura da tela Chegadas
-- compras: as da competência que já foram enviadas (enviada/recebida_parcial/recebida);
-- pedidos: status dos pedidos ligados a essas compras ou com remanejamento;
-- remanejamentos: linhas com parte remanejada da competência (e as anteriores ainda
-- não confirmadas), com origem, destino e as compras da mesma geração.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_chegadas(p_competencia date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_comp date := date_trunc('month', p_competencia)::date; v_rem jsonb; v_ped jsonb;
BEGIN
  IF NOT (public.pode_registrar_chegada_materiais() OR public.pode_ver_compras_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para ver as chegadas';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'linha_id', l.id, 'pedido_id', p.id, 'competencia', p.competencia,
           'contrato_id', c.id, 'contrato_nome', c.nome, 'rota', coalesce(p.rota_override, c.rota),
           'origem_id', o.id, 'origem_nome', o.nome,
           'item_id', l.item_id, 'variacao_id', l.variacao_id,
           'item_nome', it.nome, 'variacao_rotulo', v.rotulo, 'unidade', it.unidade_pedido,
           'qtd_remanejada', l.qtd_remanejada, 'qtd_entregue_remanejada', l.qtd_entregue_remanejada,
           'remanejamento_obs', l.remanejamento_obs, 'motivo_entrega', l.motivo_entrega,
           'confirmado_em', l.remanejado_confirmado_em, 'status_pedido', p.status_produtos,
           'compras', (SELECT coalesce(jsonb_agg(DISTINCT cp.id), '[]'::jsonb) FROM public.mat_compras cp
                        WHERE cp.status <> 'cancelada'
                          AND ((l.lote_compra IS NOT NULL AND l.lote_compra = ANY (cp.lotes))
                               OR EXISTS (SELECT 1 FROM public.mat_compra_itens ci
                                           WHERE ci.id = l.compra_item_id AND ci.compra_id = cp.id))))
         ORDER BY c.nome, it.nome, v.rotulo), '[]'::jsonb)
    INTO v_rem
    FROM public.mat_pedido_itens l
    JOIN public.mat_pedidos p ON p.id = l.pedido_id
    JOIN public.mat_contratos c ON c.id = p.contrato_id
    LEFT JOIN public.mat_contratos o ON o.id = l.remanejado_de_contrato_id
    LEFT JOIN public.mat_itens it ON it.id = l.item_id
    LEFT JOIN public.mat_item_variacoes v ON v.id = l.variacao_id
   WHERE l.qtd_remanejada > 0
     AND p.status_produtos <> 'cancelado'
     AND (p.competencia = v_comp OR (p.competencia < v_comp AND l.qtd_entregue_remanejada IS NULL));

  SELECT coalesce(jsonb_agg(jsonb_build_object('pedido_id', s.id, 'contrato_id', s.contrato_id,
           'contrato_nome', s.nome, 'tipo', s.tipo, 'implantacao', s.implantacao,
           'status_produtos', s.status_produtos) ORDER BY s.nome), '[]'::jsonb)
    INTO v_ped
    FROM (
      SELECT DISTINCT p.id, p.contrato_id, c.nome, p.tipo, coalesce(p.implantacao, false) AS implantacao, p.status_produtos
        FROM public.mat_pedido_itens l
        JOIN public.mat_pedidos p ON p.id = l.pedido_id
        JOIN public.mat_contratos c ON c.id = p.contrato_id
        LEFT JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
        LEFT JOIN public.mat_compras cp ON cp.id = ci.compra_id
       WHERE p.status_produtos <> 'cancelado'
         AND ((cp.competencia = v_comp AND cp.status IN ('enviada', 'recebida_parcial', 'recebida'))
              OR (l.qtd_remanejada > 0 AND (p.competencia = v_comp
                                            OR (p.competencia < v_comp AND l.qtd_entregue_remanejada IS NULL))))
    ) s;

  RETURN jsonb_build_object('competencia', v_comp, 'hoje', public.mat_hoje(),
    'remanejamentos', v_rem, 'pedidos', v_ped);
END $function$;
REVOKE ALL ON FUNCTION public.mat_chegadas(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_chegadas(date) TO authenticated, service_role;

-- ============================================================
-- Conferência final (aborta se algo não bater)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname LIKE 'mat\_%' ESCAPE '\'
                AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%') THEN
    RAISE EXCEPTION '151: função mat_* com caractere corrompido (chr 65533) — aplique pelo script de ARQUIVO UTF-8';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mat_pedido_itens_remanejado_ck') THEN
    RAISE EXCEPTION '151: constraint mat_pedido_itens_remanejado_ck ausente';
  END IF;
  IF (SELECT count(*) FROM public.mat_pedidos WHERE implantacao) <> 0 THEN
    RAISE EXCEPTION '151: nenhum pedido deveria nascer como implantação';
  END IF;
END $$;
