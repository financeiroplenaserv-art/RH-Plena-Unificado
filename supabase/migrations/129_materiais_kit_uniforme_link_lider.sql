-- 129_materiais_kit_uniforme_link_lider.sql
-- Módulo Materiais — redesenho da tela do líder (pedido da gestão, 14/10/2026).
-- VERSIONADA, NÃO APLICADA (aplicar só com autorização; backup antes:
-- mat_acesso_log (contagem), definição atual de mat_registrar_envio).
--
--  A) Kit de uniforme/EPI por contrato: mat_contrato_ceu_itens. Cada linha
--     aponta para UM item do CEU (`itens`) — qualquer tamanho da peça — e a
--     peça inteira entra no link do líder: o agrupamento "um item por tamanho"
--     → "peça com tamanhos" é DERIVADO em tempo de execução pelo nome base
--     (src/lib/materiais/pecasCeu.ts), então tamanho novo cadastrado no CEU
--     aparece sozinho e tamanho inativado some. `funcoes` diz a quem a peça se
--     destina (asg, portaria, encarregado, manutencao, jardinagem, recepcao,
--     administrativo, monitoramento; vazio = qualquer função). `rotulo`
--     sobrescreve o nome exibido ao líder ("Camisa polo azul clara — ASG").
--     É REFERÊNCIA para o líder escolher, não limite de quantidade.
--     RLS: SELECT pode_ver_materiais() OR pode_ver_ceu(); escrita
--     pode_editar_kit_uniforme() (admin, adm, gestor, dp2); DELETE também.
--     GRANT explícito (AGENTS.md §8).
--  B) mat_acesso_log.evento aceita 'buscar' ("Preciso de outro item" — ação
--     buscar_item da Edge Function, rate limit próprio de 60/min por IP).
--  C) mat_registrar_envio recriada: p_ceu passa a aceitar `colaborador_id`
--     (pessoa escolhida na lista da equipe do link — a function troca o
--     identificador opaco pelo id). Linha com colaborador_id nasce
--     IDENTIFICADA: status 'pendente', identificado_em = now(),
--     identificado_por NULL (veio do link) e os snapshots que a function
--     calcula no envio (pedido da gestão, 14/10/2026): ultima_entrega_em e
--     ultima_entrega_item_id da PEÇA (qualquer tamanho — pediu a bota 39 e
--     recebeu a 38: mostra a 38), tamanho_cadastro (ceu_tamanhos) e
--     alerta_tamanho. Sem o snapshot no JSON, a última entrega cai no item
--     exato (regra da 122). Aviso de repetição de uniforme/EPI: mesma pessoa
--     (id ou nome) + mesma peça + mesmo tamanho. O resto é idêntico à 122.
--  E) mat_contratos.departamentos_equipe_extra (equipe = departamento
--     principal + extras) e os 4 contratos TELEX com o DUOCONNECT.
--  F) Permissões: menu/rota.materiais_kit e materiais.editar_kit_uniforme
--     (dp2 edita as peças sem ganhar o módulo) + reset_permissoes_perfil.
--  D) ceu_pedido_itens.ultima_entrega_item_id (item — e portanto o tamanho —
--     da última entrega da peça) e identificar_linhas_pedido_ceu recriada para
--     aceitar ultima_entrega_em/ultima_entrega_item_id calculados pela fila
--     CEU → Pedidos por peça (sem eles, mantém o cálculo da 122).
--
-- Ordem de implantação: aplicar esta migration ANTES do deploy da function
-- nova (sem o B o log 'buscar' falha em silêncio e a busca fica sem rate
-- limit; sem o C a pessoa escolhida chega só como nome, a identificar).

begin;

-- ============================================================
-- A) Kit de uniforme/EPI do contrato
-- ============================================================
CREATE OR REPLACE FUNCTION public.pode_editar_kit_uniforme()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid()
      AND nivel_acesso IN ('admin', 'adm', 'gestor', 'dp2')
  );
$$;
GRANT EXECUTE ON FUNCTION public.pode_editar_kit_uniforme() TO authenticated;

