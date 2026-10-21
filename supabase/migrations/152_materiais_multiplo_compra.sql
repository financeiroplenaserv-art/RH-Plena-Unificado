-- ============================================================
-- 152 — Materiais: múltiplo de compra, item fracionado no escritório e
--       "comprar a mais para o estoque" na compra do mês
-- ============================================================
-- Decisões da gestora (19/10/2026). Depende da 146, 147, 150 e 151 (aplicadas).
-- 148/149 seguem reservadas (compra da Beth / permissões finas).
--
-- A) MÚLTIPLO DE COMPRA, no item do catálogo (mat_itens):
--    * unidade_compra  text     — como o fornecedor vende ("kit", "caixa", "bombona 5L").
--    * fator_compra    integer  — quantas unidades DO PEDIDO vêm nessa unidade de compra.
--      Padrão 1 = comportamento de antes (nada muda para quem não configurar).
--    * fracionado_escritorio boolean — o fornecedor entrega a unidade de compra no
--      ESCRITÓRIO e a mesa separa para os postos (caso Lustro: compra bombona 5L,
--      os postos recebem frascos de 1L). Padrão false.
--    Edição pela tela do Catálogo (UPDATE direto; a policy de UPDATE de mat_itens
--    já é a de quem edita o cadastro — nada de permissão nova).
-- B) NA COMPRA (mat_compra_itens):
--    * A quantidade ao fornecedor de cada item + variação, NA COMPRA INTEIRA
--      (todos os postos + estoque), é arredondada PARA CIMA ao múltiplo do fator.
--      A sobra vira (ou entra na) célula de REPOSIÇÃO DO ESTOQUE (contrato NULL)
--      da MESMA compra — quando chegar, mat_registrar_chegada já lança a
--      reposição no estoque central (sem mudança na chegada).
--      Ex.: 3 flanelas pedidas, kit c/ 100 → célula do posto 3 + estoque 97 = 100.
--    * Colunas novas: unidade_compra/fator_compra (SNAPSHOT — o Excel enviado
--      nunca muda), qtd_arredondamento (parte da célula de estoque que é sobra
--      do arredondamento; recalculada a cada geração enquanto a compra é
--      rascunho) e qtd_fracionar (parte da célula de estoque que é a necessidade
--      dos postos de item fracionado — só para explicar na tela/Excel).
--    * Item fracionado: a parte "ao fornecedor" das linhas NÃO vira célula do
--      posto — vai para a célula de estoque (qtd_fracionar) e a linha recebe o
--      destino 'estoque' (sai do estoque quando a mesa separar —
--      mat_registrar_separacao, sem mudança). Feito no SERVIDOR (vale para
--      qualquer cliente).
--    * "Comprar a mais para o estoque": mat_gerar_compras ganha p_reposicao
--      (jsonb, opcional) = [{item_id, variacao_id, fornecedor_id, quantidade}],
--      que soma na célula de estoque da compra do fornecedor (rascunho).
--    * mat_gerar_compra_reposicao também arredonda.
-- C) mat_previa_compra devolve fator/unidade de compra e o flag de fracionado.
-- D) mat_cancelar_compra devolve à prévia também as linhas de item fracionado
--    cuja compra (célula de estoque com qtd_fracionar) estava nesta compra —
--    mesmo que outra compra do mesmo lote continue ativa (antes elas só
--    voltavam pelo lote da 150).
--
-- Funções recriadas a partir do pg_get_functiondef REAL de 21/10/2026 (backup em
-- dados-locais/backup_materiais_152_2026-10-21/funcoes/): mat_somar_celula_compra,
-- mat_gerar_compras (MANTÉM o lote da 150 e o remanejado da 151; a assinatura
-- muda: +p_reposicao DEFAULT NULL — a de 4 argumentos é removida; o cliente
-- atual, que chama com 4 nomes, continua funcionando), mat_gerar_compra_reposicao,
-- mat_previa_compra e mat_cancelar_compra. Nova interna: mat_arredondar_compra.
-- O sinal corh.mat_fase2 da 147 continua ligado/desligado como antes.
-- Sem tabela nova — sem GRANT de tabela. Idempotente (pode rodar 2×).
-- APLICAR SEMPRE PELO SCRIPT DE ARQUIVO UTF-8 (acentos nos corpos).
-- ============================================================

