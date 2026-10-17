-- ============================================================
-- 146 — Materiais, Fase 2: estoque central (movimentos, saldo, contagem)
-- ============================================================
-- Plano aprovado: docs/PLANO_MATERIAIS_FASE2.md §3.1 e §3.2 (decisões da gestora
-- de 17/10/2026: um estoque central só; baixa na separação; contagem mensal pela
-- mesa entre os dias 16 e 19; sobra e devolução entram com motivo).
--
-- A) Funções de permissão da Fase 2 (listas fixas — espelho do PERMISSOES_PADRAO):
--    pode_comprar_materiais()            admin, adm, gestor, mesa
--    pode_movimentar_estoque_materiais() admin, adm, gestor, mesa, inspetoria
--    pode_contar_estoque_materiais()     admin, adm, gestor, mesa
--    pode_registrar_chegada_materiais()  admin, adm, gestor, mesa
--    pode_ver_compras_materiais()        pode_ver_materiais() + financeiro
-- B) mat_itens.preparo_escritorio — os 4 itens de portaria comprados e encapados
--    no escritório (decisão 1): nunca vão ao fornecedor e não têm saldo. Marcados
--    por id com conferência de contagem = 4. (O plano punha a coluna na 147; ela
--    veio para cá porque a contagem desta migration já precisa dela.)
-- C) mat_estoque_contagens / mat_estoque_contagem_itens / mat_estoque_movimentos
--    (diário imutável, quantidade COM SINAL) + view mat_estoque_saldos.
--    Sem policy de escrita para authenticated e sem GRANT de escrita: tudo por RPC.
-- D) RPCs: mat_registrar_movimento_estoque, mat_estornar_movimento,
--    mat_abrir_contagem, mat_incluir_item_contagem, mat_salvar_contagem,
--    mat_fechar_contagem, mat_cancelar_contagem.
--
-- Saldo inicial: ZERO. A 1ª contagem real (16 a 19/11/2026) vira o saldo inicial;
-- em outubro tudo sai "do fornecedor". Nada é gerado automaticamente (sem pg_cron).
-- Idempotente. GRANT explícito nas tabelas novas (regra do Supabase de 30/10/2026).
-- Backup prévio: dados-locais/backup_materiais_146_147_2026-10-17/.
-- ============================================================

-- ============================================================
-- A) Funções de permissão
-- ============================================================
CREATE OR REPLACE FUNCTION public.pode_comprar_materiais()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid()
                  AND nivel_acesso IN ('admin', 'adm', 'gestor', 'mesa'));
$$;

CREATE OR REPLACE FUNCTION public.pode_movimentar_estoque_materiais()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid()
                  AND nivel_acesso IN ('admin', 'adm', 'gestor', 'mesa', 'inspetoria'));
$$;

CREATE OR REPLACE FUNCTION public.pode_contar_estoque_materiais()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid()
                  AND nivel_acesso IN ('admin', 'adm', 'gestor', 'mesa'));
$$;

CREATE OR REPLACE FUNCTION public.pode_registrar_chegada_materiais()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid()
                  AND nivel_acesso IN ('admin', 'adm', 'gestor', 'mesa'));
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_compras_materiais()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.pode_ver_materiais() OR EXISTS (
    SELECT 1 FROM public.perfis WHERE id = auth.uid() AND nivel_acesso = 'financeiro');
$$;

-- "Hoje" em Brasília (AGENTS.md §11 — nunca o dia UTC do servidor).
CREATE OR REPLACE FUNCTION public.mat_hoje()
RETURNS date LANGUAGE sql STABLE
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

-- ============================================================
-- B) Itens preparados no escritório
-- ============================================================
ALTER TABLE public.mat_itens
  ADD COLUMN IF NOT EXISTS preparo_escritorio boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.mat_itens.preparo_escritorio IS
  'Item comprado e preparado (encapado) no escritório: nunca vai ao pedido do fornecedor e não tem saldo de estoque; sai na lista do escritório/separação (decisão 1 da Fase 2, migration 146).';