CREATE TABLE IF NOT EXISTS public.mat_contrato_ceu_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.mat_contratos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  rotulo text CHECK (rotulo IS NULL OR length(btrim(rotulo)) BETWEEN 1 AND 120),
  funcoes text[] NOT NULL DEFAULT '{}' CHECK (
    funcoes <@ ARRAY['asg', 'portaria', 'encarregado', 'manutencao', 'jardinagem',
                     'recepcao', 'administrativo', 'monitoramento']::text[]
  ),
  ordem integer,
  ativo boolean NOT NULL DEFAULT true,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('form', 'ceu', 'form_ceu', 'manual')),
  observacao text,
  atualizado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, item_id)
);
CREATE INDEX IF NOT EXISTS mat_contrato_ceu_itens_contrato_idx ON public.mat_contrato_ceu_itens (contrato_id);

DROP TRIGGER IF EXISTS trg_mat_contrato_ceu_itens_touch ON public.mat_contrato_ceu_itens;
CREATE TRIGGER trg_mat_contrato_ceu_itens_touch BEFORE UPDATE ON public.mat_contrato_ceu_itens
  FOR EACH ROW EXECUTE FUNCTION public.mat_kit_touch();

ALTER TABLE public.mat_contrato_ceu_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mat_contrato_ceu_itens_select" ON public.mat_contrato_ceu_itens;
DROP POLICY IF EXISTS "mat_contrato_ceu_itens_insert" ON public.mat_contrato_ceu_itens;
DROP POLICY IF EXISTS "mat_contrato_ceu_itens_update" ON public.mat_contrato_ceu_itens;
DROP POLICY IF EXISTS "mat_contrato_ceu_itens_delete" ON public.mat_contrato_ceu_itens;
CREATE POLICY "mat_contrato_ceu_itens_select" ON public.mat_contrato_ceu_itens FOR SELECT TO authenticated
  USING ((SELECT public.pode_ver_materiais()) OR (SELECT public.pode_ver_ceu()));
CREATE POLICY "mat_contrato_ceu_itens_insert" ON public.mat_contrato_ceu_itens FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.pode_editar_kit_uniforme()));
CREATE POLICY "mat_contrato_ceu_itens_update" ON public.mat_contrato_ceu_itens FOR UPDATE TO authenticated
  USING ((SELECT public.pode_editar_kit_uniforme()))
  WITH CHECK ((SELECT public.pode_editar_kit_uniforme()));
