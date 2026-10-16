-- ============================================================
-- 135 — Materiais: Kit Mensal confirmável + pedido extra
-- ============================================================
-- Decisão da gestão (16/10/2026) — muda o conceito do Kit Mensal:
--
-- 1. O Kit Mensal é o que o posto VAI RECEBER. O líder só confirma: pode
--    tirar ("Não preciso este mês") ou diminuir, nunca aumentar nessa parte,
--    sem motivo.
-- 2. O que o líder pede é o que está ALÉM do kit (pedido extra): item fora do
--    kit, texto livre ou a quantidade A MAIS de um item do kit (linha
--    separada). O motivo do extra passa a ser OPCIONAL — o CHECK
--    mat_pedido_itens_justificativa_ck sai. "Antes da validade" vira só aviso
--    interno (excecao_validade continua gravado, mas não manda o pedido ao
--    inspetor).
-- 3. As linhas do kit confirmadas saem APROVADAS automaticamente quando a
--    configuração materiais_config.kit_aprovacao_automatica está ligada
--    (padrão: ligada; chave ausente = ligada). Só os extras passam pela
--    validação do inspetor e pela aprovação do gestor. Desligada, o kit
--    volta a passar pela aprovação junto com os extras (validado → gestor).
-- 4. Inspetor e gestor podem AJUSTAR qualquer linha do kit (diminuir, tirar,
--    trocar o item), com motivo registrado, enquanto o pedido não está
--    cancelado (a Fase 1 não tem separação/compra depois de 'aprovado';
--    quando a Fase 2 criar esses estados, a RPC deve bloqueá-los).
--
-- Desenho do status (status por LINHA + status do pedido = fila pendente):
-- - mat_pedido_itens.parte = 'kit' | 'extra' (padrão 'extra' — linhas que
--   não vêm do link nem do "Preencher pelo kit", como o pedido extra
--   operacional, seguem pela aprovação, como antes);
-- - mat_pedido_itens.aprovado_automatico = true nas linhas do kit aprovadas
--   pela configuração (qtd_validada = qtd_aprovada = qtd_pedida na gravação);
-- - mat_pedidos.status_produtos continua sendo a fila do que AINDA depende de
--   alguém: só kit (configuração ligada) → 'aprovado'; com extra →
--   'em_validacao' (inspetor) → 'validado' (gestor) → 'aprovado'. As linhas
--   do kit já aprovadas são ignoradas pela validação/aprovação (só mudam pela
--   RPC ajustar_linha_kit_materiais).
--
-- Sem tabela nova — sem GRANT de tabela. Idempotente. Tabelas de pedido
-- vazias na data (os 5 pedidos de teste foram apagados em 16/10/2026).
-- Definições anteriores das funções em
-- dados-locais/backup_materiais_135_2026-10-16/funcoes_antes.sql.

-- ============================================================
-- A) Colunas e CHECK
-- ============================================================
ALTER TABLE public.mat_pedido_itens
  ADD COLUMN IF NOT EXISTS parte text NOT NULL DEFAULT 'extra',
  ADD COLUMN IF NOT EXISTS aprovado_automatico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS item_original_id uuid REFERENCES public.mat_itens(id),
  ADD COLUMN IF NOT EXISTS variacao_original_id uuid REFERENCES public.mat_item_variacoes(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mat_pedido_itens_parte_ck'
                   AND conrelid = 'public.mat_pedido_itens'::regclass) THEN
    ALTER TABLE public.mat_pedido_itens
      ADD CONSTRAINT mat_pedido_itens_parte_ck CHECK (parte IN ('kit', 'extra'));
  END IF;
END $$;

-- Motivo do extra é opcional (decisão de 16/10/2026).
ALTER TABLE public.mat_pedido_itens DROP CONSTRAINT IF EXISTS mat_pedido_itens_justificativa_ck;

COMMENT ON COLUMN public.mat_pedido_itens.parte IS
  'kit = Kit Mensal confirmado pelo líder (o que o posto vai receber); extra = além do kit (fora do kit, texto livre ou a mais de um item do kit). Migration 135.';
COMMENT ON COLUMN public.mat_pedido_itens.aprovado_automatico IS
  'Linha do kit aprovada na gravação (materiais_config.kit_aprovacao_automatica). Validação/aprovação a ignoram; ajuste só por ajustar_linha_kit_materiais. Migration 135.';
