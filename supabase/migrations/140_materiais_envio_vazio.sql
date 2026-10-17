-- ============================================================
-- 140 — Materiais: envio vazio ("o posto não precisa de nada este mês")
-- ============================================================
-- Retorno da gestora (17/10/2026): ao abrir o link e não pedir nada, o líder
-- não conseguia concluir. Agora pode — o envio vazio fica REGISTRADO como
-- resposta do posto:
--   * mat_pedidos.sem_necessidade (boolean, default false): pedido mensal
--     criado por envio sem nenhuma linha (status_produtos e status_ceu
--     'nao_se_aplica' — não entra na fila do inspetor nem do gestor).
--   * mat_registrar_envio deixa de recusar "Pedido sem itens". Envio vazio:
--     - sem pedido no mês → cria o pedido mensal com sem_necessidade = true e
--       o envio original (protocolo normal);
--     - mês que já tem pedido (kit confirmado, uniformes etc.) → IGNORADO:
--       nada é alterado, só o log de acesso; devolve ja_havia_pedido = true e
--       o protocolo do primeiro envio.
--     Se depois chega um pedido de verdade, ele soma ao pedido (complemento) e
--     sem_necessidade volta para false.
--   * mat_contratos_sem_pedido não lista mais quem respondeu "não preciso".
-- Função recriada a partir da definição da migration 135 (mat_registrar_envio)
-- e da 124 (mat_contratos_sem_pedido). Sem tabela nova — sem GRANT de tabela.
-- Backup: dados-locais/backup_materiais_140_2026-10-17/
-- ============================================================

ALTER TABLE public.mat_pedidos
  ADD COLUMN IF NOT EXISTS sem_necessidade boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.mat_pedidos.sem_necessidade IS
  'O posto respondeu pelo link que não precisa de nada este mês (envio sem linhas). Migration 140.';

