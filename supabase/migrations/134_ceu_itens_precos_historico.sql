-- Migração 134: histórico de preços de uniforme/EPI do CEU
-- Decisão da gestão (16/10/2026): o preço de `itens.valor` (centavos) passava a
-- sobrescrever o anterior em cada UPDATE. Agora toda mudança de valor grava uma
-- linha imutável em `ceu_itens_precos` (mesmo padrão de `mat_precos`, migration 121).
-- A tela CEU -> Itens segue funcionando sem mudança: o trigger em `itens` registra.
-- Para gravar com data/origem/fornecedor/observação, usar set_config local à transação:
--   corh.preco_vigente_desde (AAAA-MM-DD), corh.preco_origem, corh.preco_fornecedor_id,
--   corh.preco_observacao.
-- Idempotente.

-- 1) Tabela (histórico imutável: só SELECT e INSERT para authenticated)
CREATE TABLE IF NOT EXISTS public.ceu_itens_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  valor integer NOT NULL CHECK (valor >= 0),            -- centavos
  vigente_desde date NOT NULL,
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  origem text,                                          -- carga_inicial | tela | atualizacao_gestora ...
  observacao text,
  usuario_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ceu_itens_precos_item_vigencia_idx
  ON public.ceu_itens_precos (item_id, vigente_desde DESC);

ALTER TABLE public.ceu_itens_precos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ceu_itens_precos_select" ON public.ceu_itens_precos;
DROP POLICY IF EXISTS "ceu_itens_precos_insert" ON public.ceu_itens_precos;
CREATE POLICY "ceu_itens_precos_select" ON public.ceu_itens_precos FOR SELECT TO authenticated
  USING (public.pode_ver_ceu());
CREATE POLICY "ceu_itens_precos_insert" ON public.ceu_itens_precos FOR INSERT TO authenticated
  WITH CHECK (public.is_editor());

GRANT SELECT, INSERT ON public.ceu_itens_precos TO authenticated;
GRANT ALL ON public.ceu_itens_precos TO service_role;
-- Histórico imutável: o default antigo do Supabase concedia tudo; remove o excedente.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.ceu_itens_precos FROM authenticated, anon;

-- 2) Trigger: toda mudança de itens.valor entra no histórico
CREATE OR REPLACE FUNCTION public.ceu_registrar_preco_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_desde date;
  v_origem text;
  v_forn uuid;
  v_obs text;
BEGIN
  IF NEW.valor IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.valor IS NOT DISTINCT FROM OLD.valor THEN
    RETURN NEW;
  END IF;

  v_desde := coalesce(nullif(current_setting('corh.preco_vigente_desde', true), '')::date,
                      (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_origem := coalesce(nullif(current_setting('corh.preco_origem', true), ''), 'tela');
  v_forn := nullif(current_setting('corh.preco_fornecedor_id', true), '')::uuid;
  v_obs := nullif(current_setting('corh.preco_observacao', true), '');

  INSERT INTO public.ceu_itens_precos (item_id, valor, vigente_desde, fornecedor_id, origem, observacao)
  VALUES (NEW.id, NEW.valor, v_desde, v_forn, v_origem, v_obs);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ceu_registrar_preco_item ON public.itens;
CREATE TRIGGER trg_ceu_registrar_preco_item
  AFTER INSERT OR UPDATE OF valor ON public.itens
  FOR EACH ROW EXECUTE FUNCTION public.ceu_registrar_preco_item();

-- 3) View de preços vigentes (último por item com vigente_desde <= hoje em Brasília)
CREATE OR REPLACE VIEW public.ceu_itens_precos_vigentes
WITH (security_invoker = true) AS
SELECT DISTINCT ON (item_id)
  id, item_id, valor, vigente_desde, fornecedor_id, origem
FROM public.ceu_itens_precos
WHERE vigente_desde <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
ORDER BY item_id, vigente_desde DESC, created_at DESC;
GRANT SELECT ON public.ceu_itens_precos_vigentes TO authenticated;
GRANT SELECT ON public.ceu_itens_precos_vigentes TO service_role;

-- 4) Carga inicial (idempotente): uma linha por item com valor, se ainda não houver histórico
INSERT INTO public.ceu_itens_precos (item_id, valor, vigente_desde, origem, observacao, usuario_id)
SELECT i.id, i.valor, coalesce(i.ultima_compra, i.created_at::date), 'carga_inicial',
       'Valor existente em itens.valor na data da migration 134', NULL
FROM public.itens i
WHERE i.valor IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.ceu_itens_precos p WHERE p.item_id = i.id);
