# Plano de Arquitetura — Módulo de Gestão de Férias e Alocação de Feristas

> **Projeto:** RH Plena Unificado (CORH)  
> **Local:** `c:\Projetos\RH-Plena-Unificado`  
> **Elaborado por:** Arquiteto de Software Sênior  
> **Data de referência:** 2026-06-25

---

## 0. Contexto e premissas

O CORH é uma aplicação React 19 + TypeScript + Vite, com UI em Tailwind CSS + Radix UI, autenticação e banco em Supabase (Postgres + RLS), geração de PDFs via `jspdf` e planilhas via `@e965/xlsx`. O padrão dominante é:

- **Hooks de domínio** (`src/hooks/use*.ts`) encapsulam CRUD e regras de apresentação.
- **Páginas** (`src/pages/<modulo>/*Page.tsx`) consomem os hooks e são lazy-loaded via `src/routes/lazyPages.ts`.
- **Tipos** ficam em `src/types/<dominio>.ts` e são reexportados por `src/types/index.ts`.
- **Migrations** versionadas em `supabase/migrations/NNN_descricao.sql`.
- **RLS** usa as funções auxiliares `is_admin()`, `is_editor()`, `is_rh()`, `is_dp()`, etc. (migration `037`).

O módulo `/ferias` hoje é um placeholder. Este plano propõe sua implementação respeitando as convenções acima e integrando-se aos dados mestres (`colaboradores`, `departamentos`, `empresas`), ao módulo de **Extras** (substituições pagas em cash) e, opcionalmente, ao módulo de **Adicionais** (calendário de dias trabalhados/folga/férias).

---

## 1. Decisões arquiteturais

### 1.1 Separação de responsabilidades

| Responsabilidade | Tecnologia | Justificativa |
|---|---|---|
| CRUD de saldos, períodos e alocações | Supabase Client + hooks | Padrão existente; baixa latência; RLS garante segurança. |
| Algoritmo de alocação de feristas | **Supabase Edge Function** (`alocar-ferias`) | Lógica de restrições, scoring e conflitos é complexa; TypeScript facilita manutenção; pode retornar sugestões sem persistir. |
| Cálculo de saldo de férias (CLT) | PostgreSQL function + trigger | Garante consistência transacional ao alterar períodos; evita desvios de saldo. |
| Auditoria de alterações | Trigger reutilizando `auditar_operacao()` (migration `029`) | Padrão já adotado em outras tabelas críticas. |
| Geração de recibo/formulário de férias | `jspdf` + `jspdf-autotable` (frontend) | Mesma stack dos recibos de extras e CEU. |
| Exportação de relatórios | `@e965/xlsx` (frontend) | Mesma stack de relatórios de adicionais. |

### 1.2 Modelo de dados

Modelo relacional em português, como o restante do projeto:

- `saldos_ferias` — saldo por colaborador e período aquisitivo.
- `periodos_ferias` — períodos de gozo solicitados/aprovados.
- `alocacoes_ferias` — substitutos alocados para cobrir feristas.
- `regras_alocacao_ferias` — regras por empresa/departamento (cobertura mínima, antecedência, etc.).
- `historico_alocacao_ferias` — log de mudanças em alocações (auditoria específica).

### 1.3 Integrações

- **Extras:** ao confirmar uma alocação paga, pode-se gerar automaticamente um registro na tabela `extras` (motivo `Férias` ou `Cobertura férias extra faturadas`).
- **Adicionais:** o calendário de adicionais (`calendario_adicionais.status = 'ferias'`) deve ser atualizado para os dias de gozo, evitando pagamento indevido de adicionais.
- **e-Contador:** campos como `data_admissao` vêm do cadastro de colaboradores; não haverá integração direta nesta fase.

### 1.4 Local da lógica de negócio

- Regras de saldo (direito proporcional, abatimentos por faltas) no banco (function/trigger).
- Regras de alocação (scoring, conflitos) na Edge Function.
- Validações de formulário e permissões no frontend (`src/lib/permissoes.ts`).