CREATE POLICY "mat_contrato_ceu_itens_delete" ON public.mat_contrato_ceu_itens FOR DELETE TO authenticated
  USING ((SELECT public.pode_editar_kit_uniforme()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_contrato_ceu_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_contrato_ceu_itens TO service_role;

-- ============================================================
-- B) Log da busca "Preciso de outro item"
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.mat_acesso_log'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%evento%'
  LOOP
    EXECUTE format('ALTER TABLE public.mat_acesso_log DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE public.mat_acesso_log ADD CONSTRAINT mat_acesso_log_evento_check
  CHECK (evento IN ('carregar', 'envio', 'envio_recusado', 'limite_ip', 'link_gerado', 'buscar'));

-- ============================================================
-- D) Item da última entrega (tamanho) — coluna usada por C e pela fila
-- ============================================================
ALTER TABLE public.ceu_pedido_itens
  ADD COLUMN IF NOT EXISTS ultima_entrega_item_id uuid REFERENCES public.itens(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.identificar_linhas_pedido_ceu(p_linhas jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $
DECLARE e jsonb; l public.ceu_pedido_itens%ROWTYPE; n integer := 0; v_ped uuid;
BEGIN
  IF NOT (public.pode_validar_materiais() OR public.pode_atender_pedido_ceu()) THEN
    RAISE EXCEPTION 'Sem permissão para identificar colaboradores';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) LOOP
    SELECT * INTO l FROM public.ceu_pedido_itens WHERE id = (e->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não encontrada', e->>'id'; END IF;
    IF l.status NOT IN ('a_identificar', 'pendente') THEN
      RAISE EXCEPTION 'Linha % já conferida/atendida', l.id;
    END IF;
    UPDATE public.ceu_pedido_itens
       SET colaborador_id = (e->>'colaborador_id')::uuid,
           identificado_por = auth.uid(), identificado_em = now(),
           tamanho_cadastro = nullif(e->>'tamanho_cadastro', ''),
           alerta_tamanho = coalesce((e->>'alerta_tamanho')::boolean, false),
           fora_da_equipe = coalesce((e->>'fora_da_equipe')::boolean, false),
           ultima_entrega_em = CASE
             WHEN l.item_id IS NULL THEN NULL
             WHEN e ? 'ultima_entrega_em' THEN nullif(e->>'ultima_entrega_em', '')::date
             ELSE (SELECT max(en.data_entrega) FROM public.entregas en
                    WHERE en.colaborador_id = (e->>'colaborador_id')::uuid AND en.item_id = l.item_id) END,
           ultima_entrega_item_id = CASE
             WHEN l.item_id IS NULL THEN NULL
             WHEN e ? 'ultima_entrega_item_id' THEN nullif(e->>'ultima_entrega_item_id', '')::uuid
             ELSE NULL END,
           status = 'pendente'
     WHERE id = l.id;
    v_ped := l.pedido_id;
    n := n + 1;
  END LOOP;
  IF v_ped IS NOT NULL THEN
    UPDATE public.mat_pedidos SET status_ceu = 'em_identificacao'
     WHERE id = v_ped AND status_ceu = 'enviado';
  END IF;
  RETURN n;
END $;

-- ============================================================
-- C) mat_registrar_envio com colaborador_id (pessoa da lista da equipe)
-- ============================================================
-- p_ceu: [{tipo, nome_digitado, colaborador_id, item_id, tamanho, qtd_pedida,
--   cracha_nome, cracha_motivo, cracha_cordao, ultima_entrega_em,
--   ultima_entrega_item_id, tamanho_cadastro, alerta_tamanho}] — colaborador_id só quando a
--   pessoa foi escolhida na lista (a Edge Function resolve o identificador
--   opaco); "outra pessoa" segue só com o nome digitado (a identificar).
CREATE OR REPLACE FUNCTION public.mat_registrar_envio(
  p_contrato uuid, p_hoje date, p_seu_nome text, p_termos jsonb, p_observacao text,
  p_ip inet, p_user_agent text, p_produtos jsonb, p_ceu jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_zero constant uuid := '00000000-0000-0000-0000-000000000000';
  v_comp date := date_trunc('month', p_hoje)::date;
  v_prod jsonb := coalesce(p_produtos, '[]'::jsonb);
  v_ceu jsonb := coalesce(p_ceu, '[]'::jsonb);
  v_tem_prod boolean := jsonb_array_length(coalesce(p_produtos, '[]'::jsonb)) > 0;
  v_tem_ceu boolean := jsonb_array_length(coalesce(p_ceu, '[]'::jsonb)) > 0;
  v_exc boolean := false;
  v_ped public.mat_pedidos%ROWTYPE;
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

  SELECT bool_or(coalesce((x->>'excecao_acima_kit')::boolean, false)
              OR coalesce((x->>'excecao_validade')::boolean, false)
              OR coalesce((x->>'excecao_fora_kit')::boolean, false))
    INTO v_exc FROM jsonb_array_elements(v_prod) x;
  v_exc := coalesce(v_exc, false);
  v_status_prod_novo := CASE WHEN NOT v_tem_prod THEN 'nao_se_aplica'
                             WHEN v_exc THEN 'em_validacao' ELSE 'validado' END;

  -- Dois envios simultâneos do mesmo contrato/mês não criam dois pedidos.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contrato::text || v_comp::text, 0));

  SELECT * INTO v_ped FROM public.mat_pedidos
   WHERE contrato_id = p_contrato AND competencia = v_comp
     AND tipo = 'mensal' AND status_produtos <> 'cancelado'
   FOR UPDATE;

  IF NOT FOUND THEN
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
        IF v_exc THEN
          UPDATE public.mat_pedidos SET status_produtos = 'em_validacao' WHERE id = v_mensal_id;
        ELSIF v_ped.status_produtos IN ('nao_se_aplica', 'enviado', 'rascunho') THEN
          UPDATE public.mat_pedidos SET status_produtos = 'validado' WHERE id = v_mensal_id;
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

  -- Linhas de produtos (repetição = só aviso: mesmo item e variação em outro
  -- envio do mesmo pedido).
  IF v_tem_prod THEN
    FOR e IN SELECT * FROM jsonb_array_elements(v_prod) LOOP
      v_rep := NULL;
      IF nullif(e->>'item_id', '') IS NOT NULL THEN
        SELECT i.id INTO v_rep FROM public.mat_pedido_itens i
         WHERE i.pedido_id = v_ped_prod AND i.envio_id IS DISTINCT FROM v_env_prod
           AND i.item_id = (e->>'item_id')::uuid
           AND coalesce(i.variacao_id, v_zero) = coalesce(nullif(e->>'variacao_id', '')::uuid, v_zero)
         ORDER BY i.created_at LIMIT 1;
      END IF;
      INSERT INTO public.mat_pedido_itens (pedido_id, envio_id, possivel_repeticao, repete_linha_id,
        item_id, variacao_id, descricao_livre, qtd_kit, qtd_pedida, preco_unitario, justificativa,
        excecao_acima_kit, excecao_validade, excecao_fora_kit, ultima_entrega_em)
      VALUES (v_ped_prod, v_env_prod, v_rep IS NOT NULL, v_rep,
        nullif(e->>'item_id', '')::uuid, nullif(e->>'variacao_id', '')::uuid,
        nullif(btrim(coalesce(e->>'descricao_livre', '')), ''),
        nullif(e->>'qtd_kit', '')::numeric, (e->>'qtd_pedida')::numeric,
        nullif(e->>'preco_unitario', '')::numeric, nullif(btrim(coalesce(e->>'justificativa', '')), ''),
        coalesce((e->>'excecao_acima_kit')::boolean, false),
        coalesce((e->>'excecao_validade')::boolean, false),
        coalesce((e->>'excecao_fora_kit')::boolean, false),
        nullif(e->>'ultima_entrega_em', '')::date);
    END LOOP;
  END IF;

  -- Linhas de uniforme/EPI/crachá. Aviso de repetição: uniforme/EPI só com
  -- mesma pessoa + mesma peça + mesmo tamanho; crachá com a mesma pessoa no
  -- mês (qualquer pedido não cancelado do contrato na competência). "Mesma
  -- pessoa" = mesmo colaborador_id ou mesmo nome digitado normalizado.
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
    'protocolo', upper(substr(replace(v_protocolo_env::text, '-', ''), 1, 8))
  );
