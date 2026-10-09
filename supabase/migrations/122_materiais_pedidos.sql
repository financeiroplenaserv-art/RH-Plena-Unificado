-- Migração 122: Módulo Materiais (Fase 1) — pedidos, filas e RPCs
--
-- Segunda parte do módulo (docs/PLANO_MATERIAIS_FASE1.md, seção 3.3; depende
-- da 121). Cria o envio do líder e as duas filas que ele gera:
--  A) mat_pedidos (cabeçalho: um pedido MENSAL por contrato e mês, mais
--     pedidos 'extra'), mat_pedido_envios (cada envio pelo link/registro
--     interno — rastreia mesclas), mat_pedido_itens (fila de produtos),
--     ceu_pedido_itens (fila da Beth: uniforme/EPI/crachá), mat_comentarios
--     e mat_reaberturas (liberação do link fora da janela 1–15);
--  B) mat_normalizar_texto() — normalização de nomes (aliases, repetição);
--  C) mat_registrar_envio() — chamada SÓ pela Edge Function (service_role):
--     lock do pedido do mês, mescla de envios com trava (produtos até a
--     aprovação, uniforme/EPI/crachá até a conferência; depois vira pedido
--     'extra') e avisos de repetição (só aviso, nunca trava);
--  D) RPCs de estado (padrão da 115: reconferem perfil e status no banco):
--     enviar_pedido_interno, validar_pedido_materiais, aprovar_pedido_materiais,
--     aprovar_lote_materiais, identificar_linhas_pedido_ceu,
--     conferir_itens_pedido_ceu, atender_itens_pedido_ceu,
--     reabrir_pedido_materiais, definir_rota_pedido, preencher_pedido_pelo_kit,
--     mat_contratos_sem_pedido.
--
-- Nada é gerado automaticamente (sem pg_cron). RLS em toda tabela; GRANT
-- explícito; nunca anon. Idempotente. NÃO aplicar sem decisão do usuário.

