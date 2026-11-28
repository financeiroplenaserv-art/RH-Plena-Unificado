-- 178_vt_escala_dias.sql
-- Módulo VT — escala do relatório "Gestão de escalas" do Flit guardada no banco
-- (pedido da gestora, 28/11/2026, opção "b"): ao conferir a carga, ver a ESCALA do
-- colaborador num pop-up em QUALQUER computador. Até aqui o relatório só ficava no
-- navegador de quem importou (localStorage).
--
-- Uma linha por colaborador × competência com as marcas do relatório:
--   dias = { "AAAA-MM-DD": { "marca": "T"|"F"|"FR"|"AF"|"AT"|""|<texto cru>,
--                            "local": <texto cru do Departamento do relatório>,
--                            "horario": <horários da célula [T], opcional> } }
-- marca "" = célula vazia no relatório (sem registro); data AUSENTE do mapa = fora
-- do relatório (ex.: relatório só até 15/12). Sem CPF nem nome.
--
-- Tabela SEPARADA do lote (vt_carga_lotes, migration 170) de propósito: a escala é
-- apoio de conferência e NÃO entra no snapshot nem no hash do lote (o hash é
-- calculado também no PostgreSQL pela 170).
--
-- Gravada pelo app junto com o salvamento automático do rascunho do lote (só quem
-- tem vt.gerenciar); reimportar substitui as marcas da competência.
-- PREPARADA, NÃO aplicada. Idempotente. Sem begin/commit (o teste monta a transação).
--
-- RLS: SELECT autenticado; INSERT/UPDATE/DELETE is_editor(). GRANT explícito e
-- REVOKE de anon (AGENTS.md §8). Auditoria auditar_operacao (como as outras vt_*).

CREATE TABLE IF NOT EXISTS public.vt_escala_dias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  competencia text NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  dias jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(dias) = 'object'),
  nome_arquivo text,
  importado_em timestamptz NOT NULL DEFAULT now(),
  importado_por uuid,
  CONSTRAINT vt_escala_dias_colaborador_competencia_key UNIQUE (colaborador_id, competencia)
);

COMMENT ON TABLE public.vt_escala_dias IS
  'VT: marcas do relatório Gestão de escalas (Flit) por colaborador e competência, para o pop-up de conferência da carga. Não entra no hash do lote.';

CREATE INDEX IF NOT EXISTS vt_escala_dias_competencia_idx
  ON public.vt_escala_dias (competencia);

ALTER TABLE public.vt_escala_dias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vt_escala_dias_select" ON public.vt_escala_dias;
DROP POLICY IF EXISTS "vt_escala_dias_insert" ON public.vt_escala_dias;
DROP POLICY IF EXISTS "vt_escala_dias_update" ON public.vt_escala_dias;
DROP POLICY IF EXISTS "vt_escala_dias_delete" ON public.vt_escala_dias;
CREATE POLICY "vt_escala_dias_select" ON public.vt_escala_dias FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "vt_escala_dias_insert" ON public.vt_escala_dias FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_escala_dias_update" ON public.vt_escala_dias FOR UPDATE TO authenticated
  USING ((SELECT public.is_editor())) WITH CHECK ((SELECT public.is_editor()));
CREATE POLICY "vt_escala_dias_delete" ON public.vt_escala_dias FOR DELETE TO authenticated
  USING ((SELECT public.is_editor()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_escala_dias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vt_escala_dias TO service_role;
REVOKE ALL ON public.vt_escala_dias FROM anon;
-- O default do projeto também concede TRUNCATE/REFERENCES/TRIGGER a authenticated
-- (visto na aplicação em 28/11/2026). TRUNCATE ignora o RLS: retirado.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.vt_escala_dias FROM authenticated;

DROP TRIGGER IF EXISTS trg_auditoria_vt_escala_dias ON public.vt_escala_dias;
CREATE TRIGGER trg_auditoria_vt_escala_dias
  AFTER INSERT OR UPDATE OR DELETE ON public.vt_escala_dias
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

-- Bloco final: aborta se algo chegou corrompido (acento perdido no caminho).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'vt_escala_dias'
                AND (policyname LIKE '%' || chr(65533) || '%'
                     OR coalesce(qual, '') LIKE '%' || chr(65533) || '%'
                     OR coalesce(with_check, '') LIKE '%' || chr(65533) || '%')) THEN
    RAISE EXCEPTION '178: policy de vt_escala_dias com caractere corrompido (chr 65533) — aplique pelo script de ARQUIVO UTF-8';
  END IF;
  IF coalesce(obj_description('public.vt_escala_dias'::regclass, 'pg_class'), '') LIKE '%' || chr(65533) || '%' THEN
    RAISE EXCEPTION '178: comentário de vt_escala_dias com caractere corrompido (chr 65533) — aplique pelo script de ARQUIVO UTF-8';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.vt_escala_dias'::regclass
                AND pg_get_constraintdef(oid) LIKE '%' || chr(65533) || '%') THEN
    RAISE EXCEPTION '178: constraint de vt_escala_dias com caractere corrompido (chr 65533)';
  END IF;
END $$;