END $$;

-- Mesma regra da 122: só a Edge Function (service_role) chama.
REVOKE ALL ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) TO service_role;

-- ============================================================
-- E) Equipe ampliada do contrato de pedido (decisão da gestão, 14/10/2026)
--    Caso Telex × DuoConnect: o contrato é com a DUOCONNECT SOLUCOES
--    AUDITIVAS LTDA (departamento DUOCONNECT), mas os colaboradores trabalham
--    nas lojas Telex — no cadastro (que vem do e-Contador e NÃO deve ser
--    editado à mão) há 1 ASG ativo em CENTRO AUDITIVO TELEX e 3 em
--    DUOCONNECT. A equipe do link passa a ser a união do departamento
--    principal com os departamentos de departamentos_equipe_extra (mesma regra
--    idsColaboradoresDoDepartamento para cada um).
-- ============================================================
ALTER TABLE public.mat_contratos
  ADD COLUMN IF NOT EXISTS departamentos_equipe_extra uuid[] NOT NULL DEFAULT '{}';

DO $$
DECLARE v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.departamentos
                  WHERE id = '3c68d824-54ad-46f5-be01-3e94b687974e' AND status = 'Ativo') THEN
    RAISE EXCEPTION 'Departamento DUOCONNECT (3c68d824-...) não encontrado ou inativo';
  END IF;
  SELECT count(*) INTO v_n FROM public.mat_contratos
   WHERE nome IN ('TELEX BAR, TIJ E IPA', 'TELEX COPA, MAD, BOTA E M' || chr(201) || 'IER',
                  'TELEX ICA, CENTRO NIT E CENTRO RJ', 'TELEX SEDE');
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'Esperados 4 contratos TELEX, encontrados %', v_n;
  END IF;
  UPDATE public.mat_contratos
     SET departamentos_equipe_extra = ARRAY['3c68d824-54ad-46f5-be01-3e94b687974e']::uuid[]
   WHERE nome IN ('TELEX BAR, TIJ E IPA', 'TELEX COPA, MAD, BOTA E M' || chr(201) || 'IER',
                  'TELEX ICA, CENTRO NIT E CENTRO RJ', 'TELEX SEDE');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'UPDATE dos contratos TELEX afetou % linhas (esperado 4)', v_n;
  END IF;
