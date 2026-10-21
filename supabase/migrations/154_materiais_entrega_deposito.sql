-- ============================================================
-- 154 — Materiais: fornecedor que entrega no DEPÓSITO da Plena, separação
--       por posto (inspetores) e rota "Depósito Plena"
-- ============================================================
-- Decisões da gestora (21/10/2026, planilha "Pedido Antolimp e Separação Oper").
-- Depende da 146, 147, 150, 151 e 152 (aplicadas). Independente da 153.
--
-- Rotina real: a Antolimp é o fornecedor principal (recebe a matriz item x
-- contrato com rota e entrega posto a posto). Essex/RZK e Compra Avulsa entregam
-- TUDO no depósito da Plena; os inspetores separam por contrato (aba SEPARAÇÃO
-- OPER) e a Antolimp leva junto na rota dela. Alguns contratos não recebem em
-- rota ("Entregar no Depósito Plena" — a Plena leva).
--
-- A) fornecedores.entrega_deposito (boolean): a compra a esse fornecedor sai com o
--    TOTAL por item (sem colunas por contrato) e "Entregar no depósito Plena".
--    mat_compras.entrega_deposito é o SNAPSHOT (criado no rascunho e renovado no
--    envio) — compra enviada nunca muda por troca posterior do cadastro.
--    O detalhe interno da compra (mat_compra_itens por contrato) NÃO muda: o
--    sistema continua sabendo o que é de cada posto.
-- B) Rota "Depósito Plena" = rota 0. CHECKs de mat_contratos.rota,
--    mat_pedidos.rota_override e mat_compra_itens.rota passam a (0,1,2,3,4) e as
--    RPCs definir_rota_contrato / definir_rota_pedido aceitam 0. As demais RPCs
--    (mat_previa_compra, mat_gerar_compras, mat_enviar_compra, mat_chegadas) leem
--    a rota como número e NÃO mudam; contrato com rota 0 não conta em
--    "contratos sem rota" (que só olha NULL).
-- C) Entrega via depósito: mat_pedido_itens ganha via_deposito, qtd_separada,
--    separado_em, separado_por. A chegada de compra de depósito grava só
--    qtd_recebida_fornecedor (chegou NO DEPÓSITO) e NÃO conta como entregue ao
--    posto; a linha só fecha quando é SEPARADA pelo posto (RPC
--    mat_registrar_separacao_deposito) — DECISÃO A CONFIRMAR: separada = entregue
--    (a Plena não tem como confirmar a entrega da Antolimp na rota nem a ida da
--    própria Plena aos contratos de "Entregar no Depósito Plena").
-- D) Leituras agregadas no servidor (sem o corte de 1.000 linhas):
--    mat_separacao_deposito(p_competencia) — lista de separação dos inspetores;
--    mat_levar_do_deposito(p_competencia) — o que a Antolimp pega no depósito.
--
-- Funções recriadas a partir do pg_get_functiondef REAL de produção (21/10/2026;
-- backup em dados-locais/backup_materiais_154_2026-10-21/funcoes/), mantendo o
-- lote da 150, o remanejado da 151, o múltiplo da 152 e o sinal corh.mat_fase2:
-- mat_pedido_itens_guarda_fase2, mat_linha_entrega_fechada, mat_rascunho_compra,
-- mat_enviar_compra, mat_registrar_chegada, definir_rota_contrato,
-- definir_rota_pedido. Sem tabela nova — sem GRANT de tabela; EXECUTE explícito
-- nas 2 RPCs de leitura e na de separação. Idempotente. NÃO aplicada.
-- Aplicar por ARQUIVO UTF-8 (scripts/lib/executar-arquivo-sql-management-api.ps1).

-- ------------------------------------------------------------
-- A) Fornecedor e snapshot na compra
-- ------------------------------------------------------------
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS entrega_deposito boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.fornecedores.entrega_deposito IS
  'Entrega tudo no depósito da Plena (migration 154): o Excel ao fornecedor sai só com o total por item e os inspetores separam por posto.';

ALTER TABLE public.mat_compras
  ADD COLUMN IF NOT EXISTS entrega_deposito boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.mat_compras.entrega_deposito IS
  'Snapshot de fornecedores.entrega_deposito (criado no rascunho, renovado no envio — migration 154).';