DO $$
DECLARE
  v_ids uuid[] := ARRAY[
    'fa8c923a-99bc-4dc4-a52d-23770f0a0ad8',  -- Livro de Ocorrências
    '4b46c9e9-f330-4b45-bdc3-d73d8e01d069',  -- Protocolo de Correspondências
    'f72f9ea9-0443-4c1d-96a5-edbb4a3eab67',  -- Planilha de Controle de Acessos
    '0e8bb08e-62c2-46b0-a66b-76f0aea2665b'   -- Planilha de Controle de Veículos
  ]::uuid[];
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.mat_itens WHERE id = ANY (v_ids) AND categoria = 'portaria';
  IF n <> 4 THEN
    RAISE EXCEPTION 'Conferência: esperava 4 itens de portaria do escritório, achei %', n;
  END IF;
  UPDATE public.mat_itens SET preparo_escritorio = true
   WHERE id = ANY (v_ids) AND NOT preparo_escritorio;
  SELECT count(*) INTO n FROM public.mat_itens WHERE preparo_escritorio;
  IF n <> 4 THEN
    RAISE EXCEPTION 'Conferência: esperava 4 itens com preparo_escritorio, achei %', n;
  END IF;
END $$;

-- ============================================================
-- C) Tabelas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mat_estoque_contagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NOT NULL CHECK (competencia = date_trunc('month', competencia)::date),
  data date NOT NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'cancelada')),
  aberta_por uuid DEFAULT auth.uid(),
  aberta_em timestamptz NOT NULL DEFAULT now(),
  fechada_por uuid,
  fechada_em timestamptz,
  cancelada_por uuid,
  cancelada_em timestamptz,
  cancelada_motivo text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Uma contagem aberta por vez; uma fechada por competência.
CREATE UNIQUE INDEX IF NOT EXISTS mat_estoque_contagens_aberta_uq
  ON public.mat_estoque_contagens (status) WHERE status = 'aberta';
CREATE UNIQUE INDEX IF NOT EXISTS mat_estoque_contagens_fechada_uq
  ON public.mat_estoque_contagens (competencia) WHERE status = 'fechada';