END $$;

-- ============================================================
-- F) Permissões: dp2 (Beth) edita "Uniformes e EPIs do contrato" na tela
--    Materiais → Kit Mensal SEM ganhar o módulo inteiro (mesmo molde da aba
--    Fornecedores, 123): menu/rota.materiais_kit (true: gestor, mesa,
--    inspetoria, dp2) e materiais.editar_kit_uniforme (true: gestor, dp2).
--    O Kit Mensal de PRODUTOS segue só do gestor (materiais.editar_kit) — para
--    a dp2 a seção de produtos é somente leitura. reset_permissoes_perfil
--    recriada = 123 + estas linhas (nenhuma migration posterior a recriou).
--    Backup de permissoes_perfil antes de aplicar.
-- ============================================================
INSERT INTO public.permissoes_perfil (perfil, recurso, acao, permitido) VALUES
  ('visualizador', 'menu', 'materiais_kit', false),
  ('visualizador', 'rota', 'materiais_kit', false),
  ('visualizador', 'materiais', 'editar_kit_uniforme', false),
  ('gestor', 'menu', 'materiais_kit', true),
  ('gestor', 'rota', 'materiais_kit', true),
  ('gestor', 'materiais', 'editar_kit_uniforme', true),
  ('rh', 'menu', 'materiais_kit', false),
  ('rh', 'rota', 'materiais_kit', false),
  ('rh', 'materiais', 'editar_kit_uniforme', false),
  ('dp1', 'menu', 'materiais_kit', false),
  ('dp1', 'rota', 'materiais_kit', false),
  ('dp1', 'materiais', 'editar_kit_uniforme', false),
  ('dp2', 'menu', 'materiais_kit', true),
  ('dp2', 'rota', 'materiais_kit', true),
  ('dp2', 'materiais', 'editar_kit_uniforme', true),
  ('mesa', 'menu', 'materiais_kit', true),
  ('mesa', 'rota', 'materiais_kit', true),
  ('mesa', 'materiais', 'editar_kit_uniforme', false),
  ('inspetoria', 'menu', 'materiais_kit', true),
  ('inspetoria', 'rota', 'materiais_kit', true),
  ('inspetoria', 'materiais', 'editar_kit_uniforme', false),
  ('financeiro', 'menu', 'materiais_kit', false),
  ('financeiro', 'rota', 'materiais_kit', false),
  ('financeiro', 'materiais', 'editar_kit_uniforme', false),
  ('dp3', 'menu', 'materiais_kit', false),
  ('dp3', 'rota', 'materiais_kit', false),
  ('dp3', 'materiais', 'editar_kit_uniforme', false)
ON CONFLICT (perfil, recurso, acao) DO UPDATE SET permitido = EXCLUDED.permitido;

-- reset_permissoes_perfil recriada: idêntica à 123 + linhas materiais_kit / editar_kit_uniforme.
CREATE OR REPLACE FUNCTION public.reset_permissoes_perfil(p_perfil text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      ('dp3', 'materiais', 'editar_kit_uniforme', false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Perfil desconhecido: %', p_perfil;
END;
$$;

commit;