-- ------------------------------------------------------------
-- B) Rota 0 = "Depósito Plena"
-- ------------------------------------------------------------
ALTER TABLE public.mat_contratos DROP CONSTRAINT IF EXISTS mat_contratos_rota_check;
ALTER TABLE public.mat_contratos
  ADD CONSTRAINT mat_contratos_rota_check CHECK (rota IN (0, 1, 2, 3, 4));
ALTER TABLE public.mat_pedidos DROP CONSTRAINT IF EXISTS mat_pedidos_rota_override_check;
ALTER TABLE public.mat_pedidos
  ADD CONSTRAINT mat_pedidos_rota_override_check CHECK (rota_override IN (0, 1, 2, 3, 4));
ALTER TABLE public.mat_compra_itens DROP CONSTRAINT IF EXISTS mat_compra_itens_rota_check;
ALTER TABLE public.mat_compra_itens
  ADD CONSTRAINT mat_compra_itens_rota_check CHECK (rota IN (0, 1, 2, 3, 4));

CREATE OR REPLACE FUNCTION public.definir_rota_contrato(p_contrato uuid, p_rota smallint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.pode_alterar_rota_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para alterar a rota do contrato';
  END IF;
  IF p_rota IS NOT NULL AND p_rota NOT IN (0, 1, 2, 3, 4) THEN
    RAISE EXCEPTION 'Rota inválida: %', p_rota;
  END IF;
  UPDATE public.mat_contratos SET rota = p_rota WHERE id = p_contrato;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.definir_rota_pedido(p_pedido uuid, p_rota smallint, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.pode_alterar_rota_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para alterar a rota do pedido';
  END IF;
  IF p_rota IS NOT NULL AND p_rota NOT IN (0, 1, 2, 3, 4) THEN RAISE EXCEPTION 'Rota inválida: %', p_rota; END IF;
  IF p_rota IS NOT NULL AND btrim(coalesce(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da troca de rota';
  END IF;
  UPDATE public.mat_pedidos
     SET rota_override = p_rota,
         rota_override_motivo = CASE WHEN p_rota IS NULL THEN NULL ELSE p_motivo END,
         rota_override_por = CASE WHEN p_rota IS NULL THEN NULL ELSE auth.uid() END
   WHERE id = p_pedido;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
END $function$
;

-- ------------------------------------------------------------
-- C) Colunas da entrega via depósito + guarda
-- ------------------------------------------------------------
ALTER TABLE public.mat_pedido_itens
  ADD COLUMN IF NOT EXISTS via_deposito boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qtd_separada numeric,
  ADD COLUMN IF NOT EXISTS separado_em date,
  ADD COLUMN IF NOT EXISTS separado_por uuid;

ALTER TABLE public.mat_pedido_itens DROP CONSTRAINT IF EXISTS mat_pedido_itens_separada_ck;
ALTER TABLE public.mat_pedido_itens
  ADD CONSTRAINT mat_pedido_itens_separada_ck CHECK (
    (qtd_separada IS NULL AND separado_em IS NULL)
    OR (qtd_separada IS NOT NULL AND qtd_separada >= 0 AND separado_em IS NOT NULL AND via_deposito));

COMMENT ON COLUMN public.mat_pedido_itens.via_deposito IS
  'A parte comprada desta linha chega ao depósito da Plena e é separada pelos inspetores (migration 154). Definido no envio da compra.';
COMMENT ON COLUMN public.mat_pedido_itens.qtd_separada IS
  'Quanto foi separado para o posto no depósito (migration 154). Conta como entregue ao posto (decisão a confirmar).';

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
      NEW.qtd_entregue_remanejada, NEW.remanejado_confirmado_em, NEW.remanejado_confirmado_por,
      NEW.via_deposito, NEW.qtd_separada, NEW.separado_em, NEW.separado_por)
     IS DISTINCT FROM
     (OLD.atendimento, OLD.qtd_estoque, OLD.qtd_compra, OLD.compra_item_id, OLD.motivo_nao_atendido,
      OLD.atendimento_por, OLD.atendimento_em, OLD.qtd_entregue_estoque, OLD.qtd_recebida_fornecedor,
      OLD.qtd_entregue, OLD.motivo_entrega, OLD.entregue_em, OLD.entregue_por,
      OLD.qtd_remanejada, OLD.remanejado_de_contrato_id, OLD.remanejamento_obs,
      OLD.qtd_entregue_remanejada, OLD.remanejado_confirmado_em, OLD.remanejado_confirmado_por,
      OLD.via_deposito, OLD.qtd_separada, OLD.separado_em, OLD.separado_por) THEN
    RAISE EXCEPTION 'Destino e entrega da linha só mudam pelas telas de compra, separação e chegada';
  END IF;
  IF OLD.atendimento IS NOT NULL AND (NEW.qtd_aprovada IS DISTINCT FROM OLD.qtd_aprovada
       OR NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.variacao_id IS DISTINCT FROM OLD.variacao_id) THEN
    RAISE EXCEPTION 'Linha com destino na compra não muda mais (item e quantidade aprovada)';
  END IF;
  RETURN NEW;
END $function$
;

-- A linha só fecha quando a parte do fornecedor chegou; se a compra é de depósito,
-- também quando foi separada para o posto (ou nada chegou: 0 recebido).
CREATE OR REPLACE FUNCTION public.mat_linha_entrega_fechada(l mat_pedido_itens)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT l.atendimento = 'nao_atendido'
      OR (l.atendimento IS NOT NULL
          AND (CASE WHEN l.atendimento = 'escritorio' THEN l.qtd_entregue_estoque IS NOT NULL
                    ELSE coalesce(l.qtd_estoque, 0) = 0 OR l.qtd_entregue_estoque IS NOT NULL END)
          AND (coalesce(l.qtd_compra, 0) = 0
               OR (l.qtd_recebida_fornecedor IS NOT NULL
                   -- 154: compra de depósito só fecha depois da separação para o posto.
                   AND (NOT coalesce(l.via_deposito, false)
                        OR l.qtd_recebida_fornecedor = 0
                        OR l.separado_em IS NOT NULL)))
          -- 151: a parte remanejada só fecha com "remanejamento feito" confirmado.
          AND (coalesce(l.qtd_remanejada, 0) = 0 OR l.qtd_entregue_remanejada IS NOT NULL));
$function$
;

-- ------------------------------------------------------------
-- Rascunho e envio: snapshot do flag do fornecedor
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mat_rascunho_compra(p_competencia date, p_fornecedor uuid, p_tipo text, p_observacao text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; n integer; v_hoje date := public.mat_hoje();
BEGIN
  SELECT id INTO v_id FROM public.mat_compras
   WHERE competencia = p_competencia AND fornecedor_id = p_fornecedor AND tipo = p_tipo AND status = 'rascunho'
   ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF FOUND THEN RETURN v_id; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mat_compras_numero' || p_competencia::text, 0));
  SELECT count(*) + 1 INTO n FROM public.mat_compras WHERE competencia = p_competencia;
  INSERT INTO public.mat_compras (competencia, fornecedor_id, numero, tipo, antes_da_janela, observacao, entrega_deposito)
  VALUES (p_competencia, p_fornecedor,
          'COMP-' || to_char(p_competencia, 'YYYY-MM') || '-' || lpad(n::text, 3, '0'),
          p_tipo,
          p_tipo <> 'reposicao_estoque'
            AND extract(day FROM v_hoje) < public.mat_config_dia('dia_inicio_compra', 20)
            AND date_trunc('month', v_hoje)::date = p_competencia,
          nullif(btrim(coalesce(p_observacao, '')), ''),
          coalesce((SELECT f.entrega_deposito FROM public.fornecedores f WHERE f.id = p_fornecedor), false))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.mat_enviar_compra(p_compra uuid, p_entrega_prevista date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.mat_compras%ROWTYPE; v_pedidos uuid[]; v_dep boolean;
BEGIN
  IF NOT public.pode_comprar_materiais() THEN RAISE EXCEPTION 'Sem permissão para enviar a compra'; END IF;
  SELECT * INTO c FROM public.mat_compras WHERE id = p_compra FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
  IF c.status <> 'rascunho' THEN RAISE EXCEPTION 'Só compra em rascunho pode ser enviada (%)', c.status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mat_compra_itens WHERE compra_id = p_compra) THEN
    RAISE EXCEPTION 'Compra sem itens';
  END IF;
  -- 154: congela se a compra é de fornecedor que entrega no depósito da Plena.
  v_dep := coalesce((SELECT f.entrega_deposito FROM public.fornecedores f WHERE f.id = c.fornecedor_id), false);
  UPDATE public.mat_compra_itens ci
     SET rota = coalesce((SELECT public.mat_rota_efetiva_linha(l.id) FROM public.mat_pedido_itens l
                           WHERE l.compra_item_id = ci.id ORDER BY l.created_at LIMIT 1), ci.rota)
   WHERE ci.compra_id = p_compra AND ci.contrato_id IS NOT NULL;
  UPDATE public.mat_compras
     SET status = 'enviada', enviada_em = now(), enviada_por = auth.uid(),
         entrega_prevista = coalesce(p_entrega_prevista, entrega_prevista),
         entrega_deposito = v_dep
   WHERE id = p_compra;
  -- Sinal para a guarda de mat_pedido_itens; desligado antes de retornar.
  PERFORM set_config('corh.mat_fase2', 'on', true);
  UPDATE public.mat_pedido_itens l
     SET via_deposito = v_dep
    FROM public.mat_compra_itens ci
   WHERE ci.id = l.compra_item_id AND ci.compra_id = p_compra AND l.via_deposito IS DISTINCT FROM v_dep;
  SELECT array_agg(DISTINCT l.pedido_id) INTO v_pedidos
    FROM public.mat_pedido_itens l JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
   WHERE ci.compra_id = p_compra;
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(coalesce(v_pedidos, '{}')) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('id', p_compra, 'numero', c.numero, 'pedidos', coalesce(array_length(v_pedidos, 1), 0),
                            'entrega_deposito', v_dep);
END $function$
;

-- ------------------------------------------------------------
-- Chegada: compra de depósito grava só "chegou no depósito"
-- ------------------------------------------------------------
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
        IF c.entrega_deposito THEN
          -- 154: chegou no DEPÓSITO da Plena — ainda não é entrega ao posto (qtd_entregue só muda na separação).
          IF l.qtd_separada IS NOT NULL AND v_r < l.qtd_separada THEN
            RAISE EXCEPTION 'A linha de "%" no posto % já foi separada (%); corrija a separação antes de reduzir a chegada',
              ci.item_nome, coalesce(ci.contrato_nome, ''), l.qtd_separada;
          END IF;
          UPDATE public.mat_pedido_itens
             SET qtd_recebida_fornecedor = v_r,
                 motivo_entrega = CASE WHEN v_r < l.qtd_compra THEN v_motivo ELSE motivo_entrega END
           WHERE id = l.id;
        ELSE
          UPDATE public.mat_pedido_itens
             SET qtd_recebida_fornecedor = v_r,
                 qtd_entregue = coalesce(qtd_entregue_estoque, 0) + v_r + coalesce(qtd_entregue_remanejada, 0),
                 motivo_entrega = CASE WHEN v_r < l.qtd_compra THEN v_motivo ELSE motivo_entrega END,
                 entregue_em = v_data, entregue_por = auth.uid()
           WHERE id = l.id;
        END IF;
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
END $function$
;

-- ------------------------------------------------------------
-- Separação no depósito (inspetores) — escrita
-- ------------------------------------------------------------
-- p_linhas: [{"id": <linha do pedido>, "qtd": n (padrão = o que chegou), "motivo": "..."}].
-- Pode corrigir uma separação já feita. Mesmas pessoas que movimentam o estoque
-- (admin, adm, gestor, mesa e inspetoria).
CREATE OR REPLACE FUNCTION public.mat_registrar_separacao_deposito(p_linhas jsonb, p_data date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE e jsonb; l public.mat_pedido_itens%ROWTYPE; v_plan numeric; v_qtd numeric; v_motivo text;
        v_data date := coalesce(p_data, public.mat_hoje()); v_pedidos uuid[] := '{}'; n integer := 0;
BEGIN
  -- Sinal para a guarda de mat_pedido_itens; desligado antes de retornar.
  PERFORM set_config('corh.mat_fase2', 'on', true);
  IF NOT public.pode_movimentar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para registrar a separação no depósito';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) LOOP
    SELECT * INTO l FROM public.mat_pedido_itens WHERE id = (e->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não encontrada', e->>'id'; END IF;
    IF NOT l.via_deposito OR coalesce(l.qtd_compra, 0) <= 0 THEN
      RAISE EXCEPTION 'A linha % não vem de compra entregue no depósito', l.id;
    END IF;
    IF l.qtd_recebida_fornecedor IS NULL THEN
      RAISE EXCEPTION 'A chegada no depósito ainda não foi registrada (linha %)', l.id;
    END IF;
    v_plan := l.qtd_recebida_fornecedor;
    v_qtd := coalesce(nullif(e->>'qtd', '')::numeric, v_plan);
    v_motivo := nullif(btrim(coalesce(e->>'motivo', '')), '');
    IF v_qtd < 0 OR v_qtd > v_plan THEN RAISE EXCEPTION 'Quantidade separada inválida na linha %', l.id; END IF;
    IF v_qtd < v_plan AND v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo de separar menos do que chegou (linha %)', l.id;
    END IF;
    UPDATE public.mat_pedido_itens
       SET qtd_separada = v_qtd, separado_em = v_data, separado_por = auth.uid(),
           qtd_entregue = coalesce(qtd_entregue_estoque, 0) + v_qtd + coalesce(qtd_entregue_remanejada, 0),
           motivo_entrega = CASE WHEN v_qtd < v_plan THEN v_motivo ELSE motivo_entrega END,
           entregue_em = v_data, entregue_por = auth.uid()
     WHERE id = l.id;
    IF NOT l.pedido_id = ANY (v_pedidos) THEN v_pedidos := v_pedidos || l.pedido_id; END IF;
    n := n + 1;
  END LOOP;
  PERFORM public.mat_recalcular_status_entrega(x) FROM unnest(v_pedidos) x;
  PERFORM set_config('corh.mat_fase2', '', true);
  RETURN jsonb_build_object('linhas', n);
END $function$
;

REVOKE ALL ON FUNCTION public.mat_registrar_separacao_deposito(jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_registrar_separacao_deposito(jsonb, date) TO authenticated, service_role;

-- ------------------------------------------------------------
-- Lista de separação (leitura) — o que chegou dos fornecedores de depósito, por posto
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mat_separacao_deposito(p_competencia date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_comp date := date_trunc('month', p_competencia)::date; v_linhas jsonb;
BEGIN
  IF NOT (public.pode_movimentar_estoque_materiais() OR public.pode_ver_compras_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para ver a separação no depósito';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'linha_id', l.id, 'pedido_id', p.id, 'competencia', p.competencia,
           'contrato_id', c.id, 'contrato_nome', c.nome, 'rota', coalesce(p.rota_override, c.rota),
           'parte', l.parte, 'item_id', l.item_id, 'variacao_id', l.variacao_id,
           'item_nome', it.nome, 'variacao_rotulo', v.rotulo, 'unidade', it.unidade_pedido,
           'qtd_compra', l.qtd_compra, 'qtd_recebida', l.qtd_recebida_fornecedor,
           'qtd_separada', l.qtd_separada, 'separado_em', l.separado_em, 'separado_por', l.separado_por,
           'motivo_entrega', l.motivo_entrega, 'status_pedido', p.status_produtos,
           'compra_id', cp.id, 'compra_numero', cp.numero, 'compra_status', cp.status,
           'competencia_compra', cp.competencia, 'fornecedor_nome', f.nome)
         ORDER BY coalesce(p.rota_override, c.rota) NULLS LAST, c.nome, it.nome, v.rotulo), '[]'::jsonb)
    INTO v_linhas
    FROM public.mat_pedido_itens l
    JOIN public.mat_pedidos p ON p.id = l.pedido_id
    JOIN public.mat_contratos c ON c.id = p.contrato_id
    JOIN public.mat_compra_itens ci ON ci.id = l.compra_item_id
    JOIN public.mat_compras cp ON cp.id = ci.compra_id
    LEFT JOIN public.fornecedores f ON f.id = cp.fornecedor_id
    LEFT JOIN public.mat_itens it ON it.id = l.item_id
    LEFT JOIN public.mat_item_variacoes v ON v.id = l.variacao_id
   WHERE cp.entrega_deposito
     AND cp.status IN ('enviada', 'recebida_parcial', 'recebida')
     AND coalesce(l.qtd_compra, 0) > 0
     AND p.status_produtos <> 'cancelado'
     AND (cp.competencia = v_comp
          OR (cp.competencia < v_comp AND l.separado_em IS NULL AND coalesce(l.qtd_recebida_fornecedor, 0) > 0));
  RETURN jsonb_build_object('competencia', v_comp, 'hoje', public.mat_hoje(), 'linhas', v_linhas);
END $function$
;

REVOKE ALL ON FUNCTION public.mat_separacao_deposito(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_separacao_deposito(date) TO authenticated, service_role;

-- ------------------------------------------------------------
-- "Levar do depósito" (leitura) — o que a Antolimp pega e leva junto na rota
-- ------------------------------------------------------------
-- Células por posto das compras de fornecedor de depósito da competência (não
-- canceladas; vale também rascunho, para o Excel sair antes de a Essex entregar).
CREATE OR REPLACE FUNCTION public.mat_levar_do_deposito(p_competencia date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_comp date := date_trunc('month', p_competencia)::date; v_linhas jsonb;
BEGIN
  IF NOT (public.pode_comprar_materiais() OR public.pode_ver_compras_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para ver a compra de materiais';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'celula_id', ci.id, 'compra_id', cp.id, 'compra_numero', cp.numero, 'compra_status', cp.status,
           'fornecedor_nome', f.nome, 'contrato_id', ci.contrato_id, 'contrato_nome', coalesce(ci.contrato_nome, c.nome),
           'rota', coalesce(ci.rota, c.rota), 'item_id', ci.item_id, 'variacao_id', ci.variacao_id,
           'item_nome', ci.item_nome, 'variacao_rotulo', ci.variacao_rotulo, 'unidade', ci.unidade,
           'quantidade', ci.quantidade, 'qtd_recebida', ci.qtd_recebida)
         ORDER BY coalesce(ci.rota, c.rota) NULLS LAST, coalesce(ci.contrato_nome, c.nome), ci.item_nome, ci.variacao_rotulo), '[]'::jsonb)
    INTO v_linhas
    FROM public.mat_compra_itens ci
    JOIN public.mat_compras cp ON cp.id = ci.compra_id
    LEFT JOIN public.mat_contratos c ON c.id = ci.contrato_id
    LEFT JOIN public.fornecedores f ON f.id = cp.fornecedor_id
   WHERE cp.entrega_deposito AND cp.status <> 'cancelada' AND cp.competencia = v_comp
     AND ci.contrato_id IS NOT NULL AND ci.quantidade > 0;
  RETURN jsonb_build_object('competencia', v_comp, 'linhas', v_linhas);
END $function$
;

REVOKE ALL ON FUNCTION public.mat_levar_do_deposito(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_levar_do_deposito(date) TO authenticated, service_role;

-- ============================================================
-- Conferência final (aborta se algo não bater)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname LIKE 'mat\_%' ESCAPE '\'
                AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%') THEN
    RAISE EXCEPTION '154: função mat_* com caractere corrompido (chr 65533) — aplique pelo script de ARQUIVO UTF-8';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname IN ('definir_rota_contrato', 'definir_rota_pedido')
                AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%') THEN
    RAISE EXCEPTION '154: definir_rota_* com caractere corrompido (chr 65533)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'fornecedores' AND column_name = 'entrega_deposito')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'mat_pedido_itens' AND column_name = 'qtd_separada') THEN
    RAISE EXCEPTION '154: colunas ausentes';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN ('mat_separacao_deposito', 'mat_levar_do_deposito', 'mat_registrar_separacao_deposito')) <> 3 THEN
    RAISE EXCEPTION '154: RPCs novas ausentes';
  END IF;
END $$;
