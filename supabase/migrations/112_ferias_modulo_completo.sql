-- Migração 112: Módulo Férias completo — carteira de feristas, solicitações,
-- alocações de cobertura, regras de teto e catálogo de funções
--
-- Reconstrói o módulo de férias (MVP das migrações 070/071) para a visão
-- aprovada pela gestão em 25/09/2026 (plano: RN-01 a RN-10):
--   * ferias_funcoes      — catálogo de funções operacionais com nível
--                           hierárquico (função MAIOR cobre MENOR, RN-02.3)
--                           e aliases das grafias reais de colaboradores.cargo
--   * ferias_solicitacoes — substitui ferias_periodos (backfill incluído):
--                           gozo/agendado/previsto + workflow de status
--                           (pendente → aprovada → em_andamento → concluida)
--                           + abono, 13º, parcelamento e ferista alocado
--   * ferias_feristas     — carteira de quem cobre férias (RN-02, RN-05)
--   * ferias_alocacoes    — coberturas sugeridas/confirmadas (RN-10)
--   * ferias_regras       — teto de ausência simultânea por contrato+função
--                           (RN-01); linha com departamento_id NULL = default
-- "Contrato" = departamentos. "Função" vem de colaboradores.cargo (texto
-- livre), resolvida para ferias_funcoes por aliases.
--
-- A tabela ferias_periodos NÃO é dropada aqui — fica como legada somente
-- leitura até validação em produção (drop em migração futura).
--
-- Aplicada via Management API em ___/___/2026 (CLI bloqueado por Device Guard;
-- atenção ao Get-Content -Encoding UTF8 por causa dos acentos).

-- ============================================================
-- 1. Catálogo de funções operacionais (hierarquia para cobertura)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_funcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  nivel INTEGER NOT NULL DEFAULT 1,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ferias_funcoes IS 'Catálogo de funções operacionais com nível hierárquico: função de nível MAIOR pode cobrir função de nível MENOR (RN-02.3), nunca o contrário.';
COMMENT ON COLUMN public.ferias_funcoes.aliases IS 'Grafias reais encontradas em colaboradores.cargo (texto livre e sujo) que devem resolver para esta função.';

-- Seed com os cargos reais da base (contagem de 25/09/2026). Níveis iniciais:
-- 3 = liderança (encarregado/líder) — cobre qualquer operacional
-- 2 = qualificados (zelador, monitoramento, manutenção, administrativo)
-- 1 = operacionais de base (ASG, porteiro, vigia, recepção, copeiro, jardinagem)
-- O RH ajusta níveis/aliases pela aba Férias → Feristas.
INSERT INTO public.ferias_funcoes (nome, nivel, aliases) VALUES
  ('ASG', 1, ARRAY['AUXILIAR DE SERV GERAIS (LIMPEZA)', 'AUXILIAR DE SERVICOS GERAIS', 'AUXILIAR DE SERVIÇOS GERAIS', 'ASG', 'AUXILIAR DE LIMPEZA']),
  ('Porteiro', 1, ARRAY['PORTEIRO (a)', 'PORTEIRO', 'PORTEIRO(A)', 'AUXILIAR DE PORTARIA']),
  ('Vigia', 1, ARRAY['Vigia', 'VIGIA']),
  ('Recepcionista', 1, ARRAY['RECEPCIONISTA']),
  ('Copeiro', 1, ARRAY['COPEIRO', 'COPEIRA']),
  ('Jardineiro', 1, ARRAY['AUXILIARDE JARDINAGEM', 'AUXILIAR DE JARDINAGEM', 'JARDINEIRO']),
  ('Zelador', 2, ARRAY['ZELADOR', 'ZELADOR(A)']),
  ('Operador de Monitoramento', 2, ARRAY['OPERADOR DE MONITORAMENTO']),
  ('Auxiliar de Manutenção', 2, ARRAY['AUXILIAR DE MANUTENCAO', 'AUXILIAR DE MANUTENÇÃO', 'AUXILIAR DE MANUTENCAO ']),
  ('Assistente Administrativo', 2, ARRAY['Assistente Administrativo Pleno', 'ASSISTENTE ADMINISTRATIVO', 'ASSISTENTE ADMINISTRATIVO PLENO']),
  ('Encarregado', 3, ARRAY['ENCARREGADO JUNIOR', 'ENCARREGADO PLENO', 'ENCARREGADO PLENO ', 'ENCARREGADO', 'LIDER'])
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- 2. Solicitações de férias (substitui ferias_periodos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  funcao_id UUID REFERENCES public.ferias_funcoes(id) ON DELETE SET NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('gozo', 'agendado', 'previsto')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'em_andamento', 'concluida', 'cancelada')),
  dias_abono INTEGER NOT NULL DEFAULT 0,
  adiantamento_13 BOOLEAN NOT NULL DEFAULT false,
  parcelada BOOLEAN NOT NULL DEFAULT false,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('flit', 'manual', 'econtador')),
  observacao TEXT,
  ferista_alocado_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  origem_alocacao TEXT CHECK (origem_alocacao IN ('automatica', 'manual')),
  registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_aprovacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ferias_solicitacoes_datas CHECK (data_fim >= data_inicio)
);