-- ============================================================
-- B) Normalização de texto (espelha normalizarTexto em src/lib/materiais)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mat_normalizar_texto(p text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(
      translate(lower(coalesce(p, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9 ]', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

-- ============================================================
-- A) Tabelas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mat_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.mat_contratos(id),
  competencia date NOT NULL CHECK (competencia = date_trunc('month', competencia)::date),
  tipo text NOT NULL DEFAULT 'mensal' CHECK (tipo IN ('mensal', 'extra')),
  origem text NOT NULL DEFAULT 'lider' CHECK (origem IN ('lider', 'escritorio', 'operacional')),
  preenchido_pelo_escritorio boolean NOT NULL DEFAULT false,
  -- Rota do dia (mesa): rota efetiva = coalesce(rota_override, mat_contratos.rota)
  rota_override smallint CHECK (rota_override IN (1, 2, 3)),
  rota_override_motivo text,
  rota_override_por uuid,
  responsavel_nome text,
  observacao text,
  termos_aceitos jsonb,
  status_produtos text NOT NULL DEFAULT 'rascunho' CHECK (status_produtos IN
    ('nao_se_aplica', 'rascunho', 'enviado', 'em_validacao', 'validado', 'aprovado', 'cancelado')),
  status_ceu text NOT NULL DEFAULT 'nao_se_aplica' CHECK (status_ceu IN
    ('nao_se_aplica', 'enviado', 'em_identificacao', 'conferido', 'em_atendimento', 'atendido', 'cancelado')),
  enviado_em timestamptz,
  reaberto_por uuid,
  reaberto_em timestamptz,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Um pedido mensal por contrato e mês (envios repetidos são mesclados).
CREATE UNIQUE INDEX IF NOT EXISTS mat_pedidos_mensal_uq
  ON public.mat_pedidos (contrato_id, competencia)
  WHERE tipo = 'mensal' AND status_produtos <> 'cancelado';
CREATE INDEX IF NOT EXISTS mat_pedidos_competencia_idx ON public.mat_pedidos (competencia, contrato_id);

CREATE TABLE IF NOT EXISTS public.mat_pedido_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.mat_pedidos(id) ON DELETE CASCADE,
  sequencia smallint NOT NULL,
  origem text NOT NULL CHECK (origem IN ('original', 'complemento')),
  seu_nome text NOT NULL CHECK (btrim(seu_nome) <> ''),
  enviado_em timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  UNIQUE (pedido_id, sequencia)
);

CREATE TABLE IF NOT EXISTS public.mat_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.mat_pedidos(id) ON DELETE CASCADE,
  envio_id uuid REFERENCES public.mat_pedido_envios(id) ON DELETE SET NULL,
  possivel_repeticao boolean NOT NULL DEFAULT false,
  repete_linha_id uuid,
  decisao_repeticao text CHECK (decisao_repeticao IN ('somar', 'descartar')),
  item_id uuid REFERENCES public.mat_itens(id),
  variacao_id uuid REFERENCES public.mat_item_variacoes(id),
  descricao_livre text,
  qtd_kit numeric,
  qtd_pedida numeric NOT NULL CHECK (qtd_pedida >= 0),
  qtd_validada numeric CHECK (qtd_validada >= 0),
  qtd_aprovada numeric CHECK (qtd_aprovada >= 0),
  qtd_entregue numeric CHECK (qtd_entregue >= 0),
  preco_unitario numeric(12,2),
  justificativa text,
  excecao_acima_kit boolean NOT NULL DEFAULT false,
  excecao_validade boolean NOT NULL DEFAULT false,
  excecao_fora_kit boolean NOT NULL DEFAULT false,
  ultima_entrega_em date,
  motivo_ajuste text,
  ajustado_por uuid,
  ajustado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- "Outros materiais": texto livre exige item_id nulo; senão precisa de item.
  CONSTRAINT mat_pedido_itens_item_ck CHECK (
    (item_id IS NOT NULL AND descricao_livre IS NULL) OR (item_id IS NULL AND descricao_livre IS NOT NULL)
  ),
  -- O servidor recalcula as exceções; exceção marcada exige justificativa.
  CONSTRAINT mat_pedido_itens_justificativa_ck CHECK (
    NOT (excecao_acima_kit OR excecao_validade OR excecao_fora_kit)
    OR btrim(coalesce(justificativa, '')) <> ''
  ),
  -- Corte (validado/aprovado menor que o pedido) exige motivo.
  CONSTRAINT mat_pedido_itens_motivo_ck CHECK (
    (qtd_validada IS NULL OR qtd_validada >= qtd_pedida OR btrim(coalesce(motivo_ajuste, '')) <> '')
    AND (qtd_aprovada IS NULL OR qtd_aprovada >= qtd_pedida OR btrim(coalesce(motivo_ajuste, '')) <> '')
  )
);
CREATE INDEX IF NOT EXISTS mat_pedido_itens_pedido_idx ON public.mat_pedido_itens (pedido_id);
CREATE INDEX IF NOT EXISTS mat_pedido_itens_envio_idx ON public.mat_pedido_itens (envio_id);

CREATE TABLE IF NOT EXISTS public.ceu_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.mat_pedidos(id) ON DELETE CASCADE,
  envio_id uuid REFERENCES public.mat_pedido_envios(id) ON DELETE SET NULL,
  possivel_repeticao boolean NOT NULL DEFAULT false,
  nome_digitado text NOT NULL CHECK (btrim(nome_digitado) <> ''),
  colaborador_id uuid REFERENCES public.colaboradores(id),
  identificado_por uuid,
  identificado_em timestamptz,
  fora_da_equipe boolean NOT NULL DEFAULT false,
  tipo text NOT NULL CHECK (tipo IN ('uniforme', 'epi', 'cracha')),
  item_id uuid REFERENCES public.itens(id),
  tamanho text,
  tamanho_cadastro text,
  qtd_pedida integer NOT NULL DEFAULT 1 CHECK (qtd_pedida >= 0),
  qtd_conferida integer CHECK (qtd_conferida >= 0),
  alerta_tamanho boolean NOT NULL DEFAULT false,
  ultima_entrega_em date,
  cracha_nome text,
  cracha_motivo text,
  cracha_cordao boolean,
  status text NOT NULL DEFAULT 'a_identificar' CHECK (status IN
    ('a_identificar', 'pendente', 'conferido', 'ajustado', 'atendido', 'cancelado')),
  conferido_por uuid,
  conferido_em timestamptz,
  atendido_por uuid,
  atendido_em timestamptz,
  motivo_ajuste text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ceu_pedido_itens_item_ck CHECK (
    (tipo = 'cracha' AND item_id IS NULL) OR (tipo <> 'cracha' AND item_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS ceu_pedido_itens_pedido_idx ON public.ceu_pedido_itens (pedido_id);
CREATE INDEX IF NOT EXISTS ceu_pedido_itens_status_idx ON public.ceu_pedido_itens (status);

-- Substitui as anotações nas células das planilhas ("esclarecer…").
CREATE TABLE IF NOT EXISTS public.mat_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.mat_pedidos(id) ON DELETE CASCADE,
  linha_tabela text CHECK (linha_tabela IN ('mat_pedido_itens', 'ceu_pedido_itens')),
  linha_id uuid,
  autor_id uuid NOT NULL DEFAULT auth.uid(),
  autor_nome text,
  texto text NOT NULL CHECK (btrim(texto) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mat_comentarios_pedido_idx ON public.mat_comentarios (pedido_id, created_at);

-- Liberação do link fora da janela (o contrato pode nem ter pedido ainda,
-- por isso a reabertura não vive em mat_pedidos). Lida pela Edge Function.
CREATE TABLE IF NOT EXISTS public.mat_reaberturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.mat_contratos(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  ate date NOT NULL,
  motivo text NOT NULL CHECK (btrim(motivo) <> ''),
  reaberto_por uuid DEFAULT auth.uid(),
  reaberto_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mat_reaberturas_idx ON public.mat_reaberturas (contrato_id, competencia, ate DESC);

-- ============================================================
-- RLS + GRANTs
-- ============================================================
ALTER TABLE public.mat_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_pedido_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceu_pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_reaberturas ENABLE ROW LEVEL SECURITY;

-- Quem cria pedido interno/extra: validação, cadastro e mesa (a ação
-- pedido_extra do mapa padrão inclui a mesa, que não está em pode_validar).
-- mat_pedidos
DROP POLICY IF EXISTS "mat_pedidos_select" ON public.mat_pedidos;
DROP POLICY IF EXISTS "mat_pedidos_insert" ON public.mat_pedidos;
DROP POLICY IF EXISTS "mat_pedidos_update" ON public.mat_pedidos;
DROP POLICY IF EXISTS "mat_pedidos_delete" ON public.mat_pedidos;
CREATE POLICY "mat_pedidos_select" ON public.mat_pedidos FOR SELECT TO authenticated
  USING (public.pode_ver_materiais() OR public.pode_ver_ceu());
CREATE POLICY "mat_pedidos_insert" ON public.mat_pedidos FOR INSERT TO authenticated
  WITH CHECK (
    tipo = 'extra' AND status_produtos = 'rascunho' AND criado_por = auth.uid()
    AND (public.pode_validar_materiais() OR public.pode_editar_cadastro_materiais() OR public.pode_alterar_rota_materiais())
  );
CREATE POLICY "mat_pedidos_update" ON public.mat_pedidos FOR UPDATE TO authenticated
  USING (public.pode_aprovar_materiais() OR (status_produtos = 'rascunho' AND criado_por = auth.uid()))
  WITH CHECK (public.pode_aprovar_materiais() OR (status_produtos = 'rascunho' AND criado_por = auth.uid()));
CREATE POLICY "mat_pedidos_delete" ON public.mat_pedidos FOR DELETE TO authenticated
  USING (public.is_admin());

-- mat_pedido_envios: escrita só service_role / RPCs.
DROP POLICY IF EXISTS "mat_pedido_envios_select" ON public.mat_pedido_envios;
CREATE POLICY "mat_pedido_envios_select" ON public.mat_pedido_envios FOR SELECT TO authenticated
  USING (public.pode_ver_materiais() OR public.pode_ver_ceu());

-- mat_pedido_itens: rascunho interno pelo autor; demais mudanças por RPC.
DROP POLICY IF EXISTS "mat_pedido_itens_select" ON public.mat_pedido_itens;
DROP POLICY IF EXISTS "mat_pedido_itens_insert" ON public.mat_pedido_itens;
DROP POLICY IF EXISTS "mat_pedido_itens_update" ON public.mat_pedido_itens;
DROP POLICY IF EXISTS "mat_pedido_itens_delete" ON public.mat_pedido_itens;
CREATE POLICY "mat_pedido_itens_select" ON public.mat_pedido_itens FOR SELECT TO authenticated
  USING (public.pode_ver_materiais());
CREATE POLICY "mat_pedido_itens_insert" ON public.mat_pedido_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mat_pedidos p
     WHERE p.id = pedido_id AND p.status_produtos = 'rascunho' AND p.criado_por = auth.uid()
  ));
CREATE POLICY "mat_pedido_itens_update" ON public.mat_pedido_itens FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mat_pedidos p
     WHERE p.id = pedido_id AND p.status_produtos = 'rascunho' AND p.criado_por = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mat_pedidos p
     WHERE p.id = pedido_id AND p.status_produtos = 'rascunho' AND p.criado_por = auth.uid()
  ));
CREATE POLICY "mat_pedido_itens_delete" ON public.mat_pedido_itens FOR DELETE TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.mat_pedidos p
     WHERE p.id = pedido_id AND p.status_produtos = 'rascunho' AND p.criado_por = auth.uid()
  ));