CREATE OR REPLACE FUNCTION public.mat_registrar_envio(p_contrato uuid, p_hoje date, p_seu_nome text, p_termos jsonb, p_observacao text, p_ip inet, p_user_agent text, p_produtos jsonb, p_ceu jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_zero constant uuid := '00000000-0000-0000-0000-000000000000';
  v_comp date := date_trunc('month', p_hoje)::date;
  v_prod jsonb := coalesce(p_produtos, '[]'::jsonb);
  v_ceu jsonb := coalesce(p_ceu, '[]'::jsonb);
  v_tem_prod boolean := jsonb_array_length(coalesce(p_produtos, '[]'::jsonb)) > 0;
  v_tem_ceu boolean := jsonb_array_length(coalesce(p_ceu, '[]'::jsonb)) > 0;
  -- Envio sem nenhuma linha = "o posto respondeu: não precisa de nada este mês".
  v_vazio boolean := NOT (jsonb_array_length(coalesce(p_produtos, '[]'::jsonb)) > 0 OR jsonb_array_length(coalesce(p_ceu, '[]'::jsonb)) > 0);
  v_auto boolean := public.mat_kit_aprovacao_automatica();
  v_kit_ja boolean := false;
  v_tem_extra boolean := false;
  v_tem_kit boolean := false;
  v_ped public.mat_pedidos%ROWTYPE;
  v_achou boolean := false;
  v_ped_prod uuid; v_env_prod uuid;
  v_ped_ceu uuid;  v_env_ceu uuid;
  v_ped_extra uuid; v_env_extra uuid;
  v_mensal_id uuid; v_env_mensal uuid;
  v_merge_prod boolean := false; v_merge_ceu boolean := false;
  v_extra_prod boolean := false; v_extra_ceu boolean := false;
  v_seq smallint;
  v_status_prod_novo text;
  e jsonb; v_rep uuid; v_flag boolean; v_tipo text;
  v_colab uuid; v_item uuid;
  v_parte text; v_qtd numeric; v_auto_linha boolean; v_acima boolean;
  v_protocolo_env uuid;
BEGIN
  IF btrim(coalesce(p_seu_nome, '')) = '' THEN
    RAISE EXCEPTION 'Informe o seu nome';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mat_contratos WHERE id = p_contrato AND ativo) THEN
    RAISE EXCEPTION 'Contrato inexistente ou inativo';
  END IF;

  -- Dois envios simultâneos do mesmo contrato/mês não criam dois pedidos.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contrato::text || v_comp::text, 0));

  SELECT * INTO v_ped FROM public.mat_pedidos
   WHERE contrato_id = p_contrato AND competencia = v_comp
     AND tipo = 'mensal' AND status_produtos <> 'cancelado'
   FOR UPDATE;
  v_achou := FOUND;

  -- Kit do mês já confirmado (linhas 'kit' em qualquer pedido não cancelado
  -- do contrato na competência): o kit não vem duas vezes.
  SELECT EXISTS (
    SELECT 1 FROM public.mat_pedido_itens i JOIN public.mat_pedidos p ON p.id = i.pedido_id
     WHERE p.contrato_id = p_contrato AND p.competencia = v_comp
       AND p.status_produtos <> 'cancelado' AND i.parte = 'kit'
  ) INTO v_kit_ja;

  SELECT coalesce(bool_or(coalesce(nullif(x->>'qtd_pedida', '')::numeric, 0) > 0
                          AND (coalesce(x->>'parte', 'extra') <> 'kit' OR v_kit_ja)), false),
         coalesce(bool_or(x->>'parte' = 'kit' AND NOT v_kit_ja), false)
    INTO v_tem_extra, v_tem_kit
    FROM jsonb_array_elements(v_prod) x;
  v_status_prod_novo := CASE WHEN NOT v_tem_prod THEN 'nao_se_aplica'
                             WHEN v_tem_extra THEN 'em_validacao'
                             WHEN v_auto THEN 'aprovado'
                             ELSE 'validado' END;

  IF NOT v_achou THEN
    INSERT INTO public.mat_pedidos (contrato_id, competencia, tipo, origem, responsavel_nome,
      observacao, termos_aceitos, status_produtos, status_ceu, enviado_em, sem_necessidade)
    VALUES (p_contrato, v_comp, 'mensal', 'lider', btrim(p_seu_nome), p_observacao, p_termos,
      v_status_prod_novo, CASE WHEN v_tem_ceu THEN 'enviado' ELSE 'nao_se_aplica' END, now(), v_vazio)
    RETURNING id INTO v_mensal_id;
    INSERT INTO public.mat_pedido_envios (pedido_id, sequencia, origem, seu_nome, ip, user_agent)
    VALUES (v_mensal_id, 1, 'original', btrim(p_seu_nome), p_ip, p_user_agent)
    RETURNING id INTO v_env_mensal;
    v_protocolo_env := v_env_mensal;
    v_ped_prod := v_mensal_id; v_env_prod := v_env_mensal;
    v_ped_ceu := v_mensal_id;  v_env_ceu := v_env_mensal;
  ELSE
    v_mensal_id := v_ped.id;
    v_merge_prod := v_tem_prod AND v_ped.status_produtos IN ('rascunho', 'nao_se_aplica', 'enviado', 'em_validacao', 'validado');
    v_merge_ceu  := v_tem_ceu  AND v_ped.status_ceu IN ('nao_se_aplica', 'enviado', 'em_identificacao');
    v_extra_prod := v_tem_prod AND NOT v_merge_prod;
    v_extra_ceu  := v_tem_ceu  AND NOT v_merge_ceu;

    IF v_merge_prod OR v_merge_ceu THEN
      -- Um pedido de verdade chegou: deixa de ser "sem necessidade".
      UPDATE public.mat_pedidos SET sem_necessidade = false WHERE id = v_mensal_id AND sem_necessidade;
      SELECT coalesce(max(sequencia), 0) + 1 INTO v_seq FROM public.mat_pedido_envios WHERE pedido_id = v_mensal_id;
      INSERT INTO public.mat_pedido_envios (pedido_id, sequencia, origem, seu_nome, ip, user_agent)
      VALUES (v_mensal_id, v_seq, 'complemento', btrim(p_seu_nome), p_ip, p_user_agent)
      RETURNING id INTO v_env_mensal;
      v_protocolo_env := v_env_mensal;
      IF v_merge_prod THEN
        v_ped_prod := v_mensal_id; v_env_prod := v_env_mensal;
        IF v_tem_extra THEN
          UPDATE public.mat_pedidos SET status_produtos = 'em_validacao' WHERE id = v_mensal_id;
        ELSIF v_ped.status_produtos IN ('nao_se_aplica', 'enviado', 'rascunho') THEN
          UPDATE public.mat_pedidos SET status_produtos = v_status_prod_novo WHERE id = v_mensal_id;
        END IF;
      END IF;
      IF v_merge_ceu THEN
        v_ped_ceu := v_mensal_id; v_env_ceu := v_env_mensal;
        IF v_ped.status_ceu = 'nao_se_aplica' THEN
          UPDATE public.mat_pedidos SET status_ceu = 'enviado' WHERE id = v_mensal_id;
        END IF;
      END IF;
    END IF;

    IF v_extra_prod OR v_extra_ceu THEN
      INSERT INTO public.mat_pedidos (contrato_id, competencia, tipo, origem, responsavel_nome,
        observacao, termos_aceitos, status_produtos, status_ceu, enviado_em)
      VALUES (p_contrato, v_comp, 'extra', 'lider', btrim(p_seu_nome), p_observacao, p_termos,
        CASE WHEN v_extra_prod THEN v_status_prod_novo ELSE 'nao_se_aplica' END,
        CASE WHEN v_extra_ceu THEN 'enviado' ELSE 'nao_se_aplica' END, now())
      RETURNING id INTO v_ped_extra;
      INSERT INTO public.mat_pedido_envios (pedido_id, sequencia, origem, seu_nome, ip, user_agent)
      VALUES (v_ped_extra, 1, 'original', btrim(p_seu_nome), p_ip, p_user_agent)
      RETURNING id INTO v_env_extra;
      IF v_protocolo_env IS NULL THEN v_protocolo_env := v_env_extra; END IF;
      IF v_extra_prod THEN v_ped_prod := v_ped_extra; v_env_prod := v_env_extra; END IF;
      IF v_extra_ceu THEN v_ped_ceu := v_ped_extra; v_env_ceu := v_env_extra; END IF;
    END IF;
  END IF;

  -- Envio vazio sobre um mês que já tem pedido: nada muda (decisão de
  -- 17/10/2026); o protocolo devolvido é o do primeiro envio do pedido.
  IF v_vazio AND v_protocolo_env IS NULL THEN
    SELECT id INTO v_protocolo_env FROM public.mat_pedido_envios WHERE pedido_id = v_mensal_id ORDER BY sequencia LIMIT 1;
  END IF;

  -- Linhas de produtos. Repetição = só aviso (mesmo item e variação em outro
  -- envio do mesmo pedido; linha zerada do kit não gera aviso).
  IF v_tem_prod THEN
    FOR e IN SELECT * FROM jsonb_array_elements(v_prod) LOOP
      v_qtd := (e->>'qtd_pedida')::numeric;
      v_parte := CASE WHEN e->>'parte' = 'kit' AND NOT v_kit_ja THEN 'kit' ELSE 'extra' END;
      -- Linha de kit convertida (kit já confirmado): conta como "a mais".
      v_acima := coalesce((e->>'excecao_acima_kit')::boolean, false)
                 OR (e->>'parte' = 'kit' AND v_kit_ja AND nullif(e->>'item_id', '') IS NOT NULL);
      IF v_parte = 'extra' AND v_qtd <= 0 THEN CONTINUE; END IF;
      v_auto_linha := v_parte = 'kit' AND v_auto;
      v_rep := NULL;
      IF nullif(e->>'item_id', '') IS NOT NULL AND v_qtd > 0 THEN
        SELECT i.id INTO v_rep FROM public.mat_pedido_itens i
         WHERE i.pedido_id = v_ped_prod AND i.envio_id IS DISTINCT FROM v_env_prod
           AND i.item_id = (e->>'item_id')::uuid
           AND coalesce(i.variacao_id, v_zero) = coalesce(nullif(e->>'variacao_id', '')::uuid, v_zero)
           AND i.qtd_pedida > 0
         ORDER BY i.created_at LIMIT 1;
      END IF;
      INSERT INTO public.mat_pedido_itens (pedido_id, envio_id, possivel_repeticao, repete_linha_id,
        item_id, variacao_id, descricao_livre, qtd_kit, qtd_pedida, qtd_validada, qtd_aprovada,
        preco_unitario, justificativa,
        excecao_acima_kit, excecao_validade, excecao_fora_kit, ultima_entrega_em,
        parte, aprovado_automatico)
      VALUES (v_ped_prod, v_env_prod, v_rep IS NOT NULL, v_rep,
        nullif(e->>'item_id', '')::uuid, nullif(e->>'variacao_id', '')::uuid,
        nullif(btrim(coalesce(e->>'descricao_livre', '')), ''),
        nullif(e->>'qtd_kit', '')::numeric, v_qtd,
        CASE WHEN v_auto_linha THEN v_qtd END,
        CASE WHEN v_auto_linha THEN v_qtd END,
        nullif(e->>'preco_unitario', '')::numeric, nullif(btrim(coalesce(e->>'justificativa', '')), ''),
        CASE WHEN v_parte = 'kit' THEN false ELSE v_acima END,
        coalesce((e->>'excecao_validade')::boolean, false),
        CASE WHEN v_parte = 'kit' THEN false ELSE coalesce((e->>'excecao_fora_kit')::boolean, false) END,
        nullif(e->>'ultima_entrega_em', '')::date,
        v_parte, v_auto_linha);
    END LOOP;
  END IF;

  -- Linhas de uniforme/EPI/crachá (inalterado desde a 129). Aviso de
  -- repetição: uniforme/EPI só com mesma pessoa + mesma peça + mesmo
  -- tamanho; crachá com a mesma pessoa no mês (qualquer pedido não cancelado
  -- do contrato na competência). "Mesma pessoa" = mesmo colaborador_id ou
  -- mesmo nome digitado normalizado.
  IF v_tem_ceu THEN
    FOR e IN SELECT * FROM jsonb_array_elements(v_ceu) LOOP
      v_tipo := e->>'tipo';
      v_colab := nullif(e->>'colaborador_id', '')::uuid;
      IF v_colab IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.colaboradores WHERE id = v_colab) THEN
        v_colab := NULL;
      END IF;
      v_item := CASE WHEN v_tipo = 'cracha' THEN NULL ELSE nullif(e->>'item_id', '')::uuid END;
      IF v_tipo = 'cracha' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.ceu_pedido_itens c
            JOIN public.mat_pedidos p ON p.id = c.pedido_id
           WHERE p.contrato_id = p_contrato AND p.competencia = v_comp
             AND p.status_ceu <> 'cancelado' AND c.status <> 'cancelado'
             AND c.tipo = 'cracha' AND c.envio_id IS DISTINCT FROM v_env_ceu
             AND ((v_colab IS NOT NULL AND c.colaborador_id = v_colab)
               OR public.mat_normalizar_texto(c.nome_digitado) = public.mat_normalizar_texto(e->>'nome_digitado'))
        ) INTO v_flag;
      ELSE
        SELECT EXISTS (
          SELECT 1 FROM public.ceu_pedido_itens c
           WHERE c.pedido_id = v_ped_ceu AND c.status <> 'cancelado'
             AND c.envio_id IS DISTINCT FROM v_env_ceu AND c.tipo = v_tipo
             AND c.item_id = v_item
             AND ((v_colab IS NOT NULL AND c.colaborador_id = v_colab)
               OR public.mat_normalizar_texto(c.nome_digitado) = public.mat_normalizar_texto(e->>'nome_digitado'))
             AND public.mat_normalizar_texto(c.tamanho) = public.mat_normalizar_texto(e->>'tamanho')
        ) INTO v_flag;
      END IF;
      INSERT INTO public.ceu_pedido_itens (pedido_id, envio_id, possivel_repeticao, nome_digitado,
        colaborador_id, identificado_em, ultima_entrega_em, ultima_entrega_item_id,
        tamanho_cadastro, alerta_tamanho, status,
        tipo, item_id, tamanho, qtd_pedida, cracha_nome, cracha_motivo, cracha_cordao)
      VALUES (v_ped_ceu, v_env_ceu, v_flag, btrim(e->>'nome_digitado'),
        v_colab,
        CASE WHEN v_colab IS NULL THEN NULL ELSE now() END,
        CASE WHEN v_colab IS NULL OR v_item IS NULL THEN NULL
             WHEN e ? 'ultima_entrega_em' THEN nullif(e->>'ultima_entrega_em', '')::date
             ELSE (SELECT max(en.data_entrega) FROM public.entregas en
                    WHERE en.colaborador_id = v_colab AND en.item_id = v_item) END,
        CASE WHEN v_colab IS NULL OR v_item IS NULL THEN NULL
             ELSE nullif(e->>'ultima_entrega_item_id', '')::uuid END,
        CASE WHEN v_colab IS NULL THEN NULL ELSE nullif(e->>'tamanho_cadastro', '') END,
        CASE WHEN v_colab IS NULL THEN false ELSE coalesce((e->>'alerta_tamanho')::boolean, false) END,
        CASE WHEN v_colab IS NULL THEN 'a_identificar' ELSE 'pendente' END,
        v_tipo, v_item,
        nullif(btrim(coalesce(e->>'tamanho', '')), ''),
        coalesce(nullif(e->>'qtd_pedida', '')::integer, 1),
        nullif(btrim(coalesce(e->>'cracha_nome', '')), ''),
        nullif(btrim(coalesce(e->>'cracha_motivo', '')), ''),
        nullif(e->>'cracha_cordao', '')::boolean);
    END LOOP;
  END IF;

  INSERT INTO public.mat_acesso_log (contrato_id, evento, ip, user_agent)
  VALUES (p_contrato, 'envio', p_ip, p_user_agent);
  -- Retenção de 180 dias: purge oportunista (sem pg_cron).
  IF random() < 0.05 THEN
    DELETE FROM public.mat_acesso_log WHERE created_at < now() - interval '180 days';
  END IF;

  RETURN jsonb_build_object(
    'pedido_id', v_mensal_id,
    'extra_pedido_id', v_ped_extra,
    'mesclado_produtos', v_merge_prod,
    'mesclado_ceu', v_merge_ceu,
    'virou_extra_produtos', v_extra_prod,
    'virou_extra_ceu', v_extra_ceu,
    'kit_aprovado', v_tem_kit AND v_auto,
    'tem_extras', v_tem_extra,
    'vazio', v_vazio,
    'ja_havia_pedido', v_vazio AND v_achou,
    'protocolo', upper(substr(replace(coalesce(v_protocolo_env, v_mensal_id)::text, '-', ''), 1, 8))
  );
