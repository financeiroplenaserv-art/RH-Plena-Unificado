-- ============================================================
-- 177 — CEU → Pedidos: "Atender selecionadas" LANÇA a entrega no CEU
--       + "Trocar contrato" da linha da fila
-- ============================================================
-- Decisões da gestora (26/11 e 28/11/2026 — docs/HANDOFF_26-11-2026_MATERIAIS_EPI.md):
--   * Antes a Beth registrava duas vezes ("Atender selecionadas" + Lançamento rápido).
--     Agora atender cria as entregas do CEU e marca as linhas, NUMA transação só.
--   * Data da entrega = escolhida na janela (sugestão: dia 1º do mês do pedido).
--   * Situação "Troca" (regra do CEU). NÃO emite recibo (o recibo segue pelo caminho atual).
--   * Entregou menos → lança só o que entregou (atendida parcial com motivo, regra da 124).
--   * snapshot_item montado NO SERVIDOR a partir de `itens` no momento do lançamento,
--     com as MESMAS chaves do Lançamento rápido (nome, codigo, tipo, ca, valor,
--     prazo_uso_dias) — o CA do recibo continua sendo o CA do snapshot.
--   * "Trocar contrato": move a linha (ainda não atendida) para o pedido MENSAL do mesmo
--     mês do contrato certo, criando o pedido se não existir; motivo obrigatório,
--     registrado em mat_comentarios. NÃO altera o cadastro do colaborador.
--
-- Sem tabela nova — sem GRANT de tabela. EXECUTE explícito nas 2 RPCs novas.
-- `atender_linhas_pedido_ceu` (124) NÃO muda (fica como estava; o frontend novo
-- deixa de chamá-la). Funções lidas do pg_get_functiondef real de 28/11/2026,
-- backup em dados-locais/backup_ceu_177_2026-11-28/.
-- ============================================================

-- ------------------------------------------------------------
-- A) Vínculo linha → entrega (rastreio e anti-duplicidade)
-- ------------------------------------------------------------
ALTER TABLE public.ceu_pedido_itens
  ADD COLUMN IF NOT EXISTS entrega_id uuid REFERENCES public.entregas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ceu_pedido_itens.entrega_id IS
  'Entrega do CEU lançada pelo atendimento da linha (migration 177). Uma entrega serve a uma linha só.';

-- Uma entrega nunca atende duas linhas; uma linha com entrega não lança de novo
-- (a RPC também pula linha já atendida).
CREATE UNIQUE INDEX IF NOT EXISTS ceu_pedido_itens_entrega_uq
  ON public.ceu_pedido_itens (entrega_id) WHERE entrega_id IS NOT NULL;

-- ------------------------------------------------------------
-- B) Recalcula o status_ceu de um pedido a partir das linhas (interna)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ceu_recalcular_status_pedido(p_pedido uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_total integer; v_ident integer; v_abertas integer; v_atendidas integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE status IN ('a_identificar', 'pendente')),
         count(*) FILTER (WHERE status IN ('conferido', 'ajustado')),
         count(*) FILTER (WHERE status = 'atendido')
    INTO v_total, v_ident, v_abertas, v_atendidas
    FROM public.ceu_pedido_itens WHERE pedido_id = p_pedido;

  UPDATE public.mat_pedidos
     SET status_ceu = CASE
           WHEN v_total = 0 THEN 'nao_se_aplica'
           WHEN v_ident > 0 THEN 'em_identificacao'
           WHEN v_abertas > 0 AND v_atendidas > 0 THEN 'em_atendimento'
           WHEN v_abertas > 0 THEN 'conferido'
           ELSE 'atendido' END
   WHERE id = p_pedido;
END $function$;