-- ceu_pedido_itens: INSERT interno (ferista/faltista) em pedido rascunho do
-- autor; link entra por service_role; UPDATE só pelas RPCs.
DROP POLICY IF EXISTS "ceu_pedido_itens_select" ON public.ceu_pedido_itens;
DROP POLICY IF EXISTS "ceu_pedido_itens_insert" ON public.ceu_pedido_itens;
DROP POLICY IF EXISTS "ceu_pedido_itens_delete" ON public.ceu_pedido_itens;
CREATE POLICY "ceu_pedido_itens_select" ON public.ceu_pedido_itens FOR SELECT TO authenticated
  USING (public.pode_ver_materiais() OR public.pode_ver_ceu());
CREATE POLICY "ceu_pedido_itens_insert" ON public.ceu_pedido_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mat_pedidos p
     WHERE p.id = pedido_id AND p.status_produtos = 'rascunho' AND p.criado_por = auth.uid()
  ));
CREATE POLICY "ceu_pedido_itens_delete" ON public.ceu_pedido_itens FOR DELETE TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.mat_pedidos p
     WHERE p.id = pedido_id AND p.status_produtos = 'rascunho' AND p.criado_por = auth.uid()
  ));

-- Comentários: histórico imutável (sem UPDATE/DELETE).
DROP POLICY IF EXISTS "mat_comentarios_select" ON public.mat_comentarios;
DROP POLICY IF EXISTS "mat_comentarios_insert" ON public.mat_comentarios;
CREATE POLICY "mat_comentarios_select" ON public.mat_comentarios FOR SELECT TO authenticated
  USING (public.pode_ver_materiais());
