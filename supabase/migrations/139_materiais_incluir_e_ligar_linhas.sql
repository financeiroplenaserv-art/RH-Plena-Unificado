-- ============================================================
-- 139 — Materiais: incluir item no pedido e ligar texto livre ao catálogo
-- ============================================================
-- Decisões da gestora (17/10/2026), telas internas do detalhe do pedido:
--
-- A) "Adicionar item": inspetor (inspetoria), gestor e admin incluem uma
--    linha do catálogo no pedido do líder. Entra como parte 'extra', marcada
--    como incluída pelo escritório (incluido_por/incluido_em), com preço
--    vigente na competência e MOTIVO OBRIGATÓRIO (gravado em `justificativa`).
--    Estados aceitos: em_validacao (a linha segue a validação normal),
--    validado (nasce já validada, o gestor aprova) e aprovado — este SÓ para
--    gestor/admin: reabre o pedido para 'validado', porque o novo extra
--    precisa da aprovação do gestor; as linhas já aprovadas (kit automático
--    incluso) mantêm qtd_aprovada, e aprovar_pedido_materiais só preenche o
--    que está NULL. O inspetor não reabre pedido aprovado.
--
-- B) "Ligar ao catálogo": linha de texto livre (item_id NULL + descricao_livre)
--    ganha item_id/variacao_id e preço vigente. O texto original NÃO é apagado
--    (descricao_livre fica, com ligado_por/ligado_em). Motivo opcional (vai
--    para um comentário). Mesma janela de status; não reabre nada.
--
-- Tudo por RPC SECURITY DEFINER que reconfere perfil e status no banco —
-- nenhuma policy nova em mat_pedido_itens. A constraint mat_pedido_itens_item_ck
-- é relaxada: item_id preenchido pode manter descricao_livre SE a linha foi
-- ligada (ligado_em NOT NULL). Sem tabela nova — sem GRANT de tabela.
-- Backup: dados-locais/backup_materiais_138_139_2026-10-17/
-- ============================================================

ALTER TABLE public.mat_pedido_itens
  ADD COLUMN IF NOT EXISTS incluido_por uuid,
  ADD COLUMN IF NOT EXISTS incluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS ligado_por uuid,
  ADD COLUMN IF NOT EXISTS ligado_em timestamptz;
COMMENT ON COLUMN public.mat_pedido_itens.incluido_por IS 'Quem do escritório incluiu a linha no pedido (incluir_linha_pedido_materiais). Migration 139.';
COMMENT ON COLUMN public.mat_pedido_itens.ligado_por IS 'Quem ligou o texto livre ao catálogo (ligar_linha_catalogo_materiais). descricao_livre guarda o texto original. Migration 139.';

ALTER TABLE public.mat_pedido_itens DROP CONSTRAINT IF EXISTS mat_pedido_itens_item_ck;
ALTER TABLE public.mat_pedido_itens ADD CONSTRAINT mat_pedido_itens_item_ck CHECK (
  (item_id IS NULL AND descricao_livre IS NOT NULL)
  OR (item_id IS NOT NULL AND (descricao_livre IS NULL OR ligado_em IS NOT NULL))
);