REVOKE ALL ON FUNCTION public.ceu_recalcular_status_pedido(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ceu_recalcular_status_pedido(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ceu_recalcular_status_pedido(uuid) TO service_role;

-- ------------------------------------------------------------
-- C) Atender E lançar a entrega no CEU (transação única)
-- ------------------------------------------------------------
-- p_linhas: [{ "id": uuid, "qtd_atendida": int|null, "motivo": text|null }]
-- p_data:   data da entrega (a tela sugere o dia 1º do mês do pedido).
-- Retorno:  { atendidas, entregas_criadas, ja_atendidas, linhas: [{id, entrega_id, ja_atendida}] }
-- Idempotente por linha: linha que já está 'atendido' é pulada (devolvida com
-- ja_atendida = true) — um reenvio depois de falha de rede não duplica entrega.
CREATE OR REPLACE FUNCTION public.atender_e_lancar_linhas_pedido_ceu(p_linhas jsonb, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE e jsonb; l public.ceu_pedido_itens%ROWTYPE; it public.itens%ROWTYPE;
        v_base integer; v_qtd integer; v_motivo text; r record;
        v_uid uuid := auth.uid();
        v_matricula text; v_entrega uuid;
        n integer := 0; v_criadas integer := 0; v_ja integer := 0;
        v_saida jsonb := '[]'::jsonb;
        v_ids uuid[];
BEGIN
  IF NOT public.pode_atender_pedido_ceu() THEN
    RAISE EXCEPTION 'Sem permissão para atender pedidos';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Informe a data da entrega';
  END IF;
  IF jsonb_typeof(coalesce(p_linhas, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_linhas, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Nenhuma linha para atender';
  END IF;

  SELECT array_agg((x->>'id')::uuid) INTO v_ids FROM jsonb_array_elements(p_linhas) x;
  IF (SELECT count(DISTINCT u) FROM unnest(v_ids) u) <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'A mesma linha veio mais de uma vez';
  END IF;

  -- Trava os pedidos (ordem fixa, sem deadlock entre duas abas).
  FOR r IN SELECT DISTINCT pedido_id FROM public.ceu_pedido_itens WHERE id = ANY (v_ids) ORDER BY pedido_id LOOP
    PERFORM 1 FROM public.mat_pedidos WHERE id = r.pedido_id FOR UPDATE;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(p_linhas) LOOP
    SELECT * INTO l FROM public.ceu_pedido_itens WHERE id = (e->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não encontrada', e->>'id'; END IF;

    IF l.status = 'atendido' THEN
      v_ja := v_ja + 1;
      v_saida := v_saida || jsonb_build_object('id', l.id, 'entrega_id', l.entrega_id, 'ja_atendida', true);
      CONTINUE;
    END IF;
    IF l.status NOT IN ('conferido', 'ajustado') THEN
      RAISE EXCEPTION 'Só linhas conferidas podem ser atendidas (linha %)', l.id;
    END IF;
    IF l.entrega_id IS NOT NULL THEN
      RAISE EXCEPTION 'A linha % já tem entrega lançada', l.id;
    END IF;
    IF l.colaborador_id IS NULL THEN
      RAISE EXCEPTION 'Identifique o colaborador da linha % antes de atender', l.id;
    END IF;

    v_base := coalesce(l.qtd_conferida, l.qtd_pedida);
    v_qtd := coalesce(nullif(e->>'qtd_atendida', '')::integer, v_base);
    v_motivo := nullif(btrim(coalesce(e->>'motivo', '')), '');
    IF v_qtd < 0 OR v_qtd > v_base THEN
      RAISE EXCEPTION 'Quantidade entregue inválida na linha % (conferido: %)', l.id, v_base;
    END IF;
    IF v_qtd < v_base AND v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo da entrega menor na linha %', l.id;
    END IF;

    v_entrega := NULL;
    -- Crachá não é item do CEU (sem item_id): só marca atendida, como antes.
    -- Quantidade 0 (não entregou nada, com motivo) também não gera entrega.
    IF l.tipo <> 'cracha' AND l.item_id IS NOT NULL AND v_qtd > 0 THEN
      SELECT * INTO it FROM public.itens WHERE id = l.item_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Item da linha % não existe no CEU', l.id; END IF;
      IF it.situacao = 'I' THEN
        RAISE EXCEPTION 'O item "%" está inativo no CEU (linha %)', it.nome, l.id;
      END IF;
      SELECT c.matricula INTO v_matricula FROM public.colaboradores c WHERE c.id = l.colaborador_id;

      -- Mesmo formato do Lançamento rápido (CeuLancamentoRapidoPage): situacao e
      -- observacao = 'Troca'; snapshot = foto do item AGORA (CA do recibo).
      INSERT INTO public.entregas (colaborador_id, item_id, data_entrega, quantidade,
        observacao, usuario_id, snapshot_item, situacao, matricula)
      VALUES (l.colaborador_id, l.item_id, p_data, v_qtd,
        'Troca', v_uid,
        jsonb_build_object(
          'nome', it.nome,
          'codigo', coalesce(it.codigo, ''),
          'tipo', it.tipo,
          'ca', coalesce(it.ca, ''),
          'valor', nullif(it.valor, 0),
          'prazo_uso_dias', nullif(it.prazo_uso_dias, 0)),
        'Troca', v_matricula)
      RETURNING id INTO v_entrega;
      v_criadas := v_criadas + 1;
    END IF;

    UPDATE public.ceu_pedido_itens
       SET status = 'atendido', qtd_atendida = v_qtd, motivo_atendimento = v_motivo,
           atendido_por = v_uid, atendido_em = now(), entrega_id = v_entrega
     WHERE id = l.id;
    n := n + 1;
    v_saida := v_saida || jsonb_build_object('id', l.id, 'entrega_id', v_entrega, 'ja_atendida', false);
  END LOOP;

  FOR r IN SELECT DISTINCT c.pedido_id FROM public.ceu_pedido_itens c WHERE c.id = ANY (v_ids) LOOP
    UPDATE public.mat_pedidos p
       SET status_ceu = CASE WHEN NOT EXISTS (
             SELECT 1 FROM public.ceu_pedido_itens c
              WHERE c.pedido_id = r.pedido_id AND c.status NOT IN ('atendido', 'cancelado'))
           THEN 'atendido' ELSE 'em_atendimento' END
     WHERE p.id = r.pedido_id;
  END LOOP;

  RETURN jsonb_build_object('atendidas', n, 'entregas_criadas', v_criadas,
                            'ja_atendidas', v_ja, 'linhas', v_saida);
END $function$;

REVOKE ALL ON FUNCTION public.atender_e_lancar_linhas_pedido_ceu(jsonb, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atender_e_lancar_linhas_pedido_ceu(jsonb, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.atender_e_lancar_linhas_pedido_ceu(jsonb, date) TO authenticated, service_role;

-- ------------------------------------------------------------
-- D) Trocar o contrato de uma linha da fila
-- ------------------------------------------------------------
-- Move a linha para o pedido MENSAL do mesmo mês do contrato certo (cria se não
-- existir, no mesmo formato do pedido mensal: status_produtos 'nao_se_aplica',
-- origem 'escritorio'). Motivo obrigatório (vai para mat_comentarios nos dois
-- pedidos). p_fora_da_equipe: a tela recalcula pela equipe do contrato novo;
-- NULL mantém o valor da linha. Não mexe no cadastro do colaborador.
CREATE OR REPLACE FUNCTION public.trocar_contrato_linha_pedido_ceu(
  p_linha uuid, p_contrato uuid, p_motivo text, p_fora_da_equipe boolean DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.ceu_pedido_itens%ROWTYPE; v_orig public.mat_pedidos%ROWTYPE;
        v_dest uuid; v_criado boolean := false; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
        v_nome_orig text; v_nome_dest text; v_autor text; v_texto text;
BEGIN
  IF NOT (public.pode_atender_pedido_ceu() OR public.pode_validar_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para trocar o contrato da linha';
  END IF;
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da troca de contrato';
  END IF;

  SELECT * INTO l FROM public.ceu_pedido_itens WHERE id = p_linha FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha não encontrada'; END IF;
  IF l.status IN ('atendido', 'cancelado') OR l.entrega_id IS NOT NULL THEN
    RAISE EXCEPTION 'Só linhas ainda não atendidas podem trocar de contrato';
  END IF;

  SELECT * INTO v_orig FROM public.mat_pedidos WHERE id = l.pedido_id FOR UPDATE;
  IF v_orig.contrato_id = p_contrato THEN
    RAISE EXCEPTION 'A linha já está neste contrato';
  END IF;
  SELECT nome INTO v_nome_dest FROM public.mat_contratos WHERE id = p_contrato AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato inexistente ou inativo'; END IF;
  SELECT nome INTO v_nome_orig FROM public.mat_contratos WHERE id = v_orig.contrato_id;

  -- Mesmo lock do mat_registrar_envio: o link do líder não cria um 2º mensal ao mesmo tempo.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contrato::text || v_orig.competencia::text, 0));

  SELECT id INTO v_dest FROM public.mat_pedidos
   WHERE contrato_id = p_contrato AND competencia = v_orig.competencia
     AND tipo = 'mensal' AND status_produtos <> 'cancelado'
   FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.mat_pedidos (contrato_id, competencia, tipo, origem, preenchido_pelo_escritorio,
      responsavel_nome, observacao, status_produtos, status_ceu, enviado_em, criado_por, sem_necessidade)
    VALUES (p_contrato, v_orig.competencia, 'mensal', 'escritorio', true,
      'Escritório', 'Criado ao mover linha de uniforme/EPI/crachá de outro contrato',
      'nao_se_aplica', 'enviado', now(), auth.uid(), false)
    RETURNING id INTO v_dest;
    v_criado := true;
  END IF;

  UPDATE public.ceu_pedido_itens
     SET pedido_id = v_dest, fora_da_equipe = coalesce(p_fora_da_equipe, fora_da_equipe)
   WHERE id = l.id;

  SELECT nome INTO v_autor FROM public.perfis WHERE id = auth.uid();
  v_texto := 'Linha movida de ' || coalesce(v_nome_orig, 'contrato') || ' para ' || v_nome_dest
             || ' (' || l.nome_digitado || '). Motivo: ' || v_motivo;
  INSERT INTO public.mat_comentarios (pedido_id, linha_tabela, linha_id, autor_id, autor_nome, texto)
  VALUES (v_dest, 'ceu_pedido_itens', l.id, auth.uid(), v_autor, v_texto),
         (v_orig.id, 'ceu_pedido_itens', l.id, auth.uid(), v_autor, v_texto);

  PERFORM public.ceu_recalcular_status_pedido(v_orig.id);
  PERFORM public.ceu_recalcular_status_pedido(v_dest);

  RETURN jsonb_build_object('pedido_id', v_dest, 'pedido_criado', v_criado, 'pedido_origem_id', v_orig.id);
END $function$;

REVOKE ALL ON FUNCTION public.trocar_contrato_linha_pedido_ceu(uuid, uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trocar_contrato_linha_pedido_ceu(uuid, uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.trocar_contrato_linha_pedido_ceu(uuid, uuid, text, boolean) TO authenticated, service_role;

-- ------------------------------------------------------------
-- E) Trava de acento: nenhuma função tocada pode ter U+FFFD
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('ceu_recalcular_status_pedido', 'atender_e_lancar_linhas_pedido_ceu',
                         'trocar_contrato_linha_pedido_ceu')
       AND strpos(pg_get_functiondef(p.oid), chr(65533)) > 0
  ) THEN
    RAISE EXCEPTION 'Acento corrompido (U+FFFD) em função da migration 177 — aplique pelo script de arquivo UTF-8';
  END IF;
END $$;