-- ------------------------------------------------------------
-- A) Colunas do item
-- ------------------------------------------------------------
ALTER TABLE public.mat_itens ADD COLUMN IF NOT EXISTS unidade_compra text;
ALTER TABLE public.mat_itens ADD COLUMN IF NOT EXISTS fator_compra integer NOT NULL DEFAULT 1;
ALTER TABLE public.mat_itens ADD COLUMN IF NOT EXISTS fracionado_escritorio boolean NOT NULL DEFAULT false;

ALTER TABLE public.mat_itens DROP CONSTRAINT IF EXISTS mat_itens_fator_compra_ck;
ALTER TABLE public.mat_itens ADD CONSTRAINT mat_itens_fator_compra_ck
  CHECK (fator_compra BETWEEN 1 AND 10000);
-- Fator > 1 exige o nome da unidade de compra (o Excel diz "1 kit c/ 100").
ALTER TABLE public.mat_itens DROP CONSTRAINT IF EXISTS mat_itens_unidade_compra_ck;
ALTER TABLE public.mat_itens ADD CONSTRAINT mat_itens_unidade_compra_ck
  CHECK (fator_compra = 1 OR btrim(coalesce(unidade_compra, '')) <> '');
-- Item preparado no escritório nunca vai ao fornecedor: não é "fracionado".
ALTER TABLE public.mat_itens DROP CONSTRAINT IF EXISTS mat_itens_fracionado_ck;
ALTER TABLE public.mat_itens ADD CONSTRAINT mat_itens_fracionado_ck
  CHECK (NOT (fracionado_escritorio AND coalesce(preparo_escritorio, false)));

COMMENT ON COLUMN public.mat_itens.unidade_compra IS
  '152: como o fornecedor vende (kit, caixa, bombona 5L). NULL com fator 1 = vende na unidade do pedido.';
COMMENT ON COLUMN public.mat_itens.fator_compra IS
  '152: quantas unidades do pedido vêm na unidade de compra. A compra arredonda para cima e a sobra vai ao estoque.';
COMMENT ON COLUMN public.mat_itens.fracionado_escritorio IS
  '152: fornecedor entrega no escritório e a mesa separa para os postos (linhas saem do estoque).';

-- ------------------------------------------------------------
-- B) Colunas da célula da compra
-- ------------------------------------------------------------
ALTER TABLE public.mat_compra_itens ADD COLUMN IF NOT EXISTS unidade_compra text;
ALTER TABLE public.mat_compra_itens ADD COLUMN IF NOT EXISTS fator_compra integer NOT NULL DEFAULT 1;
ALTER TABLE public.mat_compra_itens ADD COLUMN IF NOT EXISTS qtd_arredondamento numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.mat_compra_itens ADD COLUMN IF NOT EXISTS qtd_fracionar numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.mat_compra_itens DROP CONSTRAINT IF EXISTS mat_compra_itens_multiplo_ck;
ALTER TABLE public.mat_compra_itens ADD CONSTRAINT mat_compra_itens_multiplo_ck CHECK (
  fator_compra >= 1
  AND qtd_arredondamento >= 0 AND qtd_fracionar >= 0
  -- só a célula de estoque (contrato NULL) carrega sobra/fracionamento
  AND (contrato_id IS NULL OR (qtd_arredondamento = 0 AND qtd_fracionar = 0))
  AND qtd_arredondamento + qtd_fracionar <= quantidade);