COMMENT ON COLUMN public.mat_pedido_itens.item_original_id IS
  'Item pedido originalmente, quando o inspetor/gestor trocou o item da linha do kit (ajustar_linha_kit_materiais).';

-- ============================================================
-- B) Configuração
-- ============================================================
-- materiais_config é JSON em configuracoes.valor (text). Chave ausente ou
-- valor inválido = LIGADA (padrão da decisão).
CREATE OR REPLACE FUNCTION public.mat_kit_aprovacao_automatica()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v text; j jsonb;
BEGIN
  SELECT valor INTO v FROM public.configuracoes WHERE chave = 'materiais_config';
  IF v IS NULL THEN RETURN true; END IF;
  BEGIN
    j := v::jsonb;
  EXCEPTION WHEN others THEN
    RETURN true;
  END;
  IF jsonb_typeof(j -> 'kit_aprovacao_automatica') = 'boolean' THEN
    RETURN (j ->> 'kit_aprovacao_automatica')::boolean;
  END IF;
  RETURN true;
END $function$;

-- Grava chaves conhecidas de materiais_config (mescla com o que já existe).
-- Só gestor/admin (pode_aprovar_materiais) — a policy genérica de
-- configuracoes exige is_editor(), que não é o recorte do módulo.
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
    IF k NOT IN ('kit_aprovacao_automatica', 'dia_aviso', 'dia_limite') THEN
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

-- ============================================================
-- C) mat_registrar_envio (envio do líder pelo link — Edge Function)
-- ============================================================
-- Corpo da 129 preservado; muda: linhas com parte kit/extra, aprovação
-- automática do kit, status pelo que é EXTRA (validade não manda mais ao
-- inspetor) e kit já confirmado no mês → linha de kit vira extra (defesa
-- contra dois envios com o kit; a function já faz isso antes).
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
  IF NOT (v_tem_prod OR v_tem_ceu) THEN
    RAISE EXCEPTION 'Pedido sem itens';
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
      observacao, termos_aceitos, status_produtos, status_ceu, enviado_em)
    VALUES (p_contrato, v_comp, 'mensal', 'lider', btrim(p_seu_nome), p_observacao, p_termos,
      v_status_prod_novo, CASE WHEN v_tem_ceu THEN 'enviado' ELSE 'nao_se_aplica' END, now())
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
    'protocolo', upper(substr(replace(v_protocolo_env::text, '-', ''), 1, 8))
  );
END $function$;

REVOKE ALL ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) TO service_role;

-- ============================================================
-- D) preencher_pedido_pelo_kit — só linhas de kit; mesma regra de aprovação
-- ============================================================
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
                  WHERE pp.contrato_id = p_contrato AND pp.status_produtos = 'aprovado'
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

-- ============================================================
-- E) Validação e aprovação ignoram as linhas do kit já aprovadas
-- ============================================================
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
END $function$;

-- ============================================================
-- F) Ajuste de linha do kit (inspetor/gestor), com motivo
-- ============================================================
-- Diminuir, tirar (0) ou trocar o item/variação de uma linha 'kit'. Nunca
-- aumenta acima do kit (para dar mais, o caminho é o pedido extra). Grava a
-- quantidade validada (e a aprovada, se a linha já estava aprovada ou o
-- pedido já foi aprovado), o motivo, quem e quando, guarda o item original
-- na troca e registra um comentário na linha (histórico).
CREATE OR REPLACE FUNCTION public.ajustar_linha_kit_materiais(
  p_linha uuid, p_qtd numeric, p_motivo text, p_item uuid DEFAULT NULL, p_variacao uuid DEFAULT NULL)
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

-- ============================================================
-- G) Permissões de execução
-- ============================================================
REVOKE ALL ON FUNCTION public.mat_kit_aprovacao_automatica() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_kit_aprovacao_automatica() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.mat_salvar_config(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_salvar_config(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ajustar_linha_kit_materiais(uuid, numeric, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_linha_kit_materiais(uuid, numeric, text, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.preencher_pedido_pelo_kit(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preencher_pedido_pelo_kit(uuid, date) TO authenticated;
REVOKE ALL ON FUNCTION public.validar_pedido_materiais(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_pedido_materiais(uuid, jsonb, text) TO authenticated;
REVOKE ALL ON FUNCTION public.aprovar_pedido_materiais(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_pedido_materiais(uuid, jsonb) TO authenticated;