COMMENT ON TABLE public.ferias_solicitacoes IS 'Solicitações/períodos de férias com workflow (pendente → aprovada → em_andamento → concluida) e ferista alocado. Substitui ferias_periodos (migração 070).';
COMMENT ON COLUMN public.ferias_solicitacoes.tipo IS 'gozo = férias já gozadas; agendado = programado/confirmado; previsto = planejamento do RH (pré-agendamento anual, RN-09).';
COMMENT ON COLUMN public.ferias_solicitacoes.departamento_id IS 'Contrato/posto do colaborador na época do registro (base do teto de ausência simultânea, RN-01).';
COMMENT ON COLUMN public.ferias_solicitacoes.origem_alocacao IS 'automatica = sugerida pelo algoritmo de alocação; manual = escolhida pelo RH (RN-10).';

CREATE INDEX IF NOT EXISTS idx_ferias_solicitacoes_colaborador
  ON public.ferias_solicitacoes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ferias_solicitacoes_departamento
  ON public.ferias_solicitacoes(departamento_id);
CREATE INDEX IF NOT EXISTS idx_ferias_solicitacoes_data_inicio
  ON public.ferias_solicitacoes(data_inicio);
CREATE INDEX IF NOT EXISTS idx_ferias_solicitacoes_status
  ON public.ferias_solicitacoes(status);

-- Um colaborador não pode ter o mesmo período duplicado (canceladas não contam)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ferias_solicitacoes_unico
  ON public.ferias_solicitacoes(colaborador_id, tipo, data_inicio, data_fim)
  WHERE status <> 'cancelada';

-- ============================================================
-- 3. Carteira de feristas (quem cobre férias — RN-02)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_feristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL UNIQUE REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  funcao_id UUID REFERENCES public.ferias_funcoes(id) ON DELETE SET NULL,
  max_dias_consecutivos INTEGER NOT NULL DEFAULT 30,
  max_coberturas_mes INTEGER NOT NULL DEFAULT 2,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ferias_feristas IS 'Carteira de feristas: colaboradores móveis que cobrem férias (RN-02). Ferista também tira férias normalmente (RN-04) — é um colaborador como outro qualquer.';
COMMENT ON COLUMN public.ferias_feristas.max_dias_consecutivos IS 'Limite de carga (RN-05): máximo de dias consecutivos cobrindo antes de forçar rotação.';
COMMENT ON COLUMN public.ferias_feristas.max_coberturas_mes IS 'Limite de carga (RN-05): máximo de coberturas por mês por ferista.';

CREATE INDEX IF NOT EXISTS idx_ferias_feristas_funcao
  ON public.ferias_feristas(funcao_id);

