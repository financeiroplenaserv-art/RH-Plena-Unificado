-- ============================================================
-- 145 — Materiais: rota de entrega passa a aceitar 1 a 4
-- ============================================================
-- Etapa 0 da Fase 2 (decisão da gestora em 17/10/2026): as entregas são feitas em
-- 4 rotas — a rota 4 é só CBO MACAÉ. Até aqui mat_contratos.rota e
-- mat_pedidos.rota_override aceitavam só 1, 2 e 3 (CHECK da 121/122) e as RPCs
-- definir_rota_contrato / definir_rota_pedido recusavam outro valor.
--
-- Aqui: recria os dois CHECKs com (1, 2, 3, 4) e recria as duas RPCs idênticas ao
-- pg_get_functiondef de produção (backup em
-- dados-locais/fase2_etapa0/backup_2026-10-17/funcoes_rota_antes.json), mudando só a
-- lista de rotas válidas. Nenhum dado muda (as 64 rotas estão vazias na data).
-- Sem tabela nova — sem GRANT de tabela. Os GRANT EXECUTE existentes são mantidos
-- pelo CREATE OR REPLACE (mesma assinatura).
--
-- ATENÇÃO — frontend: a tela Materiais → Contratos só conhece 1–3 (RotaMaterial em
-- src/types/materiais.ts, lerRota e os três <select> em MateriaisContratosPage.tsx).
-- Salvar o formulário de um contrato com rota 4 numa versão antiga da tela grava
-- rota NULL. Publicar a tela com a rota 4 junto com esta migration.
--
-- Aplicar SÓ por arquivo UTF-8 (scripts/lib/executar-arquivo-sql-management-api.ps1).
-- ============================================================

ALTER TABLE public.mat_contratos DROP CONSTRAINT IF EXISTS mat_contratos_rota_check;
ALTER TABLE public.mat_contratos
  ADD CONSTRAINT mat_contratos_rota_check CHECK (rota IN (1, 2, 3, 4));

ALTER TABLE public.mat_pedidos DROP CONSTRAINT IF EXISTS mat_pedidos_rota_override_check;
ALTER TABLE public.mat_pedidos
  ADD CONSTRAINT mat_pedidos_rota_override_check CHECK (rota_override IN (1, 2, 3, 4));

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
  IF p_rota IS NOT NULL AND p_rota NOT IN (1, 2, 3, 4) THEN
    RAISE EXCEPTION 'Rota inválida: %', p_rota;
  END IF;
  UPDATE public.mat_contratos SET rota = p_rota WHERE id = p_contrato;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;
END $function$;

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
  IF p_rota IS NOT NULL AND p_rota NOT IN (1, 2, 3, 4) THEN RAISE EXCEPTION 'Rota inválida: %', p_rota; END IF;
  IF p_rota IS NOT NULL AND btrim(coalesce(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da troca de rota';
  END IF;
  UPDATE public.mat_pedidos
     SET rota_override = p_rota,
         rota_override_motivo = CASE WHEN p_rota IS NULL THEN NULL ELSE p_motivo END,
         rota_override_por = CASE WHEN p_rota IS NULL THEN NULL ELSE auth.uid() END
   WHERE id = p_pedido;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
END $function$;

-- Conferência: os dois CHECKs aceitam 4 e nenhuma função ficou com caractere corrompido.
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_constraint
       WHERE conname IN ('mat_contratos_rota_check', 'mat_pedidos_rota_override_check')
         AND pg_get_constraintdef(oid) LIKE '%4%') <> 2 THEN
    RAISE EXCEPTION 'CHECK de rota não foi recriado com a rota 4';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname IN ('definir_rota_contrato', 'definir_rota_pedido')
                AND pg_get_functiondef(p.oid) LIKE '%' || chr(65533) || '%') THEN
    RAISE EXCEPTION 'Função de rota com caractere corrompido (U+FFFD)';
  END IF;
END $$;