END $function$;

REVOKE ALL ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) TO service_role;

-- "Contratos que ainda não pediram": quem respondeu "não preciso de nada"
-- (sem_necessidade) sai da lista, mesmo com status_produtos 'nao_se_aplica'.
CREATE OR REPLACE FUNCTION public.mat_contratos_sem_pedido(p_competencia date)
RETURNS TABLE (
  contrato_id uuid, nome text, departamento_id uuid, rota smallint,
  ultimo_responsavel text, link_aberto_no_mes boolean, tem_link boolean,
  pedido_id uuid
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_comp date := date_trunc('month', p_competencia)::date;
BEGIN
  IF NOT public.pode_ver_materiais() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
    SELECT c.id, c.nome, c.departamento_id, c.rota,
           (SELECT e.seu_nome FROM public.mat_pedido_envios e JOIN public.mat_pedidos pp ON pp.id = e.pedido_id
             WHERE pp.contrato_id = c.id ORDER BY e.enviado_em DESC LIMIT 1),
           EXISTS (SELECT 1 FROM public.mat_acesso_log l
                    WHERE l.contrato_id = c.id AND l.evento = 'carregar'
                      AND l.created_at >= v_comp::timestamp AT TIME ZONE 'America/Sao_Paulo'),
           EXISTS (SELECT 1 FROM public.mat_contrato_acesso a WHERE a.contrato_id = c.id AND a.ativo),
           (SELECT p.id FROM public.mat_pedidos p
             WHERE p.contrato_id = c.id AND p.competencia = v_comp AND p.tipo = 'mensal'
               AND p.status_produtos = 'nao_se_aplica' AND NOT p.sem_necessidade LIMIT 1)
      FROM public.mat_contratos c
     WHERE c.ativo
       AND (c.recebe_limpeza OR EXISTS (SELECT 1 FROM public.mat_kit_itens k WHERE k.contrato_id = c.id))
       AND NOT EXISTS (SELECT 1 FROM public.mat_pedidos p
                        WHERE p.contrato_id = c.id AND p.competencia = v_comp AND p.tipo = 'mensal'
                          AND p.status_produtos NOT IN ('rascunho', 'cancelado')
                          -- só uniforme/EPI/crachá: ainda falta o pedido de produtos
                          AND (NOT (p.status_produtos = 'nao_se_aplica' AND c.recebe_limpeza) OR p.sem_necessidade))
     ORDER BY c.nome;
END $$;
REVOKE ALL ON FUNCTION public.mat_contratos_sem_pedido(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_contratos_sem_pedido(date) TO authenticated;
