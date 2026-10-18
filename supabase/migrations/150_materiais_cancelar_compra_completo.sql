-- ============================================================
-- 150 — Materiais: cancelar a compra desfaz TUDO o que a geração marcou
-- ============================================================
-- Bug (18/10/2026, achado na compra de teste): mat_cancelar_compra só devolvia à prévia as linhas ligadas à
-- compra por compra_item_id (destino 'fornecedor'). Linhas que a MESMA geração (mat_gerar_compras) marcou sem
-- compra — 'escritorio' (itens preparo_escritorio), 'estoque' puro e 'nao_atendido' — ficavam com destino, e o
-- pedido cujas linhas eram só dessas ficava 'em_compra' (v_pedidos saía vazio, então nada o recalculava).
--
-- Correção:
--  * mat_pedido_itens.lote_compra (uuid): cada chamada de mat_gerar_compras gera um lote e marca todas as linhas
--    que tocou; mat_compras.lotes (uuid[]) guarda os lotes de que a compra participou.
--  * mat_cancelar_compra: além das linhas da compra, devolve as linhas sem compra dos lotes dessa compra — SÓ dos
--    lotes que não têm outra compra ativa (se outra compra do mesmo lote continua, aquelas linhas também são dela
--    e ficam). Recalcula o status de TODOS os pedidos afetados com mat_recalcular_status_entrega (em_compra volta
--    para aprovado quando restam linhas sem destino). Bloqueia se alguma dessas linhas já tem entrega registrada.
--  * Compras antigas (sem lote) mantêm o comportamento anterior para as linhas sem compra: nada a desfazer por lote
--    (limitação conhecida — sem backfill; a compra de teste já foi apagada).
--  * Lembrete para a migration 148 (compra da Beth): se recriar mat_gerar_compras, manter v_lote / lote_compra / lotes.
-- Recriadas a partir do pg_get_functiondef real (mat_gerar_compras só ganha o lote). CREATE OR REPLACE preserva os
-- privilégios de EXECUTE já concedidos. Sem tabela nova — sem GRANT.
-- Idempotente. NÃO aplicada.
-- ============================================================

ALTER TABLE public.mat_pedido_itens ADD COLUMN IF NOT EXISTS lote_compra uuid;
COMMENT ON COLUMN public.mat_pedido_itens.lote_compra IS
  'Geração de compra (mat_gerar_compras) que marcou o destino da linha; usada por mat_cancelar_compra (150).';
CREATE INDEX IF NOT EXISTS mat_pedido_itens_lote_compra_idx ON public.mat_pedido_itens (lote_compra) WHERE lote_compra IS NOT NULL;
ALTER TABLE public.mat_compras ADD COLUMN IF NOT EXISTS lotes uuid[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.mat_compras.lotes IS 'Lotes de geração (mat_pedido_itens.lote_compra) de que esta compra participou (150).';

CREATE OR REPLACE FUNCTION public.mat_gerar_compras(p_competencia date, p_tipo text, p_linhas jsonb, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comp date := date_trunc('month', p_competencia)::date;
  e jsonb; l public.mat_pedido_itens%ROWTYPE; p public.mat_pedidos%ROWTYPE; it public.mat_itens%ROWTYPE;
  v_qe numeric; v_qc numeric; v_forn uuid; v_motivo text; v_nao boolean; v_atend text;
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
           atendimento_por = auth.uid(), atendimento_em = now(),
           lote_compra = v_lote
     WHERE id = l.id;
    IF NOT l.pedido_id = ANY (v_pedidos) THEN v_pedidos := v_pedidos || l.pedido_id; END IF;
    n := n + 1;
  END LOOP;

  -- 150: cada compra (rascunho) que recebeu linhas nesta chamada guarda o lote, para o cancelamento desfazer
  -- também as linhas sem compra (escritório, estoque, não atendido) marcadas na mesma geração.
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
END $function$
;

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

  -- 150: lotes (gerações) desta compra que NÃO têm mais nenhuma outra compra ativa. Só nesses lotes as linhas sem
  -- compra (escritório, estoque, não atendido) voltam para a prévia; se outra compra do mesmo lote continua
  -- ativa, essas linhas pertencem também à geração dela e ficam como estão.
  SELECT coalesce(array_agg(x), '{}') INTO v_lotes
    FROM unnest(c.lotes) x
   WHERE NOT EXISTS (SELECT 1 FROM public.mat_compras o
                      WHERE o.id <> p_compra AND o.status <> 'cancelada' AND x = ANY (o.lotes));
  IF EXISTS (SELECT 1 FROM public.mat_pedido_itens l
              WHERE l.lote_compra = ANY (v_lotes) AND l.compra_item_id IS NULL AND l.atendimento IS NOT NULL
                AND (l.qtd_entregue_estoque IS NOT NULL OR l.qtd_entregue IS NOT NULL)) THEN
    RAISE EXCEPTION 'Há linhas desta geração (estoque/escritório) com entrega já registrada: não dá para cancelar';
  END IF;

  SELECT array_agg(DISTINCT pid) INTO v_pedidos FROM (
    SELECT l.pedido_id AS pid FROM public.mat_pedido_itens l JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
     WHERE ci.compra_id = p_compra
    UNION
    SELECT l.pedido_id FROM public.mat_pedido_itens l
     WHERE l.lote_compra = ANY (v_lotes) AND l.compra_item_id IS NULL AND l.atendimento IS NOT NULL) s;

  UPDATE public.mat_pedido_itens l
     SET atendimento = NULL, qtd_estoque = NULL, qtd_compra = NULL, compra_item_id = NULL,
         motivo_nao_atendido = NULL, atendimento_por = NULL, atendimento_em = NULL, lote_compra = NULL
    FROM public.mat_compra_itens ci
   WHERE ci.id = l.compra_item_id AND ci.compra_id = p_compra;
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Linhas da mesma geração que não foram para a compra (escritório / estoque / não atendido).
  UPDATE public.mat_pedido_itens l
     SET atendimento = NULL, qtd_estoque = NULL, qtd_compra = NULL, compra_item_id = NULL,
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
