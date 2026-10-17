-- ============================================================
-- 143 — Materiais: envio do link do líder IDEMPOTENTE
-- ============================================================
-- Pré-publicação (17/10/2026): uma falha de rede DEPOIS de gravar fazia o líder
-- reenviar e duplicar linhas. Agora o cliente gera um `id_envio` (uuid) por
-- tentativa e o guarda no aparelho até dar certo; mat_registrar_envio grava o id
-- (e o resultado devolvido) no envio criado e, se o mesmo id chegar de novo,
-- devolve o MESMO resultado (com repetido = true) sem regravar nada.
--   * mat_pedido_envios.id_envio (uuid) + índice único parcial; resultado (jsonb).
--   * mat_registrar_envio ganha p_id_envio (opcional, default NULL = comportamento
--     antigo). Função recriada a partir da definição viva (inclui a 140: envio vazio).
--   * Envio vazio sobre um mês que já tem pedido não cria envio: o id não é gravado
--     (repetir é inofensivo — continua ignorado).
-- A assinatura antiga (9 argumentos) é removida; a Edge Function pedido-materiais
-- deve ser redeployada DEPOIS desta migration. Sem tabela nova — sem GRANT.
-- Backup: dados-locais/backup_materiais_143_144_2026-10-17/
-- ============================================================

ALTER TABLE public.mat_pedido_envios
  ADD COLUMN IF NOT EXISTS id_envio uuid,
  ADD COLUMN IF NOT EXISTS resultado jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS mat_pedido_envios_id_envio_uq
  ON public.mat_pedido_envios (id_envio) WHERE id_envio IS NOT NULL;
COMMENT ON COLUMN public.mat_pedido_envios.id_envio IS 'Id da tentativa de envio gerado pelo cliente (idempotência). Migration 143.';

DROP FUNCTION IF EXISTS public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.mat_registrar_envio(p_contrato uuid, p_hoje date, p_seu_nome text, p_termos jsonb, p_observacao text, p_ip inet, p_user_agent text, p_produtos jsonb, p_ceu jsonb, p_id_envio uuid DEFAULT NULL::uuid)
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
  v_anterior jsonb;
  v_resultado jsonb;
BEGIN
  IF btrim(coalesce(p_seu_nome, '')) = '' THEN
    RAISE EXCEPTION 'Informe o seu nome';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mat_contratos WHERE id = p_contrato AND ativo) THEN
    RAISE EXCEPTION 'Contrato inexistente ou inativo';
  END IF;

  -- Dois envios simultâneos do mesmo contrato/mês não criam dois pedidos.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contrato::text || v_comp::text, 0));

  -- Envio idempotente (migration 143): o cliente manda um id por tentativa; se a rede
  -- falhou depois de gravar e ele repetiu, devolve o MESMO resultado sem regravar nada.
  IF p_id_envio IS NOT NULL THEN
    SELECT resultado INTO v_anterior FROM public.mat_pedido_envios WHERE id_envio = p_id_envio;
    IF FOUND THEN
      RETURN coalesce(v_anterior, '{}'::jsonb) || jsonb_build_object('repetido', true);
    END IF;
  END IF;

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

  v_resultado := jsonb_build_object(
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

  -- Guarda o id e o resultado no envio recém-criado (não no de um pedido que já existia).
  IF p_id_envio IS NOT NULL AND v_protocolo_env IS NOT NULL AND NOT (v_vazio AND v_achou) THEN
    UPDATE public.mat_pedido_envios SET id_envio = p_id_envio, resultado = v_resultado WHERE id = v_protocolo_env;
  END IF;
  RETURN v_resultado;
END $function$;

REVOKE ALL ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb, uuid) TO service_role;