-- ------------------------------------------------------------
-- mat_somar_celula_compra: + snapshot da unidade/fator de compra
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mat_somar_celula_compra(p_compra uuid, p_item uuid, p_variacao uuid, p_contrato uuid, p_rota smallint, p_qtd numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    unidade, categoria, contrato_nome, rota, quantidade, preco_unitario, entrega_local,
    unidade_compra, fator_compra)
  VALUES (p_compra, p_item, p_variacao, p_contrato, it.nome,
    (SELECT rotulo FROM public.mat_item_variacoes WHERE id = p_variacao),
    it.unidade_pedido, it.categoria,
    (SELECT nome FROM public.mat_contratos WHERE id = p_contrato),
    p_rota, p_qtd, public.mat_preco_vigente(p_item, p_variacao, public.mat_hoje()),
    CASE WHEN p_contrato IS NULL THEN 'escritorio' ELSE 'posto' END,
    nullif(btrim(coalesce(it.unidade_compra, '')), ''), coalesce(it.fator_compra, 1))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- ------------------------------------------------------------
-- Nova interna: arredonda a compra (rascunho) ao múltiplo de cada item.
-- Para cada item + variação: base = tudo o que foi pedido nesta compra MENOS a
-- sobra de arredondamento já gravada; alvo = teto(base / fator) × fator; a
-- diferença é a nova sobra, guardada na célula de estoque (contrato NULL).
-- Recalcula do zero a cada chamada (gerar de novo no mesmo rascunho não
-- acumula sobra). Fator 1 = sobra 0 (célula de estoque só com o que já tinha).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mat_arredondar_compra(p_compra uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; v_fator integer; v_unid text; v_arred numeric; v_cel public.mat_compra_itens%ROWTYPE;
        v_id uuid; v_total numeric := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.mat_compras WHERE id = p_compra AND status = 'rascunho') THEN
    RETURN 0;  -- compra enviada/cancelada nunca muda
  END IF;
  FOR r IN SELECT item_id, variacao_id, sum(quantidade) - sum(qtd_arredondamento) AS base
             FROM public.mat_compra_itens WHERE compra_id = p_compra
            GROUP BY item_id, variacao_id LOOP
    SELECT coalesce(fator_compra, 1), nullif(btrim(coalesce(unidade_compra, '')), '')
      INTO v_fator, v_unid FROM public.mat_itens WHERE id = r.item_id;
    v_fator := coalesce(v_fator, 1);
    v_arred := CASE WHEN v_fator > 1 AND r.base > 0 THEN ceil(r.base / v_fator) * v_fator - r.base ELSE 0 END;

    -- Snapshot da unidade/fator em todas as células do item nesta compra (vale o cadastro na geração).
    UPDATE public.mat_compra_itens SET fator_compra = v_fator, unidade_compra = v_unid
     WHERE compra_id = p_compra AND item_id = r.item_id AND variacao_id IS NOT DISTINCT FROM r.variacao_id
       AND (fator_compra IS DISTINCT FROM v_fator OR unidade_compra IS DISTINCT FROM v_unid);

    SELECT * INTO v_cel FROM public.mat_compra_itens
     WHERE compra_id = p_compra AND item_id = r.item_id AND variacao_id IS NOT DISTINCT FROM r.variacao_id
       AND contrato_id IS NULL
     FOR UPDATE;
    IF FOUND THEN
      IF v_cel.quantidade - v_cel.qtd_arredondamento + v_arred <= 0 THEN
        DELETE FROM public.mat_compra_itens WHERE id = v_cel.id;
      ELSIF v_arred <> v_cel.qtd_arredondamento THEN
        UPDATE public.mat_compra_itens
           SET quantidade = quantidade - qtd_arredondamento + v_arred, qtd_arredondamento = v_arred
         WHERE id = v_cel.id;
      END IF;
    ELSIF v_arred > 0 THEN
      v_id := public.mat_somar_celula_compra(p_compra, r.item_id, r.variacao_id, NULL, NULL, v_arred);
      UPDATE public.mat_compra_itens SET qtd_arredondamento = v_arred WHERE id = v_id;
    END IF;
    v_total := v_total + v_arred;
  END LOOP;
  RETURN v_total;
END $function$;