-- ---------- A) incluir_linha_pedido_materiais ----------
CREATE OR REPLACE FUNCTION public.incluir_linha_pedido_materiais(
  p_pedido uuid, p_item uuid, p_variacao uuid, p_qtd numeric, p_motivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.mat_pedidos%ROWTYPE; c public.mat_contratos%ROWTYPE; it public.mat_itens%ROWTYPE;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_kit numeric; v_no_kit boolean; v_id uuid; v_validada numeric;
BEGIN
  IF NOT (public.pode_validar_materiais() OR public.pode_aprovar_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para incluir item no pedido';
  END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'Qual o motivo? Informe o motivo da inclusão'; END IF;
  IF p_qtd IS NULL OR p_qtd <= 0 OR p_qtd > 999 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

  SELECT * INTO p FROM public.mat_pedidos WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_produtos NOT IN ('em_validacao', 'validado', 'aprovado') THEN
    RAISE EXCEPTION 'Não dá para incluir item neste pedido (%)', p.status_produtos;
  END IF;
  IF p.status_produtos = 'aprovado' AND NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Pedido já aprovado: só o gestor pode incluir item (o pedido volta para aprovação)';
  END IF;

  SELECT * INTO it FROM public.mat_itens WHERE id = p_item AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item inexistente ou inativo'; END IF;
  IF p_variacao IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.mat_item_variacoes WHERE id = p_variacao AND item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Opção (variação) inválida para o item';
  END IF;
  IF p_variacao IS NULL AND EXISTS (SELECT 1 FROM public.mat_item_variacoes WHERE item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Escolha a opção (variação) do item';
  END IF;

  SELECT * INTO c FROM public.mat_contratos WHERE id = p.contrato_id;
  IF FOUND AND NOT c.recebe_limpeza AND it.categoria <> 'portaria' THEN
    RAISE EXCEPTION 'Este contrato recebe apenas material de portaria';
  END IF;

  SELECT max(quantidade) INTO v_kit FROM public.mat_kit_itens
   WHERE contrato_id = p.contrato_id AND item_id = p_item
     AND (variacao_id IS NULL OR variacao_id IS NOT DISTINCT FROM p_variacao);
  v_no_kit := v_kit IS NOT NULL;
  -- Já validado pelo inspetor/gestor que incluiu: nasce validada.
  v_validada := CASE WHEN p.status_produtos IN ('validado', 'aprovado') THEN p_qtd ELSE NULL END;

  INSERT INTO public.mat_pedido_itens (
    pedido_id, item_id, variacao_id, qtd_kit, qtd_pedida, qtd_validada, preco_unitario,
    justificativa, excecao_acima_kit, excecao_fora_kit, parte, incluido_por, incluido_em)
  VALUES (
    p_pedido, p_item, p_variacao, v_kit, p_qtd, v_validada,
    public.mat_preco_vigente(p_item, p_variacao, p.competencia),
    v_motivo, v_no_kit, NOT v_no_kit, 'extra', auth.uid(), now())
  RETURNING id INTO v_id;

  IF p.status_produtos = 'aprovado' THEN
    UPDATE public.mat_pedidos SET status_produtos = 'validado' WHERE id = p_pedido;
  END IF;

  INSERT INTO public.mat_comentarios (pedido_id, linha_tabela, linha_id, autor_id, autor_nome, texto)
  VALUES (p_pedido, 'mat_pedido_itens', v_id, auth.uid(), (SELECT nome FROM public.perfis WHERE id = auth.uid()),
    'Item incluído pelo escritório: ' || it.nome || ', ' || trim_scale(p_qtd)::text || '. Motivo: ' || v_motivo
    || CASE WHEN p.status_produtos = 'aprovado' THEN ' (pedido voltou para aprovação do gestor)' ELSE '' END);
  RETURN v_id;
END $function$;

-- ---------- B) ligar_linha_catalogo_materiais ----------
CREATE OR REPLACE FUNCTION public.ligar_linha_catalogo_materiais(
  p_linha uuid, p_item uuid, p_variacao uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  l public.mat_pedido_itens%ROWTYPE; p public.mat_pedidos%ROWTYPE; it public.mat_itens%ROWTYPE;
  c public.mat_contratos%ROWTYPE;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF NOT (public.pode_validar_materiais() OR public.pode_aprovar_materiais()) THEN
    RAISE EXCEPTION 'Sem permissão para ligar a linha ao catálogo';
  END IF;
  SELECT * INTO l FROM public.mat_pedido_itens WHERE id = p_linha FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha não encontrada'; END IF;
  IF l.item_id IS NOT NULL OR l.descricao_livre IS NULL THEN
    RAISE EXCEPTION 'Só linha de texto livre (sem item do catálogo) pode ser ligada';
  END IF;
  SELECT * INTO p FROM public.mat_pedidos WHERE id = l.pedido_id FOR UPDATE;
  IF p.status_produtos NOT IN ('em_validacao', 'validado', 'aprovado') THEN
    RAISE EXCEPTION 'Não dá para ligar linhas neste pedido (%)', p.status_produtos;
  END IF;
  IF p.status_produtos = 'aprovado' AND NOT public.pode_aprovar_materiais() THEN
    RAISE EXCEPTION 'Pedido já aprovado: só o gestor pode ligar a linha ao catálogo';
  END IF;
  SELECT * INTO it FROM public.mat_itens WHERE id = p_item AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item inexistente ou inativo'; END IF;
  IF p_variacao IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.mat_item_variacoes WHERE id = p_variacao AND item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Opção (variação) inválida para o item';
  END IF;
  IF p_variacao IS NULL AND EXISTS (SELECT 1 FROM public.mat_item_variacoes WHERE item_id = p_item AND ativo) THEN
    RAISE EXCEPTION 'Escolha a opção (variação) do item';
  END IF;
  SELECT * INTO c FROM public.mat_contratos WHERE id = p.contrato_id;
  IF FOUND AND NOT c.recebe_limpeza AND it.categoria <> 'portaria' THEN
    RAISE EXCEPTION 'Este contrato recebe apenas material de portaria';
  END IF;

  UPDATE public.mat_pedido_itens
     SET item_id = p_item,
         variacao_id = p_variacao,
         preco_unitario = public.mat_preco_vigente(p_item, p_variacao, p.competencia),
         ligado_por = auth.uid(),
         ligado_em = now()
   WHERE id = l.id;

  INSERT INTO public.mat_comentarios (pedido_id, linha_tabela, linha_id, autor_id, autor_nome, texto)
  VALUES (l.pedido_id, 'mat_pedido_itens', l.id, auth.uid(), (SELECT nome FROM public.perfis WHERE id = auth.uid()),
    'Ligado ao catálogo: “' || l.descricao_livre || '” → ' || it.nome
    || CASE WHEN v_motivo IS NOT NULL THEN '. Motivo: ' || v_motivo ELSE '' END);
END $function$;

REVOKE ALL ON FUNCTION public.incluir_linha_pedido_materiais(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.incluir_linha_pedido_materiais(uuid, uuid, uuid, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.ligar_linha_catalogo_materiais(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ligar_linha_catalogo_materiais(uuid, uuid, uuid, text) TO authenticated;