CREATE POLICY "mat_comentarios_insert" ON public.mat_comentarios FOR INSERT TO authenticated
  WITH CHECK (public.pode_ver_materiais() AND autor_id = auth.uid());

DROP POLICY IF EXISTS "mat_reaberturas_select" ON public.mat_reaberturas;
CREATE POLICY "mat_reaberturas_select" ON public.mat_reaberturas FOR SELECT TO authenticated
  USING (public.pode_ver_materiais());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_pedidos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_pedidos TO service_role;
GRANT SELECT ON public.mat_pedido_envios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_pedido_envios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_pedido_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_pedido_itens TO service_role;
GRANT SELECT, INSERT, DELETE ON public.ceu_pedido_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceu_pedido_itens TO service_role;
GRANT SELECT, INSERT ON public.mat_comentarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_comentarios TO service_role;
GRANT SELECT ON public.mat_reaberturas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_reaberturas TO service_role;

-- ============================================================
-- C) Registro de envio do link (só service_role)
-- ============================================================
-- p_produtos: [{item_id, variacao_id, descricao_livre, qtd_kit, qtd_pedida,
--   preco_unitario, justificativa, excecao_acima_kit, excecao_validade,
--   excecao_fora_kit, ultima_entrega_em}] — já validado e com exceções
--   recalculadas pela Edge Function (chamada confiável).
-- p_ceu: [{tipo, nome_digitado, item_id, tamanho, qtd_pedida, cracha_nome,
--   cracha_motivo, cracha_cordao}]
-- Regra por fila: mescla (envio 'complemento') enquanto produtos < aprovado e
-- uniforme/EPI/crachá < conferido; depois vira pedido 'extra'.
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
        -- Complemento com exceção volta para validação; sem exceção só
        -- libera um pedido que ainda não tinha produtos.
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
  -- mesmo nome + mesma peça + mesmo tamanho; crachá com a mesma pessoa no
  -- mês (qualquer pedido não cancelado do contrato na competência).
  IF v_tem_ceu THEN
    FOR e IN SELECT * FROM jsonb_array_elements(v_ceu) LOOP
      v_tipo := e->>'tipo';
      IF v_tipo = 'cracha' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.ceu_pedido_itens c
            JOIN public.mat_pedidos p ON p.id = c.pedido_id
           WHERE p.contrato_id = p_contrato AND p.competencia = v_comp
             AND p.status_ceu <> 'cancelado' AND c.status <> 'cancelado'
             AND c.tipo = 'cracha' AND c.envio_id IS DISTINCT FROM v_env_ceu
             AND public.mat_normalizar_texto(c.nome_digitado) = public.mat_normalizar_texto(e->>'nome_digitado')
        ) INTO v_flag;
      ELSE
        SELECT EXISTS (
          SELECT 1 FROM public.ceu_pedido_itens c
           WHERE c.pedido_id = v_ped_ceu AND c.status <> 'cancelado'
             AND c.envio_id IS DISTINCT FROM v_env_ceu AND c.tipo = v_tipo
             AND c.item_id = nullif(e->>'item_id', '')::uuid
             AND public.mat_normalizar_texto(c.nome_digitado) = public.mat_normalizar_texto(e->>'nome_digitado')
             AND public.mat_normalizar_texto(c.tamanho) = public.mat_normalizar_texto(e->>'tamanho')
        ) INTO v_flag;
      END IF;
      INSERT INTO public.ceu_pedido_itens (pedido_id, envio_id, possivel_repeticao, nome_digitado,
        tipo, item_id, tamanho, qtd_pedida, cracha_nome, cracha_motivo, cracha_cordao)
      VALUES (v_ped_ceu, v_env_ceu, v_flag, btrim(e->>'nome_digitado'), v_tipo,
        CASE WHEN v_tipo = 'cracha' THEN NULL ELSE nullif(e->>'item_id', '')::uuid END,
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

-- ============================================================
-- D) RPCs de estado
-- ============================================================