CREATE TABLE IF NOT EXISTS public.mat_estoque_contagem_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contagem_id uuid NOT NULL REFERENCES public.mat_estoque_contagens(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.mat_itens(id),
  variacao_id uuid REFERENCES public.mat_item_variacoes(id),
  -- Foto do saldo ao abrir (referência para a folha).
  saldo_sistema numeric(12,2) NOT NULL DEFAULT 0,
  quantidade_contada numeric(12,2) CHECK (quantidade_contada >= 0),
  diferenca numeric(12,2) GENERATED ALWAYS AS (quantidade_contada - saldo_sistema) STORED,
  motivo text,
  -- Gravados no fechamento: o ajuste vale contra o saldo NAQUELE instante
  -- (pode ter havido separação entre abrir e fechar — risco 8.8 do plano).
  saldo_fechamento numeric(12,2),
  ajuste numeric(12,2),
  incluido_depois boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mat_estoque_contagem_itens_uq
  ON public.mat_estoque_contagem_itens (contagem_id, item_id,
     coalesce(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS public.mat_estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.mat_itens(id),
  variacao_id uuid REFERENCES public.mat_item_variacoes(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada_compra', 'entrada_sobra', 'entrada_devolucao',
                                     'saida_pedido', 'saida_avulsa', 'ajuste_contagem', 'estorno')),
  -- Com sinal: entrada > 0, saída < 0; ajuste/estorno com o sinal da diferença.
  quantidade numeric(12,2) NOT NULL CHECK (quantidade <> 0),
  data date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  motivo text,
  contrato_id uuid REFERENCES public.mat_contratos(id),
  pedido_item_id uuid REFERENCES public.mat_pedido_itens(id),
  -- FK para mat_compra_itens criada na migration 147.
  compra_item_id uuid,
  contagem_id uuid REFERENCES public.mat_estoque_contagens(id),
  estorna_id uuid REFERENCES public.mat_estoque_movimentos(id),
  criado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mat_estoque_mov_sinal_ck CHECK (
    (tipo LIKE 'entrada\_%' AND quantidade > 0)
    OR (tipo LIKE 'saida\_%' AND quantidade < 0)
    OR tipo IN ('ajuste_contagem', 'estorno')),
  CONSTRAINT mat_estoque_mov_motivo_ck CHECK (
    tipo IN ('entrada_compra', 'saida_pedido') OR btrim(coalesce(motivo, '')) <> ''),
  CONSTRAINT mat_estoque_mov_estorno_ck CHECK ((tipo = 'estorno') = (estorna_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS mat_estoque_mov_item_idx ON public.mat_estoque_movimentos (item_id, variacao_id, data);
CREATE INDEX IF NOT EXISTS mat_estoque_mov_pedido_item_idx ON public.mat_estoque_movimentos (pedido_item_id);
CREATE INDEX IF NOT EXISTS mat_estoque_mov_compra_item_idx ON public.mat_estoque_movimentos (compra_item_id);
-- Um estorno por movimento.
CREATE UNIQUE INDEX IF NOT EXISTS mat_estoque_mov_estorno_uq
  ON public.mat_estoque_movimentos (estorna_id) WHERE estorna_id IS NOT NULL;

-- Diário imutável: nem o service_role altera/apaga (erro se corrige com estorno).
CREATE OR REPLACE FUNCTION public.mat_estoque_mov_imutavel()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Movimento de estoque é imutável: registre um estorno';
END $$;
DROP TRIGGER IF EXISTS trg_mat_estoque_mov_imutavel ON public.mat_estoque_movimentos;
CREATE TRIGGER trg_mat_estoque_mov_imutavel
  BEFORE UPDATE OR DELETE ON public.mat_estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.mat_estoque_mov_imutavel();

-- Saldo = soma dos movimentos (ninguém digita saldo).
CREATE OR REPLACE VIEW public.mat_estoque_saldos WITH (security_invoker = true) AS
  SELECT item_id, variacao_id, sum(quantidade) AS saldo, max(data) AS ultimo_movimento,
         count(*) AS movimentos
    FROM public.mat_estoque_movimentos
   GROUP BY item_id, variacao_id;

CREATE OR REPLACE FUNCTION public.mat_saldo_estoque(p_item uuid, p_variacao uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(sum(quantidade), 0) FROM public.mat_estoque_movimentos
   WHERE item_id = p_item
     AND coalesce(variacao_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(p_variacao, '00000000-0000-0000-0000-000000000000'::uuid);
$$;

-- RLS + GRANTs: leitura para quem vê o módulo; escrita só por RPC.
ALTER TABLE public.mat_estoque_contagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_estoque_contagem_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mat_estoque_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mat_estoque_contagens_select ON public.mat_estoque_contagens;
CREATE POLICY mat_estoque_contagens_select ON public.mat_estoque_contagens
  FOR SELECT TO authenticated USING (public.pode_ver_materiais());
DROP POLICY IF EXISTS mat_estoque_contagem_itens_select ON public.mat_estoque_contagem_itens;
CREATE POLICY mat_estoque_contagem_itens_select ON public.mat_estoque_contagem_itens
  FOR SELECT TO authenticated USING (public.pode_ver_materiais());
DROP POLICY IF EXISTS mat_estoque_movimentos_select ON public.mat_estoque_movimentos;
CREATE POLICY mat_estoque_movimentos_select ON public.mat_estoque_movimentos
  FOR SELECT TO authenticated USING (public.pode_ver_materiais());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_estoque_contagens TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_estoque_contagem_itens TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mat_estoque_movimentos TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.mat_estoque_contagens FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mat_estoque_contagem_itens FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mat_estoque_movimentos FROM authenticated;
REVOKE ALL ON public.mat_estoque_contagens FROM anon;
REVOKE ALL ON public.mat_estoque_contagem_itens FROM anon;
REVOKE ALL ON public.mat_estoque_movimentos FROM anon;
GRANT SELECT ON public.mat_estoque_saldos TO authenticated, service_role;
REVOKE ALL ON public.mat_estoque_saldos FROM anon;

-- ============================================================
-- D) RPCs de movimento
-- ============================================================
-- Valida item/variação de estoque (ativo, não preparado no escritório, variação coerente).
CREATE OR REPLACE FUNCTION public.mat_validar_item_estoque(p_item uuid, p_variacao uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE it public.mat_itens%ROWTYPE;
BEGIN
  SELECT * INTO it FROM public.mat_itens WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF it.preparo_escritorio THEN
    RAISE EXCEPTION 'O item "%" é preparado no escritório e não tem controle de estoque', it.nome;
  END IF;
  IF p_variacao IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.mat_item_variacoes WHERE id = p_variacao AND item_id = p_item) THEN
    RAISE EXCEPTION 'Opção (variação) inválida para o item';
  END IF;
  IF p_variacao IS NULL AND EXISTS (SELECT 1 FROM public.mat_item_variacoes WHERE item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Escolha a opção (variação) do item "%"', it.nome;
  END IF;
END $$;

-- Sobra, devolução e saída avulsa (sempre com motivo). p_quantidade vem POSITIVA;
-- o sinal sai do tipo. Saída maior que o saldo NÃO é recusada (o físico manda;
-- a contagem acerta) — o retorno avisa o saldo negativo.
CREATE OR REPLACE FUNCTION public.mat_registrar_movimento_estoque(
  p_tipo text, p_item uuid, p_variacao uuid, p_quantidade numeric,
  p_data date DEFAULT NULL, p_motivo text DEFAULT NULL, p_contrato uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_saldo numeric; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF NOT public.pode_movimentar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para movimentar o estoque de materiais';
  END IF;
  IF p_tipo NOT IN ('entrada_sobra', 'entrada_devolucao', 'saida_avulsa') THEN
    RAISE EXCEPTION 'Tipo de movimento inválido aqui: %', p_tipo;
  END IF;
  -- A inspetoria só registra a devolução que ela mesma trouxe (decisão 6).
  IF p_tipo <> 'entrada_devolucao' AND NOT public.pode_contar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para este movimento (só gestor/mesa)';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo do movimento'; END IF;
  PERFORM public.mat_validar_item_estoque(p_item, p_variacao);
  IF p_contrato IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.mat_contratos WHERE id = p_contrato) THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  INSERT INTO public.mat_estoque_movimentos (item_id, variacao_id, tipo, quantidade, data, motivo, contrato_id)
  VALUES (p_item, p_variacao, p_tipo,
          CASE WHEN p_tipo LIKE 'saida%' THEN -p_quantidade ELSE p_quantidade END,
          coalesce(p_data, public.mat_hoje()), v_motivo, p_contrato)
  RETURNING id INTO v_id;
  v_saldo := public.mat_saldo_estoque(p_item, p_variacao);
  RETURN jsonb_build_object('id', v_id, 'saldo', v_saldo, 'saldo_negativo', v_saldo < 0);
END $$;

-- Estorno (movimento inverso). Só de sobra/devolução/saída avulsa: entrada de
-- compra, saída de pedido e ajuste de contagem fechada se corrigem pelos
-- próprios fluxos. Estorno de estorno é recusado.
CREATE OR REPLACE FUNCTION public.mat_estornar_movimento(p_movimento uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE m public.mat_estoque_movimentos%ROWTYPE; v_id uuid; v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF NOT public.pode_contar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para estornar movimentos de estoque';
  END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo do estorno'; END IF;
  SELECT * INTO m FROM public.mat_estoque_movimentos WHERE id = p_movimento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimento não encontrado'; END IF;
  IF m.tipo = 'estorno' THEN RAISE EXCEPTION 'Não se estorna um estorno'; END IF;
  IF m.tipo NOT IN ('entrada_sobra', 'entrada_devolucao', 'saida_avulsa') THEN
    RAISE EXCEPTION 'Movimento do tipo % não é estornado aqui (corrija pelo fluxo de origem)', m.tipo;
  END IF;
  IF EXISTS (SELECT 1 FROM public.mat_estoque_movimentos WHERE estorna_id = m.id) THEN
    RAISE EXCEPTION 'Este movimento já foi estornado';
  END IF;
  INSERT INTO public.mat_estoque_movimentos (item_id, variacao_id, tipo, quantidade, data, motivo, contrato_id, estorna_id)
  VALUES (m.item_id, m.variacao_id, 'estorno', -m.quantidade, public.mat_hoje(), v_motivo, m.contrato_id, m.id)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'saldo', public.mat_saldo_estoque(m.item_id, m.variacao_id));
END $$;

-- ============================================================
-- D) RPCs da contagem mensal
-- ============================================================
-- Abre a contagem com TODOS os itens ativos de estoque (uma linha por variação
-- ativa) + qualquer item/variação com saldo ≠ 0. Desvio consciente do plano
-- (§3.2 falava só em "saldo ≠ 0 ou movimento em 6 meses"): na 1ª contagem o
-- saldo é zero em tudo e a folha sairia vazia.
CREATE OR REPLACE FUNCTION public.mat_abrir_contagem(p_competencia date, p_data date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_comp date := date_trunc('month', coalesce(p_competencia, public.mat_hoje()))::date; v_id uuid; n integer;
BEGIN
  IF NOT public.pode_contar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para abrir a contagem do estoque';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mat_estoque_contagens WHERE status = 'aberta') THEN
    RAISE EXCEPTION 'Já existe uma contagem aberta: feche ou cancele antes de abrir outra';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mat_estoque_contagens WHERE status = 'fechada' AND competencia = v_comp) THEN
    RAISE EXCEPTION 'A contagem desta competência já foi fechada';
  END IF;
  INSERT INTO public.mat_estoque_contagens (competencia, data)
  VALUES (v_comp, coalesce(p_data, public.mat_hoje()))
  RETURNING id INTO v_id;

  INSERT INTO public.mat_estoque_contagem_itens (contagem_id, item_id, variacao_id, saldo_sistema)
  SELECT v_id, x.item_id, x.variacao_id, public.mat_saldo_estoque(x.item_id, x.variacao_id)
    FROM (
      SELECT it.id AS item_id, v.id AS variacao_id
        FROM public.mat_itens it
        JOIN public.mat_item_variacoes v ON v.item_id = it.id AND v.ativo
       WHERE it.ativo AND NOT it.preparo_escritorio
      UNION
      SELECT it.id, NULL::uuid
        FROM public.mat_itens it
       WHERE it.ativo AND NOT it.preparo_escritorio
         AND NOT EXISTS (SELECT 1 FROM public.mat_item_variacoes v WHERE v.item_id = it.id AND v.ativo)
      UNION
      SELECT s.item_id, s.variacao_id FROM public.mat_estoque_saldos s
        JOIN public.mat_itens it ON it.id = s.item_id AND NOT it.preparo_escritorio
       WHERE s.saldo <> 0
    ) x;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('id', v_id, 'itens', n);
END $$;

CREATE OR REPLACE FUNCTION public.mat_incluir_item_contagem(p_contagem uuid, p_item uuid, p_variacao uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.mat_estoque_contagens%ROWTYPE; v_id uuid;
BEGIN
  IF NOT public.pode_contar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para alterar a contagem';
  END IF;
  SELECT * INTO c FROM public.mat_estoque_contagens WHERE id = p_contagem FOR UPDATE;
  IF NOT FOUND OR c.status <> 'aberta' THEN RAISE EXCEPTION 'Contagem não está aberta'; END IF;
  PERFORM public.mat_validar_item_estoque(p_item, p_variacao);
  IF EXISTS (SELECT 1 FROM public.mat_estoque_contagem_itens WHERE contagem_id = p_contagem AND item_id = p_item
              AND variacao_id IS NOT DISTINCT FROM p_variacao) THEN
    RAISE EXCEPTION 'O item já está na contagem';
  END IF;
  INSERT INTO public.mat_estoque_contagem_itens (contagem_id, item_id, variacao_id, saldo_sistema, incluido_depois)
  VALUES (p_contagem, p_item, p_variacao, public.mat_saldo_estoque(p_item, p_variacao), true)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- p_itens: [{id, quantidade_contada (número ou null), motivo}] — pode salvar várias vezes.
CREATE OR REPLACE FUNCTION public.mat_salvar_contagem(p_contagem uuid, p_itens jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.mat_estoque_contagens%ROWTYPE; e jsonb; v_qtd numeric; n integer := 0;
BEGIN
  IF NOT public.pode_contar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para preencher a contagem';
  END IF;
  SELECT * INTO c FROM public.mat_estoque_contagens WHERE id = p_contagem FOR UPDATE;
  IF NOT FOUND OR c.status <> 'aberta' THEN RAISE EXCEPTION 'Contagem não está aberta'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) LOOP
    v_qtd := nullif(e->>'quantidade_contada', '')::numeric;
    IF v_qtd IS NOT NULL AND v_qtd < 0 THEN RAISE EXCEPTION 'Quantidade contada não pode ser negativa'; END IF;
    UPDATE public.mat_estoque_contagem_itens
       SET quantidade_contada = v_qtd,
           motivo = nullif(btrim(coalesce(e->>'motivo', '')), '')
     WHERE id = (e->>'id')::uuid AND contagem_id = p_contagem;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linha % não pertence à contagem', e->>'id'; END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Fecha: exige tudo contado; recalcula o saldo NO FECHAMENTO e grava um
-- ajuste_contagem por diferença (motivo obrigatório onde houver diferença).
CREATE OR REPLACE FUNCTION public.mat_fechar_contagem(p_contagem uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.mat_estoque_contagens%ROWTYPE; r record; v_saldo numeric; v_aj numeric;
        n_aj integer := 0; n_sem integer; n_mot integer := 0;
BEGIN
  IF NOT public.pode_contar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para fechar a contagem';
  END IF;
  SELECT * INTO c FROM public.mat_estoque_contagens WHERE id = p_contagem FOR UPDATE;
  IF NOT FOUND OR c.status <> 'aberta' THEN RAISE EXCEPTION 'Contagem não está aberta'; END IF;
  SELECT count(*) INTO n_sem FROM public.mat_estoque_contagem_itens
   WHERE contagem_id = p_contagem AND quantidade_contada IS NULL;
  IF n_sem > 0 THEN RAISE EXCEPTION 'Faltam % linha(s) sem quantidade contada', n_sem; END IF;
  -- Trava os itens contados contra movimentos concorrentes.
  PERFORM pg_advisory_xact_lock(hashtextextended('mat_estoque_contagem', 0));

  FOR r IN SELECT * FROM public.mat_estoque_contagem_itens WHERE contagem_id = p_contagem FOR UPDATE LOOP
    v_saldo := public.mat_saldo_estoque(r.item_id, r.variacao_id);
    v_aj := r.quantidade_contada - v_saldo;
    IF v_aj <> 0 AND btrim(coalesce(r.motivo, '')) = '' THEN n_mot := n_mot + 1; END IF;
  END LOOP;
  IF n_mot > 0 THEN RAISE EXCEPTION 'Informe o motivo de % diferença(s) antes de fechar', n_mot; END IF;

  FOR r IN SELECT * FROM public.mat_estoque_contagem_itens WHERE contagem_id = p_contagem LOOP
    v_saldo := public.mat_saldo_estoque(r.item_id, r.variacao_id);
    v_aj := r.quantidade_contada - v_saldo;
    IF v_aj <> 0 THEN
      INSERT INTO public.mat_estoque_movimentos (item_id, variacao_id, tipo, quantidade, data, motivo, contagem_id)
      VALUES (r.item_id, r.variacao_id, 'ajuste_contagem', v_aj, c.data, r.motivo, p_contagem);
      n_aj := n_aj + 1;
    END IF;
    UPDATE public.mat_estoque_contagem_itens SET saldo_fechamento = v_saldo, ajuste = v_aj WHERE id = r.id;
  END LOOP;
  UPDATE public.mat_estoque_contagens
     SET status = 'fechada', fechada_por = auth.uid(), fechada_em = now()
   WHERE id = p_contagem;
  RETURN jsonb_build_object('ajustes', n_aj,
    'itens', (SELECT count(*) FROM public.mat_estoque_contagem_itens WHERE contagem_id = p_contagem));
END $$;

CREATE OR REPLACE FUNCTION public.mat_cancelar_contagem(p_contagem uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_contar_estoque_materiais() THEN
    RAISE EXCEPTION 'Sem permissão para cancelar a contagem';
  END IF;
  IF btrim(coalesce(p_motivo, '')) = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento'; END IF;
  UPDATE public.mat_estoque_contagens
     SET status = 'cancelada', cancelada_por = auth.uid(), cancelada_em = now(), cancelada_motivo = p_motivo
   WHERE id = p_contagem AND status = 'aberta';
  IF NOT FOUND THEN RAISE EXCEPTION 'Contagem não está aberta'; END IF;
END $$;

-- Execução: só autenticado (as funções reconferem o perfil).
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mat_registrar_movimento_estoque(text, uuid, uuid, numeric, date, text, uuid)',
    'public.mat_estornar_movimento(uuid, text)',
    'public.mat_abrir_contagem(date, date)',
    'public.mat_incluir_item_contagem(uuid, uuid, uuid)',
    'public.mat_salvar_contagem(uuid, jsonb)',
    'public.mat_fechar_contagem(uuid)',
    'public.mat_cancelar_contagem(uuid, text)',
    'public.mat_saldo_estoque(uuid, uuid)',
    'public.mat_validar_item_estoque(uuid, uuid)',
    'public.pode_comprar_materiais()',
    'public.pode_movimentar_estoque_materiais()',
    'public.pode_contar_estoque_materiais()',
    'public.pode_registrar_chegada_materiais()',
    'public.pode_ver_compras_materiais()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ============================================================
-- Conferência
-- ============================================================
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
   WHERE s.nspname = 'public' AND p.proname LIKE 'mat\_%' AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%';
  IF n > 0 THEN RAISE EXCEPTION 'Conferência: % função(ões) mat_* com caractere corrompido', n; END IF;
  SELECT count(*) INTO n FROM public.mat_itens WHERE preparo_escritorio;
  IF n <> 4 THEN RAISE EXCEPTION 'Conferência: preparo_escritorio = %', n; END IF;
END $$;