-- ------------------------------------------------------------
-- mat_gerar_compras: + item fracionado, + p_reposicao, + arredondamento.
-- Mantém o lote da 150 e o remanejado da 151.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.mat_gerar_compras(date, text, jsonb, text);
CREATE OR REPLACE FUNCTION public.mat_gerar_compras(p_competencia date, p_tipo text, p_linhas jsonb,
  p_observacao text DEFAULT NULL::text, p_reposicao jsonb DEFAULT NULL::jsonb)
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
  v_item uuid; v_var uuid; v_qtd numeric; n_rep integer := 0; v_frac numeric;  -- 152
BEGIN
  -- Sinal para a guarda de mat_pedido_itens; desligado antes de retornar.
  PERFORM set_config('corh.mat_fase2', 'on', true);
  IF NOT public.pode_comprar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para comprar materiais';
  END IF;
  IF p_tipo NOT IN ('mensal', 'avulsa') THEN RAISE EXCEPTION 'Tipo de compra inválido: %', p_tipo; END IF;
  IF p_linhas IS NOT NULL AND jsonb_typeof(p_linhas) <> 'array' THEN RAISE EXCEPTION 'Linhas inválidas'; END IF;
  IF p_reposicao IS NOT NULL AND jsonb_typeof(p_reposicao) <> 'array' THEN RAISE EXCEPTION 'Reposição inválida'; END IF;
  IF coalesce(jsonb_array_length(p_linhas), 0) = 0 AND coalesce(jsonb_array_length(p_reposicao), 0) = 0 THEN
    RAISE EXCEPTION 'Nenhuma linha informada';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) LOOP
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
      IF v_qc > 0 THEN
        IF v_forn IS NULL OR NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = v_forn) THEN
          RAISE EXCEPTION 'Escolha o fornecedor da linha %', l.id;
        END IF;
        v_compra := public.mat_rascunho_compra(v_comp, v_forn, p_tipo, p_observacao);
        IF NOT v_compra = ANY (v_compras) THEN v_compras := v_compras || v_compra; END IF;
        IF coalesce(it.fracionado_escritorio, false) THEN
          -- 152: item fracionado no escritório — o fornecedor entrega no escritório (célula de
          -- estoque) e o posto é atendido pelo estoque quando a mesa separar.
          v_celula := public.mat_somar_celula_compra(v_compra, l.item_id, l.variacao_id, NULL, NULL, v_qc);
          UPDATE public.mat_compra_itens SET qtd_fracionar = qtd_fracionar + v_qc WHERE id = v_celula;
          v_celula := NULL;
          v_qe := v_qe + v_qc; v_qc := 0;
        ELSE
          v_celula := public.mat_somar_celula_compra(v_compra, l.item_id, l.variacao_id, p.contrato_id,
                        coalesce(p.rota_override, (SELECT rota FROM public.mat_contratos WHERE id = p.contrato_id))::smallint,
                        v_qc);
        END IF;
      END IF;
      v_atend := CASE WHEN v_qc > 0 THEN 'fornecedor' WHEN v_qe > 0 THEN 'estoque' ELSE 'remanejado' END;
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

  -- 152: "comprar a mais para o estoque" — célula de reposição (contrato NULL) na compra do fornecedor.
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_reposicao, '[]'::jsonb)) LOOP
    v_item := nullif(e->>'item_id', '')::uuid;
    v_var := nullif(e->>'variacao_id', '')::uuid;
    v_qtd := nullif(e->>'quantidade', '')::numeric;
    v_forn := nullif(e->>'fornecedor_id', '')::uuid;
    IF v_item IS NULL THEN RAISE EXCEPTION 'Reposição sem item'; END IF;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN RAISE EXCEPTION 'Quantidade a mais para o estoque inválida'; END IF;
    IF v_forn IS NULL OR NOT EXISTS (SELECT 1 FROM public.fornecedores WHERE id = v_forn) THEN
      RAISE EXCEPTION 'Escolha o fornecedor do que vai a mais para o estoque';
    END IF;
    PERFORM public.mat_validar_item_estoque(v_item, v_var);
    v_compra := public.mat_rascunho_compra(v_comp, v_forn, p_tipo, p_observacao);
    IF NOT v_compra = ANY (v_compras) THEN v_compras := v_compras || v_compra; END IF;
    PERFORM public.mat_somar_celula_compra(v_compra, v_item, v_var, NULL, NULL, v_qtd);
    n_rep := n_rep + 1;
  END LOOP;

  -- 152: arredonda cada compra tocada ao múltiplo de compra (a sobra vai à célula de estoque).
  PERFORM public.mat_arredondar_compra(x) FROM unnest(v_compras) x;

  -- 150: cada compra (rascunho) que recebeu linhas nesta chamada guarda o lote, para o cancelamento desfazer
  -- também as linhas sem compra (escritório, estoque, não atendido, remanejado) marcadas na mesma geração.
  UPDATE public.mat_compras SET lotes = array_append(lotes, v_lote)
   WHERE id = ANY (v_compras) AND NOT v_lote = ANY (lotes);

  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(v_pedidos) x;

  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('linhas', n, 'reposicao', n_rep,
    'compras', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'numero', c.numero,
                  'fornecedor_id', c.fornecedor_id, 'antes_da_janela', c.antes_da_janela,
                  'celulas', (SELECT count(*) FROM public.mat_compra_itens ci WHERE ci.compra_id = c.id),
                  'sobra_estoque', (SELECT coalesce(sum(ci.qtd_arredondamento), 0) FROM public.mat_compra_itens ci
                                     WHERE ci.compra_id = c.id))
                  ORDER BY c.numero), '[]'::jsonb)
                  FROM public.mat_compras c WHERE c.id = ANY (v_compras)));
