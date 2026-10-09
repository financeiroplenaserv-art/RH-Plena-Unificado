-- Migração 124: Módulo Materiais (Fase 1) — ajustes das filas internas
--
-- Complementa a 122 (docs/PLANO_MATERIAIS_FASE1.md, seções 5.1 e 6) com o que
-- as telas das filas precisam e a 122 não cobria. NÃO edita a 122.
--  A) ceu_pedido_itens ganha qtd_atendida e motivo_atendimento: a Beth registra
--     quanto entregou de fato (motivo obrigatório quando menor que o conferido);
--  B) RPC atender_linhas_pedido_ceu(p_linhas jsonb) — atendimento com quantidade
--     (a atender_itens_pedido_ceu da 122 continua valendo: atende pelo conferido);
--  C) preencher_pedido_pelo_kit passa a APROVEITAR o pedido mensal que o líder
--     já enviou só com uniforme/EPI/crachá (status_produtos = 'nao_se_aplica'):
--     as linhas do kit entram nele como envio 'complemento' do escritório, em
--     vez de recusar. Pedido que já tem produtos continua recusado;
--  D) mat_contratos_sem_pedido passa a listar também esse caso (contrato que
--     recebe limpeza e só pediu uniforme/EPI/crachá) e devolve pedido_id.
--
-- Sem tabela nova — sem GRANT de tabela. Idempotente.
-- NÃO aplicar sem decisão do usuário (backup antes: ceu_pedido_itens e as
-- definições atuais das duas funções recriadas).

-- ============================================================
-- A) Colunas do atendimento
-- ============================================================
ALTER TABLE public.ceu_pedido_itens ADD COLUMN IF NOT EXISTS qtd_atendida integer;
ALTER TABLE public.ceu_pedido_itens ADD COLUMN IF NOT EXISTS motivo_atendimento text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ceu_pedido_itens_qtd_atendida_ck') THEN
    ALTER TABLE public.ceu_pedido_itens
      ADD CONSTRAINT ceu_pedido_itens_qtd_atendida_ck CHECK (qtd_atendida IS NULL OR qtd_atendida >= 0);
  END IF;
END $$;

-- ============================================================
-- B) Atendimento com quantidade. p_linhas: [{id, qtd_atendida, motivo}]
-- Sem qtd_atendida = quantidade conferida. Menor que o conferido exige motivo;
-- maior é recusado. Só linhas conferidas/ajustadas.
-- ============================================================
CREATE OR REPLACE FUNCTION public.atender_linhas_pedido_ceu(p_linhas jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE e jsonb; l public.ceu_pedido_itens%ROWTYPE; n integer := 0;
        v_base integer; v_qtd integer; v_motivo text; r record;
BEGIN
  IF NOT public.pode_atender_pedido_ceu() THEN
    RAISE EXCEPTION 'Sem permissão para atender pedidos';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) LOOP
    SELECT * INTO l FROM public.ceu_pedido_itens WHERE id = (e->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não encontrada', e->>'id'; END IF;
    IF l.status NOT IN ('conferido', 'ajustado') THEN
      RAISE EXCEPTION 'Só linhas conferidas podem ser atendidas (linha %)', l.id;
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
    UPDATE public.ceu_pedido_itens
       SET status = 'atendido', qtd_atendida = v_qtd, motivo_atendimento = v_motivo,
           atendido_por = auth.uid(), atendido_em = now()
     WHERE id = l.id;
    n := n + 1;
  END LOOP;

  FOR r IN SELECT DISTINCT c.pedido_id FROM public.ceu_pedido_itens c
            WHERE c.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) x) LOOP
    UPDATE public.mat_pedidos p
       SET status_ceu = CASE WHEN NOT EXISTS (
             SELECT 1 FROM public.ceu_pedido_itens c
              WHERE c.pedido_id = r.pedido_id AND c.status NOT IN ('atendido', 'cancelado'))
           THEN 'atendido' ELSE 'em_atendimento' END
     WHERE p.id = r.pedido_id;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.atender_linhas_pedido_ceu(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atender_linhas_pedido_ceu(jsonb) TO authenticated;

-- ============================================================
-- C) "Preencher pelo kit" aproveitando o envio do líder
-- ============================================================
CREATE OR REPLACE FUNCTION public.preencher_pedido_pelo_kit(p_contrato uuid, p_competencia date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_comp date := date_trunc('month', p_competencia)::date;
  v_zero constant uuid := '00000000-0000-0000-0000-000000000000';
  v_ped uuid; v_env uuid; v_seq smallint; k record; v_existente public.mat_pedidos%ROWTYPE;
  v_nome text := (SELECT nome FROM public.perfis WHERE id = auth.uid());
BEGIN
  IF NOT public.pode_validar_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para preencher pedidos pelo kit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mat_contratos WHERE id = p_contrato AND ativo) THEN
    RAISE EXCEPTION 'Contrato inexistente ou inativo';
  END IF;
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
       SET preenchido_pelo_escritorio = true, status_produtos = 'validado'
     WHERE id = v_ped;
  ELSE
    INSERT INTO public.mat_pedidos (contrato_id, competencia, tipo, origem, preenchido_pelo_escritorio,
      responsavel_nome, status_produtos, status_ceu, enviado_em, criado_por)
    VALUES (p_contrato, v_comp, 'mensal', 'escritorio', true, v_nome,
      'validado', 'nao_se_aplica', now(), auth.uid())
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
      qtd_validada, preco_unitario)
    VALUES (v_ped, v_env, k.item_id, k.variacao_id, k.quantidade, k.quantidade, k.quantidade,
      public.mat_preco_vigente(k.item_id, k.variacao_id, v_comp));
  END LOOP;
  RETURN v_ped;
END $$;

-- ============================================================
-- D) "Contratos que ainda não pediram" — inclui quem só pediu uniforme/EPI
-- (tipo de retorno muda: DROP antes do CREATE)
-- ============================================================
DROP FUNCTION IF EXISTS public.mat_contratos_sem_pedido(date);
CREATE FUNCTION public.mat_contratos_sem_pedido(p_competencia date)
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
               AND p.status_produtos = 'nao_se_aplica' LIMIT 1)
      FROM public.mat_contratos c
     WHERE c.ativo
       AND (c.recebe_limpeza OR EXISTS (SELECT 1 FROM public.mat_kit_itens k WHERE k.contrato_id = c.id))
       AND NOT EXISTS (SELECT 1 FROM public.mat_pedidos p
                        WHERE p.contrato_id = c.id AND p.competencia = v_comp AND p.tipo = 'mensal'
                          AND p.status_produtos NOT IN ('rascunho', 'cancelado')
                          -- só uniforme/EPI/crachá: ainda falta o pedido de produtos
                          AND NOT (p.status_produtos = 'nao_se_aplica' AND c.recebe_limpeza))
     ORDER BY c.nome;
END $$;

REVOKE ALL ON FUNCTION public.mat_contratos_sem_pedido(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mat_contratos_sem_pedido(date) TO authenticated;