-- Pedido interno (extra/operacional) em rascunho → enviado. Cria o envio e
-- liga as linhas ainda sem envio. Pedido com exceção vai para validação.
CREATE OR REPLACE FUNCTION public.enviar_pedido_interno(p_pedido uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.mat_pedidos%ROWTYPE;
  v_env uuid; v_exc boolean; v_nprod integer; v_nceu integer;
BEGIN
  SELECT * INTO p FROM public.mat_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_produtos <> 'rascunho' THEN RAISE EXCEPTION 'Pedido não está em rascunho'; END IF;
  IF NOT (p.criado_por = auth.uid() OR public.pode_aprovar_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para enviar este pedido';
  END IF;

  SELECT count(*), coalesce(bool_or(excecao_acima_kit OR excecao_validade OR excecao_fora_kit), false)
    INTO v_nprod, v_exc FROM public.mat_pedido_itens WHERE pedido_id = p_pedido;
  SELECT count(*) INTO v_nceu FROM public.ceu_pedido_itens WHERE pedido_id = p_pedido;
  IF v_nprod + v_nceu = 0 THEN RAISE EXCEPTION 'Pedido sem itens'; END IF;

  INSERT INTO public.mat_pedido_envios (pedido_id, sequencia, origem, seu_nome)
  VALUES (p_pedido, 1, 'original',
    coalesce((SELECT nome FROM public.perfis WHERE id = auth.uid()), 'Pedido interno'))
  RETURNING id INTO v_env;

  UPDATE public.mat_pedido_itens SET envio_id = v_env WHERE pedido_id = p_pedido AND envio_id IS NULL;
  UPDATE public.ceu_pedido_itens SET envio_id = v_env WHERE pedido_id = p_pedido AND envio_id IS NULL;

  UPDATE public.mat_pedidos
     SET status_produtos = CASE WHEN v_nprod = 0 THEN 'nao_se_aplica'
                                WHEN v_exc THEN 'em_validacao' ELSE 'validado' END,
         status_ceu = CASE WHEN v_nceu > 0 THEN 'enviado' ELSE 'nao_se_aplica' END,
         enviado_em = now()
   WHERE id = p_pedido;
END $$;

-- Inspetor: valida, corta (com motivo) e trata avisos de repetição.
-- p_itens: [{id, qtd_validada, motivo, decisao_repeticao('somar'|'descartar')}]
-- Linhas não citadas ficam validadas pela quantidade pedida. O aviso de
-- repetição NUNCA trava (ignorado = a linha conta normalmente).
CREATE OR REPLACE FUNCTION public.validar_pedido_materiais(p_pedido uuid, p_itens jsonb DEFAULT '[]'::jsonb, p_comentario text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
END $$;

-- Gestor: aprova. "Aprovar tudo" = qtd_aprovada := coalesce(validada, pedida);
-- ajuste item a item exige motivo. p_itens: [{id, qtd_aprovada, motivo_ajuste}]
CREATE OR REPLACE FUNCTION public.aprovar_pedido_materiais(p_pedido uuid, p_itens jsonb DEFAULT '[]'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
END $$;

-- Aprovação em massa do painel: pedidos validados dos contratos escolhidos.
CREATE OR REPLACE FUNCTION public.aprovar_lote_materiais(p_competencia date, p_contratos uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para aprovar pedidos';
  END IF;
  FOR r IN SELECT id FROM public.mat_pedidos
            WHERE competencia = date_trunc('month', p_competencia)::date
              AND contrato_id = ANY (p_contratos) AND status_produtos = 'validado'
            FOR UPDATE
  LOOP
    UPDATE public.mat_pedido_itens SET qtd_aprovada = coalesce(qtd_validada, qtd_pedida)
     WHERE pedido_id = r.id AND qtd_aprovada IS NULL;
    UPDATE public.mat_pedidos SET status_produtos = 'aprovado' WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Identificação do nome digitado (inspetoria/dp2). p_linhas:
-- [{id, colaborador_id, tamanho_cadastro, alerta_tamanho, fora_da_equipe}]
-- tamanho_cadastro/alerta/fora_da_equipe vêm do front (regras de tamanho e de
-- grupo de departamento vivem em TS); a última entrega é calculada aqui.
CREATE OR REPLACE FUNCTION public.identificar_linhas_pedido_ceu(p_linhas jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
           ultima_entrega_em = CASE WHEN l.item_id IS NULL THEN NULL ELSE
             (SELECT max(en.data_entrega) FROM public.entregas en
               WHERE en.colaborador_id = (e->>'colaborador_id')::uuid AND en.item_id = l.item_id) END,
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
END $$;

-- Conferência do inspetor. p_linhas: [{id, qtd_conferida, motivo_ajuste,
-- cancelar(bool)}]. Linha ainda não identificada não pode ser conferida.
-- Quando nada mais está a identificar/pendente, o pedido vira 'conferido'.
CREATE OR REPLACE FUNCTION public.conferir_itens_pedido_ceu(p_pedido uuid, p_linhas jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p public.mat_pedidos%ROWTYPE; e jsonb; l public.ceu_pedido_itens%ROWTYPE;
        v_qtd integer; v_motivo text;
BEGIN
  IF NOT public.pode_validar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para conferir pedidos';
  END IF;
  SELECT * INTO p FROM public.mat_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_ceu NOT IN ('enviado', 'em_identificacao', 'conferido') THEN
    RAISE EXCEPTION 'Pedido não está em conferência (%)', p.status_ceu;
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) LOOP
    SELECT * INTO l FROM public.ceu_pedido_itens WHERE id = (e->>'id')::uuid AND pedido_id = p_pedido FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não pertence ao pedido', e->>'id'; END IF;
    IF l.status IN ('atendido') THEN RAISE EXCEPTION 'Linha % já atendida', l.id; END IF;
    v_motivo := nullif(btrim(coalesce(e->>'motivo_ajuste', '')), '');
    IF coalesce((e->>'cancelar')::boolean, false) THEN
      IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo do cancelamento da linha %', l.id; END IF;
      UPDATE public.ceu_pedido_itens
         SET status = 'cancelado', motivo_ajuste = v_motivo, conferido_por = auth.uid(), conferido_em = now()
       WHERE id = l.id;
      CONTINUE;
    END IF;
    IF l.status = 'a_identificar' THEN
      RAISE EXCEPTION 'Identifique o colaborador da linha % antes de conferir', l.id;
    END IF;
    v_qtd := coalesce(nullif(e->>'qtd_conferida', '')::integer, l.qtd_pedida);
    IF v_qtd <> l.qtd_pedida AND v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo do ajuste da linha %', l.id;
    END IF;
    UPDATE public.ceu_pedido_itens
       SET qtd_conferida = v_qtd, motivo_ajuste = coalesce(v_motivo, motivo_ajuste),
           status = CASE WHEN v_qtd = l.qtd_pedida THEN 'conferido' ELSE 'ajustado' END,
           conferido_por = auth.uid(), conferido_em = now()
     WHERE id = l.id;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.ceu_pedido_itens
                  WHERE pedido_id = p_pedido AND status IN ('a_identificar', 'pendente')) THEN
    UPDATE public.mat_pedidos SET status_ceu = 'conferido' WHERE id = p_pedido AND status_ceu <> 'conferido';
  END IF;
END $$;

-- Atendimento da Beth: marca linhas conferidas como atendidas.
CREATE OR REPLACE FUNCTION public.atender_itens_pedido_ceu(p_linhas uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT public.pode_atender_pedido_ceu() THEN
    RAISE EXCEPTION 'Sem permissão para atender pedidos';
  END IF;
  FOR r IN SELECT DISTINCT pedido_id FROM public.ceu_pedido_itens WHERE id = ANY (p_linhas) LOOP
    PERFORM 1 FROM public.mat_pedidos WHERE id = r.pedido_id FOR UPDATE;
  END LOOP;

  UPDATE public.ceu_pedido_itens
     SET status = 'atendido', atendido_por = auth.uid(), atendido_em = now()
   WHERE id = ANY (p_linhas) AND status IN ('conferido', 'ajustado');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n < coalesce(array_length(p_linhas, 1), 0) THEN
    RAISE EXCEPTION 'Só linhas conferidas podem ser atendidas (% de % atendidas)', n, array_length(p_linhas, 1);
  END IF;

  FOR r IN SELECT DISTINCT pedido_id FROM public.ceu_pedido_itens WHERE id = ANY (p_linhas) LOOP
    UPDATE public.mat_pedidos p
       SET status_ceu = CASE WHEN NOT EXISTS (
             SELECT 1 FROM public.ceu_pedido_itens c
              WHERE c.pedido_id = r.pedido_id AND c.status NOT IN ('atendido', 'cancelado'))
           THEN 'atendido' ELSE 'em_atendimento' END
     WHERE p.id = r.pedido_id;
  END LOOP;
  RETURN n;
END $$;

-- Reabertura do link fora da janela 1–15 (gestor/mesa).
CREATE OR REPLACE FUNCTION public.reabrir_pedido_materiais(p_contrato uuid, p_competencia date, p_ate date, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_alterar_rota_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para reabrir pedidos';
  END IF;
  IF btrim(coalesce(p_motivo, '')) = '' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  IF p_ate IS NULL THEN RAISE EXCEPTION 'Informe até quando o link fica aberto'; END IF;
  INSERT INTO public.mat_reaberturas (contrato_id, competencia, ate, motivo)
  VALUES (p_contrato, date_trunc('month', p_competencia)::date, p_ate, p_motivo);
  UPDATE public.mat_pedidos SET reaberto_por = auth.uid(), reaberto_em = now()
   WHERE contrato_id = p_contrato AND competencia = date_trunc('month', p_competencia)::date
     AND tipo = 'mensal' AND status_produtos <> 'cancelado';
END $$;

-- Rota do dia de um pedido (override); p_rota NULL volta ao padrão.
CREATE OR REPLACE FUNCTION public.definir_rota_pedido(p_pedido uuid, p_rota smallint, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_alterar_rota_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para alterar a rota do pedido';
  END IF;
  IF p_rota IS NOT NULL AND p_rota NOT IN (1, 2, 3) THEN RAISE EXCEPTION 'Rota inválida: %', p_rota; END IF;
  IF p_rota IS NOT NULL AND btrim(coalesce(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da troca de rota';
  END IF;
  UPDATE public.mat_pedidos
     SET rota_override = p_rota,
         rota_override_motivo = CASE WHEN p_rota IS NULL THEN NULL ELSE p_motivo END,
         rota_override_por = CASE WHEN p_rota IS NULL THEN NULL ELSE auth.uid() END
   WHERE id = p_pedido;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
END $$;

-- "Preencher pelo kit" (gestor/admin/inspetoria): só depois da cobrança ao
-- líder. Respeita periodicidade_meses (item de periodicidade N só entra se
-- não houve consumo nos N-1 meses anteriores). Recusa se já houver pedido
-- mensal na competência. Marca preenchido_pelo_escritorio.
CREATE OR REPLACE FUNCTION public.preencher_pedido_pelo_kit(p_contrato uuid, p_competencia date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_comp date := date_trunc('month', p_competencia)::date;
  v_zero constant uuid := '00000000-0000-0000-0000-000000000000';
  v_ped uuid; v_env uuid; k record;
BEGIN
  IF NOT public.pode_validar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para preencher pedidos pelo kit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mat_contratos WHERE id = p_contrato AND ativo) THEN
    RAISE EXCEPTION 'Contrato inexistente ou inativo';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_contrato::text || v_comp::text, 0));
  IF EXISTS (SELECT 1 FROM public.mat_pedidos
              WHERE contrato_id = p_contrato AND competencia = v_comp
                AND tipo = 'mensal' AND status_produtos <> 'cancelado') THEN
    RAISE EXCEPTION 'Já existe pedido mensal deste contrato na competência';
  END IF;

  INSERT INTO public.mat_pedidos (contrato_id, competencia, tipo, origem, preenchido_pelo_escritorio,
    responsavel_nome, status_produtos, status_ceu, enviado_em, criado_por)
  VALUES (p_contrato, v_comp, 'mensal', 'escritorio', true,
    (SELECT nome FROM public.perfis WHERE id = auth.uid()),
    'validado', 'nao_se_aplica', now(), auth.uid())
  RETURNING id INTO v_ped;
  INSERT INTO public.mat_pedido_envios (pedido_id, sequencia, origem, seu_nome)
  VALUES (v_ped, 1, 'original', coalesce((SELECT nome FROM public.perfis WHERE id = auth.uid()), 'Escritório'))
  RETURNING id INTO v_env;

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
      qtd_validada, preco_unitario)
    VALUES (v_ped, v_env, k.item_id, k.variacao_id, k.quantidade, k.quantidade, k.quantidade,
      public.mat_preco_vigente(k.item_id, k.variacao_id, v_comp));
  END LOOP;
  RETURN v_ped;
END $$;

-- Painel "Contratos que ainda não pediram": contratos ativos que recebem
-- limpeza ou têm kit, sem pedido mensal na competência. (O plano diz "ou com
-- equipe"; a equipe vem de departamentos e é resolvida no front, então aqui o
-- critério é recebe_limpeza OU kit cadastrado.)
CREATE OR REPLACE FUNCTION public.mat_contratos_sem_pedido(p_competencia date)
RETURNS TABLE (
  contrato_id uuid, nome text, departamento_id uuid, rota smallint,
  ultimo_responsavel text, link_aberto_no_mes boolean, tem_link boolean
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
           EXISTS (SELECT 1 FROM public.mat_contrato_acesso a WHERE a.contrato_id = c.id AND a.ativo)
      FROM public.mat_contratos c
     WHERE c.ativo
       AND (c.recebe_limpeza OR EXISTS (SELECT 1 FROM public.mat_kit_itens k WHERE k.contrato_id = c.id))
       AND NOT EXISTS (SELECT 1 FROM public.mat_pedidos p
                        WHERE p.contrato_id = c.id AND p.competencia = v_comp AND p.tipo = 'mensal'
                          AND p.status_produtos NOT IN ('rascunho', 'cancelado'))
     ORDER BY c.nome;
END $$;

-- Permissões das funções: nunca PUBLIC/anon; mat_registrar_envio só service_role.
REVOKE ALL ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mat_registrar_envio(uuid, date, text, jsonb, text, inet, text, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.enviar_pedido_interno(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validar_pedido_materiais(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aprovar_pedido_materiais(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aprovar_lote_materiais(date, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.identificar_linhas_pedido_ceu(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conferir_itens_pedido_ceu(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atender_itens_pedido_ceu(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reabrir_pedido_materiais(uuid, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_rota_pedido(uuid, smallint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preencher_pedido_pelo_kit(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mat_contratos_sem_pedido(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enviar_pedido_interno(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_pedido_materiais(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_pedido_materiais(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_lote_materiais(date, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.identificar_linhas_pedido_ceu(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conferir_itens_pedido_ceu(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atender_itens_pedido_ceu(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_pedido_materiais(uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_rota_pedido(uuid, smallint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preencher_pedido_pelo_kit(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mat_contratos_sem_pedido(date) TO authenticated;