END $function$;

-- ------------------------------------------------------------
-- mat_gerar_compra_reposicao: + arredondamento
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mat_gerar_compra_reposicao(p_fornecedor uuid, p_itens jsonb, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- 152: múltiplo de compra.
  PERFORM public.mat_arredondar_compra(v_compra);
  RETURN jsonb_build_object('id', v_compra, 'numero', (SELECT numero FROM public.mat_compras WHERE id = v_compra),
                            'itens', n);
END $function$;

-- ------------------------------------------------------------
-- mat_previa_compra: + fator/unidade de compra e fracionado
-- ------------------------------------------------------------
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
           -- 152: múltiplo de compra
           'fator_compra', coalesce(it.fator_compra, 1),
           'unidade_compra', nullif(btrim(coalesce(it.unidade_compra, '')), ''),
           'fracionado_escritorio', coalesce(it.fracionado_escritorio, false),
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

-- ------------------------------------------------------------
-- mat_cancelar_compra: + linhas de item fracionado cuja compra estava aqui
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mat_cancelar_compra(p_compra uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.mat_compras%ROWTYPE; v_pedidos uuid[]; n integer; n_lote integer := 0; v_lotes uuid[];
        v_frac uuid[] := '{}';  -- 152
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

  -- 152: linhas de item FRACIONADO no escritório (destino 'estoque') cuja compra (célula de estoque com
  -- qtd_fracionar) está nesta compra: voltam à prévia junto com ela, mesmo que o lote tenha outra compra ativa.
  SELECT coalesce(array_agg(l.id), '{}') INTO v_frac
    FROM public.mat_pedido_itens l
    JOIN public.mat_itens it ON it.id = l.item_id AND it.fracionado_escritorio
   WHERE l.lote_compra = ANY (c.lotes) AND l.compra_item_id IS NULL AND l.atendimento = 'estoque'
     AND EXISTS (SELECT 1 FROM public.mat_compra_itens ci
                  WHERE ci.compra_id = p_compra AND ci.contrato_id IS NULL AND ci.qtd_fracionar > 0
                    AND ci.item_id = l.item_id AND ci.variacao_id IS NOT DISTINCT FROM l.variacao_id);

  IF EXISTS (SELECT 1 FROM public.mat_pedido_itens l
              WHERE ((l.lote_compra = ANY (v_lotes) AND l.compra_item_id IS NULL AND l.atendimento IS NOT NULL)
                     OR l.id = ANY (v_frac))
                AND (l.qtd_entregue_estoque IS NOT NULL OR l.qtd_entregue IS NOT NULL
                     OR l.qtd_entregue_remanejada IS NOT NULL)) THEN
    RAISE EXCEPTION 'Há linhas desta geração (estoque/escritório/remanejado) com entrega já registrada: não dá para cancelar';
  END IF;

  SELECT array_agg(DISTINCT pid) INTO v_pedidos FROM (
    SELECT l.pedido_id AS pid FROM public.mat_pedido_itens l JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
     WHERE ci.compra_id = p_compra
    UNION
    SELECT l.pedido_id FROM public.mat_pedido_itens l
     WHERE (l.lote_compra = ANY (v_lotes) AND l.compra_item_id IS NULL AND l.atendimento IS NOT NULL)
        OR l.id = ANY (v_frac)) s;

  UPDATE public.mat_pedido_itens l
     SET atendimento = NULL, qtd_estoque = NULL, qtd_compra = NULL, compra_item_id = NULL,
         qtd_remanejada = NULL, remanejado_de_contrato_id = NULL, remanejamento_obs = NULL,
         motivo_nao_atendido = NULL, atendimento_por = NULL, atendimento_em = NULL, lote_compra = NULL
    FROM public.mat_compra_itens ci
   WHERE ci.id = l.compra_item_id AND ci.compra_id = p_compra;
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Linhas da mesma geração que não foram para a compra (escritório / estoque / não atendido / remanejado)
  -- e (152) as de item fracionado compradas nesta compra.
  UPDATE public.mat_pedido_itens l
     SET atendimento = NULL, qtd_estoque = NULL, qtd_compra = NULL, compra_item_id = NULL,
         qtd_remanejada = NULL, remanejado_de_contrato_id = NULL, remanejamento_obs = NULL,
         motivo_nao_atendido = NULL, atendimento_por = NULL, atendimento_em = NULL, lote_compra = NULL
   WHERE (l.lote_compra = ANY (v_lotes) AND l.compra_item_id IS NULL AND l.atendimento IS NOT NULL)
      OR l.id = ANY (v_frac);
  GET DIAGNOSTICS n_lote = ROW_COUNT;

  UPDATE public.mat_compras
     SET status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(), cancelada_motivo = p_motivo
   WHERE id = p_compra;
  -- O status do pedido volta a ser calculado pelas linhas (em_compra -> aprovado quando restam linhas sem destino).
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(coalesce(v_pedidos, '{}')) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('id', p_compra, 'linhas_liberadas', n + n_lote, 'linhas_da_compra', n, 'linhas_da_geracao', n_lote);
END $function$;

-- ------------------------------------------------------------
-- Permissões das funções
-- ------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mat_previa_compra(date)',
    'public.mat_gerar_compras(date, text, jsonb, text, jsonb)',
    'public.mat_gerar_compra_reposicao(uuid, jsonb, text)',
    'public.mat_cancelar_compra(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
  -- Internas (sem checagem de perfil própria): nunca expostas ao PostgREST.
  FOREACH f IN ARRAY ARRAY[
    'public.mat_somar_celula_compra(uuid, uuid, uuid, uuid, smallint, numeric)',
    'public.mat_arredondar_compra(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ============================================================
-- Conferência final (aborta se algo não bater)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname LIKE 'mat\_%' ESCAPE '\'
                AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%') THEN
    RAISE EXCEPTION '152: função mat_* com caractere corrompido (chr 65533) — aplique pelo script de ARQUIVO UTF-8';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'mat_gerar_compras') <> 1 THEN
    RAISE EXCEPTION '152: deveria existir exatamente uma mat_gerar_compras';
  END IF;
  IF (SELECT count(*) FROM pg_constraint
       WHERE conname IN ('mat_itens_fator_compra_ck', 'mat_itens_unidade_compra_ck', 'mat_itens_fracionado_ck',
                         'mat_compra_itens_multiplo_ck')) <> 4 THEN
    RAISE EXCEPTION '152: constraints do múltiplo de compra ausentes';
  END IF;
END $$;