---

## 2. Schema SQL completo (migrations)

### 2.1 Migration `039_modulo_ferias.sql`

```sql
-- Migração 039: Cria módulo de Férias e Alocação de Feristas

-- ============================================================
-- 1. Tabela de saldos de férias
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saldos_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio date NOT NULL,
  periodo_aquisitivo_fim date NOT NULL,
  dias_direito integer NOT NULL DEFAULT 30,
  dias_usufruidos integer NOT NULL DEFAULT 0,
  dias_vendidos integer NOT NULL DEFAULT 0,
  dias_saldo integer NOT NULL GENERATED ALWAYS AS (
    GREATEST(dias_direito - dias_usufruidos - dias_vendidos, 0)
  ) STORED,
  status text NOT NULL DEFAULT 'Em andamento' CHECK (status IN ('Em andamento', 'Agendado', 'Usufruido', 'Expirado')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saldos_ferias IS 'Saldo de férias por colaborador e período aquisitivo';

CREATE INDEX IF NOT EXISTS idx_saldos_ferias_colaborador_id ON public.saldos_ferias(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_saldos_ferias_periodo ON public.saldos_ferias(periodo_aquisitivo_inicio, periodo_aquisitivo_fim);

-- Um colaborador não pode ter dois saldos para o mesmo período aquisitivo
CREATE UNIQUE INDEX IF NOT EXISTS idx_saldos_ferias_unico
  ON public.saldos_ferias(colaborador_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim);

-- ============================================================
-- 2. Tabela de períodos de férias
-- ============================================================

CREATE TABLE IF NOT EXISTS public.periodos_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  saldo_ferias_id uuid NOT NULL REFERENCES public.saldos_ferias(id) ON DELETE CASCADE,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias_solicitados integer NOT NULL,
  dias_vendidos integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Solicitado' CHECK (status IN ('Solicitado', 'Aprovado', 'Rejeitado', 'Cancelado', 'Usufruido')),
  tipo_periodo text NOT NULL DEFAULT 'Integral' CHECK (tipo_periodo IN ('Integral', 'Parcelado', 'Antecipado')),
  turno text, -- turno do colaborador ferista (Dia, Noite, etc.)
  observacao text,
  usuario_solicitante_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_aprovador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_aprovacao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_periodo_ferias_datas CHECK (data_fim >= data_inicio),
  CONSTRAINT chk_dias_solicitados_positivos CHECK (dias_solicitados > 0)
);

COMMENT ON TABLE public.periodos_ferias IS 'Períodos de gozo de férias solicitados e aprovados';

CREATE INDEX IF NOT EXISTS idx_periodos_ferias_colaborador_id ON public.periodos_ferias(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_periodos_ferias_departamento_id ON public.periodos_ferias(departamento_id);
CREATE INDEX IF NOT EXISTS idx_periodos_ferias_data_inicio ON public.periodos_ferias(data_inicio);
CREATE INDEX IF NOT EXISTS idx_periodos_ferias_status ON public.periodos_ferias(status);

-- ============================================================
-- 3. Tabela de alocações de substitutos (feristas)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.alocacoes_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_ferias_id uuid NOT NULL REFERENCES public.periodos_ferias(id) ON DELETE CASCADE,
  substituto_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  turno text,
  status text NOT NULL DEFAULT 'Sugerido' CHECK (status IN ('Sugerido', 'Confirmado', 'Cancelado', 'Substituido')),
  score integer, -- pontuação da sugestão do algoritmo
  motivo_conflito text,
  gera_extra boolean NOT NULL DEFAULT false,
  extra_id uuid REFERENCES public.extras(id) ON DELETE SET NULL,
  observacao text,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_alocacoes_ferias_datas CHECK (data_fim >= data_inicio)
);

COMMENT ON TABLE public.alocacoes_ferias IS 'Substitutos alocados para cobrir períodos de férias';

CREATE INDEX IF NOT EXISTS idx_alocacoes_ferias_periodo_id ON public.alocacoes_ferias(periodo_ferias_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_ferias_substituto_id ON public.alocacoes_ferias(substituto_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_ferias_departamento_id ON public.alocacoes_ferias(departamento_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_ferias_data_inicio ON public.alocacoes_ferias(data_inicio);

-- ============================================================
-- 4. Tabela de regras de alocação
-- ============================================================

CREATE TABLE IF NOT EXISTS public.regras_alocacao_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE CASCADE,
  dias_antecedencia_min integer NOT NULL DEFAULT 30,
  dias_antecedencia_max integer NOT NULL DEFAULT 365,
  max_feristas_simultaneos integer NOT NULL DEFAULT 1,
  max_horas_semana integer, -- limite de carga horária do substituto
  requer_aprovacao boolean NOT NULL DEFAULT true,
  prioridade_criterio text NOT NULL DEFAULT 'departamento_turno_falta' CHECK (prioridade_criterio IN (
    'departamento_turno_falta',
    'turno_departamento_falta',
    'menor_carga_horaria'
  )),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.regras_alocacao_ferias IS 'Regras para alocação de substitutos em férias';

CREATE INDEX IF NOT EXISTS idx_regras_alocacao_empresa ON public.regras_alocacao_ferias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_regras_alocacao_departamento ON public.regras_alocacao_ferias(departamento_id);

-- ============================================================
-- 5. Tabela de histórico de alocações
-- ============================================================

CREATE TABLE IF NOT EXISTS public.historico_alocacao_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alocacao_id uuid NOT NULL REFERENCES public.alocacoes_ferias(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE', 'CONFIRMAR', 'CANCELAR')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.historico_alocacao_ferias IS 'Histórico de alterações em alocações de férias';

CREATE INDEX IF NOT EXISTS idx_historico_alocacao_alocacao_id ON public.historico_alocacao_ferias(alocacao_id);

-- ============================================================
-- 6. Função para atualizar saldo ao mudar período de férias
-- ============================================================

CREATE OR REPLACE FUNCTION public.atualizar_saldo_ferias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dias integer;
BEGIN
  -- Só atualiza saldo se o período estiver aprovado ou usufruído
  IF NEW.status IN ('Aprovado', 'Usufruido') THEN
    v_dias := NEW.dias_solicitados + NEW.dias_vendidos;

    UPDATE public.saldos_ferias
    SET dias_usufruidos = (
        SELECT COALESCE(SUM(dias_solicitados), 0)
        FROM public.periodos_ferias
        WHERE saldo_ferias_id = NEW.saldo_ferias_id
          AND status IN ('Aprovado', 'Usufruido')
      ),
      dias_vendidos = (
        SELECT COALESCE(SUM(dias_vendidos), 0)
        FROM public.periodos_ferias
        WHERE saldo_ferias_id = NEW.saldo_ferias_id
          AND status IN ('Aprovado', 'Usufruido')
      ),
      updated_at = now()
    WHERE id = NEW.saldo_ferias_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_atualizar_saldo_ferias ON public.periodos_ferias;
CREATE TRIGGER trigger_atualizar_saldo_ferias
  AFTER INSERT OR UPDATE OF status, dias_solicitados, dias_vendidos ON public.periodos_ferias
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_saldo_ferias();

-- ============================================================
-- 7. RLS padrão
-- ============================================================

ALTER TABLE public.saldos_ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alocacoes_ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_alocacao_ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_alocacao_ferias ENABLE ROW LEVEL SECURITY;

-- saldos_ferias
DROP POLICY IF EXISTS "Permitir select de saldos_ferias" ON public.saldos_ferias;
DROP POLICY IF EXISTS "Permitir insert de saldos_ferias" ON public.saldos_ferias;
DROP POLICY IF EXISTS "Permitir update de saldos_ferias" ON public.saldos_ferias;
DROP POLICY IF EXISTS "Permitir delete de saldos_ferias" ON public.saldos_ferias;

CREATE POLICY "Permitir select de saldos_ferias" ON public.saldos_ferias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert de saldos_ferias" ON public.saldos_ferias FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update de saldos_ferias" ON public.saldos_ferias FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete de saldos_ferias" ON public.saldos_ferias FOR DELETE TO authenticated USING (public.is_admin());

-- periodos_ferias
DROP POLICY IF EXISTS "Permitir select de periodos_ferias" ON public.periodos_ferias;
DROP POLICY IF EXISTS "Permitir insert de periodos_ferias" ON public.periodos_ferias;
DROP POLICY IF EXISTS "Permitir update de periodos_ferias" ON public.periodos_ferias;
DROP POLICY IF EXISTS "Permitir delete de periodos_ferias" ON public.periodos_ferias;

CREATE POLICY "Permitir select de periodos_ferias" ON public.periodos_ferias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert de periodos_ferias" ON public.periodos_ferias FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update de periodos_ferias" ON public.periodos_ferias FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete de periodos_ferias" ON public.periodos_ferias FOR DELETE TO authenticated USING (public.is_admin());

-- alocacoes_ferias
DROP POLICY IF EXISTS "Permitir select de alocacoes_ferias" ON public.alocacoes_ferias;
DROP POLICY IF EXISTS "Permitir insert de alocacoes_ferias" ON public.alocacoes_ferias;
DROP POLICY IF EXISTS "Permitir update de alocacoes_ferias" ON public.alocacoes_ferias;
DROP POLICY IF EXISTS "Permitir delete de alocacoes_ferias" ON public.alocacoes_ferias;

CREATE POLICY "Permitir select de alocacoes_ferias" ON public.alocacoes_ferias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert de alocacoes_ferias" ON public.alocacoes_ferias FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update de alocacoes_ferias" ON public.alocacoes_ferias FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete de alocacoes_ferias" ON public.alocacoes_ferias FOR DELETE TO authenticated USING (public.is_admin());

-- regras_alocacao_ferias
DROP POLICY IF EXISTS "Permitir select de regras_alocacao_ferias" ON public.regras_alocacao_ferias;
DROP POLICY IF EXISTS "Permitir insert de regras_alocacao_ferias" ON public.regras_alocacao_ferias;
DROP POLICY IF EXISTS "Permitir update de regras_alocacao_ferias" ON public.regras_alocacao_ferias;
DROP POLICY IF EXISTS "Permitir delete de regras_alocacao_ferias" ON public.regras_alocacao_ferias;

CREATE POLICY "Permitir select de regras_alocacao_ferias" ON public.regras_alocacao_ferias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert de regras_alocacao_ferias" ON public.regras_alocacao_ferias FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update de regras_alocacao_ferias" ON public.regras_alocacao_ferias FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete de regras_alocacao_ferias" ON public.regras_alocacao_ferias FOR DELETE TO authenticated USING (public.is_admin());

-- historico_alocacao_ferias (apenas leitura; insert via trigger)
DROP POLICY IF EXISTS "Permitir select de historico_alocacao_ferias" ON public.historico_alocacao_ferias;
CREATE POLICY "Permitir select de historico_alocacao_ferias" ON public.historico_alocacao_ferias FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 8. Auditoria automática nas tabelas críticas
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auditoria_saldos_ferias ON public.saldos_ferias;
CREATE TRIGGER trigger_auditoria_saldos_ferias
  AFTER INSERT OR UPDATE OR DELETE ON public.saldos_ferias
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_periodos_ferias ON public.periodos_ferias;
CREATE TRIGGER trigger_auditoria_periodos_ferias
  AFTER INSERT OR UPDATE OR DELETE ON public.periodos_ferias
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_alocacoes_ferias ON public.alocacoes_ferias;
CREATE TRIGGER trigger_auditoria_alocacoes_ferias
  AFTER INSERT OR UPDATE OR DELETE ON public.alocacoes_ferias
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();
