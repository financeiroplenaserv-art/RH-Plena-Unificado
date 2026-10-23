-- 161_vt_fechamentos.sql
-- Módulo VT (Vale-Transporte) — Fase 2b, fechamento/reconciliação (decisão da
-- gestora, 23/10/2026): "VR olha para trás, VT olha para a frente. O único
-- olhar para trás do VT é o fechamento: faltou, desconta no mês seguinte."
-- Depois do ponto fechado, cada dia PLANEJADO da carga (vt_cargas.detalhe
-- ganhou as datas por posto na Fase 2b — jsonb, sem migration) é conferido no
-- espelho de ponto real (bucket ponto-espelhos): faltou (qualquer motivo) →
-- o dia é descontado na carga do mês seguinte. O fechamento do mês CIVIL usa
-- os DOIS espelhos que o cobrem (ponto fecha 20→19): dias 1–19 de um e 20–fim
-- do outro. Dia sem linha no espelho = "não conferido" (nunca desconta sem
-- evidência).
--
--  A) vt_fechamentos: um fechamento por colaborador × competência (o resultado
--     da conferência; desconto_centavos alimenta ajuste_centavos da carga
--     seguinte). UNIQUE (colaborador_id, competencia) — regravar o fechamento
--     refaz o cálculo, não duplica.
--  B) RLS padrão do projeto + GRANT explícito (mudança do Supabase, 30/10/2026
--     — tabela nova sem GRANT fica inalcançável pela Data API).
-- Aplicada via Management API em 23/10/2026.

begin;

CREATE TABLE IF NOT EXISTS public.vt_fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id),
  competencia text NOT NULL, -- 'AAAA-MM', mês civil fechado
  /**
   * Foto da conferência por posto:
   * [{ departamento_id, posto, custo_dia_centavos,
   *    planejados: ['AAAA-MM-DD'...], trabalhados: [...], descontados: [...] }]
   */
  detalhe jsonb NOT NULL DEFAULT '[]'::jsonb,
  dias_planejados integer NOT NULL DEFAULT 0,
  dias_trabalhados integer NOT NULL DEFAULT 0,
  dias_descontados integer NOT NULL DEFAULT 0,
  /** Dias planejados sem linha no espelho (ponto incompleto) — nunca descontados. */
  dias_nao_conferidos integer NOT NULL DEFAULT 0,
  /** Soma do custo/dia dos dias descontados (positivo; entra negativo na próxima carga). */
  desconto_centavos integer NOT NULL DEFAULT 0,
  fechado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vt_fechamentos_colab_comp_uidx
  ON public.vt_fechamentos (colaborador_id, competencia);

ALTER TABLE public.vt_fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vt_fechamentos_select ON public.vt_fechamentos;
CREATE POLICY vt_fechamentos_select ON public.vt_fechamentos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS vt_fechamentos_insert ON public.vt_fechamentos;
CREATE POLICY vt_fechamentos_insert ON public.vt_fechamentos
  FOR INSERT TO authenticated WITH CHECK (is_editor());

DROP POLICY IF EXISTS vt_fechamentos_update ON public.vt_fechamentos;
CREATE POLICY vt_fechamentos_update ON public.vt_fechamentos
  FOR UPDATE TO authenticated USING (is_editor()) WITH CHECK (is_editor());

DROP POLICY IF EXISTS vt_fechamentos_delete ON public.vt_fechamentos;
CREATE POLICY vt_fechamentos_delete ON public.vt_fechamentos
  FOR DELETE TO authenticated USING (is_admin());

GRANT select, insert, update, delete ON public.vt_fechamentos TO authenticated;
GRANT select, insert, update, delete ON public.vt_fechamentos TO service_role;

commit;