-- ============================================================
-- 4. Alocações de cobertura (RN-10: rastreabilidade)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_alocacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.ferias_solicitacoes(id) ON DELETE CASCADE,
  ferista_id UUID NOT NULL REFERENCES public.ferias_feristas(id) ON DELETE CASCADE,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  funcao_id UUID REFERENCES public.ferias_funcoes(id) ON DELETE SET NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'sugerida' CHECK (status IN ('sugerida', 'confirmada', 'cancelada')),
  origem TEXT NOT NULL DEFAULT 'automatica' CHECK (origem IN ('automatica', 'manual')),
  score INTEGER,
  motivo TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_ferias_alocacoes_datas CHECK (data_fim >= data_inicio)
);

COMMENT ON TABLE public.ferias_alocacoes IS 'Coberturas de férias por feristas: sugeridas pelo algoritmo ou manuais, com score e motivo (RN-02, RN-07, RN-10).';

CREATE INDEX IF NOT EXISTS idx_ferias_alocacoes_solicitacao
  ON public.ferias_alocacoes(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_ferias_alocacoes_ferista_datas
  ON public.ferias_alocacoes(ferista_id, data_inicio, data_fim);

-- ============================================================
-- 5. Regras de teto de ausência simultânea (RN-01)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE CASCADE,
  funcao_id UUID REFERENCES public.ferias_funcoes(id) ON DELETE CASCADE,
  max_simultaneos INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ferias_regras IS 'Teto de ausência simultânea por contrato (departamento) + função (RN-01). Linha com departamento_id NULL = regra global default.';

-- NULL não participa de UNIQUE simples; índice com coalesce garante 1 regra
-- por combinação, inclusive a global (NULL, NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ferias_regras_unico
  ON public.ferias_regras(
    COALESCE(departamento_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(funcao_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Default global: 1 ausente por vez por contrato+função
INSERT INTO public.ferias_regras (departamento_id, funcao_id, max_simultaneos)
VALUES (NULL, NULL, 1)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Notificações passam a poder apontar para a solicitação
-- ============================================================

ALTER TABLE public.ferias_notificacoes
  ADD COLUMN IF NOT EXISTS solicitacao_id UUID REFERENCES public.ferias_solicitacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ferias_notificacoes_solicitacao
  ON public.ferias_notificacoes(solicitacao_id);

-- ============================================================
-- 7. Backfill de ferias_periodos → ferias_solicitacoes
-- ============================================================
-- gozo → concluida (fim no passado) / em_andamento (cobre hoje) / aprovada (futuro)
-- agendado → aprovada
-- previsto → pendente
-- funcao_id resolvida pelo cargo do colaborador contra os aliases (upper+trim)

INSERT INTO public.ferias_solicitacoes (
  colaborador_id, departamento_id, funcao_id, data_inicio, data_fim,
  tipo, status, origem, observacao, created_at, updated_at
)
SELECT
  p.colaborador_id,
  c.departamento_id,
  f.id,
  p.data_inicio,
  p.data_fim,
  p.tipo,
  CASE
    WHEN p.tipo = 'previsto' THEN 'pendente'
    WHEN p.tipo = 'agendado' THEN 'aprovada'
    WHEN p.data_fim < CURRENT_DATE THEN 'concluida'
    WHEN p.data_inicio <= CURRENT_DATE THEN 'em_andamento'
    ELSE 'aprovada'
  END,
  p.origem,
  p.descricao,
  p.created_at,
  p.updated_at
FROM public.ferias_periodos p
LEFT JOIN public.colaboradores c ON c.id = p.colaborador_id
LEFT JOIN LATERAL (
  SELECT f2.id
  FROM public.ferias_funcoes f2
  WHERE EXISTS (
    SELECT 1
    FROM unnest(f2.aliases || ARRAY[f2.nome]) AS a
    WHERE a <> '' AND upper(trim(a)) = upper(trim(COALESCE(c.cargo, '')))
  )
  LIMIT 1
) f ON true
-- idempotente: não reinsere período já migrado; ignora órfãos de colaborador
WHERE NOT EXISTS (
  SELECT 1 FROM public.ferias_solicitacoes s
  WHERE s.colaborador_id = p.colaborador_id
    AND s.tipo = p.tipo
    AND s.data_inicio = p.data_inicio
    AND s.data_fim = p.data_fim
)
AND c.id IS NOT NULL;

-- ferias_periodos virou legada (somente leitura de referência até o drop futuro)
COMMENT ON TABLE public.ferias_periodos IS 'LEGADA (migração 112): dados migrados para ferias_solicitacoes. Manter somente para referência até o drop em migração futura.';

-- ============================================================
-- 8. Grants explícitos (obrigatório desde 30/10/2026)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_funcoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_funcoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_solicitacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_solicitacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_feristas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_feristas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_alocacoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_alocacoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_regras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ferias_regras TO service_role;

-- ============================================================
-- 9. RLS — todos leem (decisão da gestão: dados visíveis a todos
--    os perfis); escrita só editores; delete só admin
-- ============================================================

ALTER TABLE public.ferias_funcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_feristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_regras ENABLE ROW LEVEL SECURITY;

-- ferias_funcoes
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ferias_funcoes;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ferias_funcoes;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ferias_funcoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ferias_funcoes;
CREATE POLICY "Permitir select para autenticados" ON public.ferias_funcoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.ferias_funcoes
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.ferias_funcoes
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.ferias_funcoes
  FOR DELETE TO authenticated USING (public.is_admin());

-- ferias_solicitacoes
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ferias_solicitacoes;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ferias_solicitacoes;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ferias_solicitacoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ferias_solicitacoes;
CREATE POLICY "Permitir select para autenticados" ON public.ferias_solicitacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.ferias_solicitacoes
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.ferias_solicitacoes
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.ferias_solicitacoes
  FOR DELETE TO authenticated USING (public.is_admin());

-- ferias_feristas
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ferias_feristas;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ferias_feristas;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ferias_feristas;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ferias_feristas;
CREATE POLICY "Permitir select para autenticados" ON public.ferias_feristas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.ferias_feristas
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.ferias_feristas
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.ferias_feristas
  FOR DELETE TO authenticated USING (public.is_admin());

-- ferias_alocacoes
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ferias_alocacoes;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ferias_alocacoes;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ferias_alocacoes;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ferias_alocacoes;
CREATE POLICY "Permitir select para autenticados" ON public.ferias_alocacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.ferias_alocacoes
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.ferias_alocacoes
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.ferias_alocacoes
  FOR DELETE TO authenticated USING (public.is_admin());

-- ferias_regras
DROP POLICY IF EXISTS "Permitir select para autenticados" ON public.ferias_regras;
DROP POLICY IF EXISTS "Permitir insert para editores" ON public.ferias_regras;
DROP POLICY IF EXISTS "Permitir update para editores" ON public.ferias_regras;
DROP POLICY IF EXISTS "Permitir delete apenas para admins" ON public.ferias_regras;
CREATE POLICY "Permitir select para autenticados" ON public.ferias_regras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert para editores" ON public.ferias_regras
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update para editores" ON public.ferias_regras
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete apenas para admins" ON public.ferias_regras
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 10. Auditoria automática
-- ============================================================

DROP TRIGGER IF EXISTS trg_auditoria_ferias_funcoes ON public.ferias_funcoes;
CREATE TRIGGER trg_auditoria_ferias_funcoes
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_funcoes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_ferias_solicitacoes ON public.ferias_solicitacoes;
CREATE TRIGGER trg_auditoria_ferias_solicitacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_ferias_feristas ON public.ferias_feristas;
CREATE TRIGGER trg_auditoria_ferias_feristas
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_feristas
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trg_auditoria_ferias_alocacoes ON public.ferias_alocacoes;
CREATE TRIGGER trg_auditoria_ferias_alocacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();
