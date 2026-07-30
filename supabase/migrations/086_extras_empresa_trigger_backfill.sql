-- ============================================================================
-- Migration 086: Preencher extras.empresa_id automaticamente (trigger) e
-- corrigir os lançamentos históricos (backfill).
--
-- Contexto: TODOS os 67 lançamentos de extras estavam com empresa_id NULL —
-- os três caminhos de lançamento (formulário web, plantão web e RPC mobile
-- registrar_extra_plantao) gravavam NULL. Resultado: o filtro "Empresa" da
-- tela Recibos só retornava linhas em "Todas as empresas"; ao escolher uma
-- empresa específica, nada aparecia.
--
-- Regra: a empresa do extra é a empresa do colaborador substituto (é ele quem
-- recebe — mesma regra do recibo, corrigida em 30/07/2026); sem substituto
-- vinculado, usa a empresa do ausente; sem nenhum dos dois, mantém o valor
-- informado (ou NULL).
--
-- A correção é feita no banco (trigger BEFORE INSERT OR UPDATE) para cobrir
-- todos os caminhos de escrita, inclusive os que vêm da RPC do mobile.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preencher_empresa_extra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.substituto_id IS NOT NULL THEN
    SELECT c.empresa_id INTO NEW.empresa_id
    FROM public.colaboradores c
    WHERE c.id = NEW.substituto_id;
  ELSIF NEW.colaborador_ausente_id IS NOT NULL THEN
    SELECT c.empresa_id INTO NEW.empresa_id
    FROM public.colaboradores c
    WHERE c.id = NEW.colaborador_ausente_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extras_preencher_empresa ON public.extras;
CREATE TRIGGER trg_extras_preencher_empresa
  BEFORE INSERT OR UPDATE ON public.extras
  FOR EACH ROW
  EXECUTE FUNCTION public.preencher_empresa_extra();

-- Backfill dos lançamentos existentes: empresa do substituto...
UPDATE public.extras e
SET empresa_id = c.empresa_id
FROM public.colaboradores c
WHERE e.substituto_id = c.id
  AND e.empresa_id IS NULL;

-- ...e, sem substituto vinculado, empresa do ausente.
UPDATE public.extras e
SET empresa_id = c.empresa_id
FROM public.colaboradores c
WHERE e.substituto_id IS NULL
  AND e.colaborador_ausente_id = c.id
  AND e.empresa_id IS NULL;
