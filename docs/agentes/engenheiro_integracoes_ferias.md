# Relatório de Integração — Módulo de Férias e Alocação de Feristas

> **Autor:** Engenheiro de Integrações — CORH / RH Plena Unificado  
> **Data:** 2026-06-25  
> **Escopo:** integração do novo módulo de Férias e Alocação de Feristas com o sistema existente, sem quebrar funcionalidades em produção.

---

## 1. Integração com autenticação e RLS existente

### 1.1 Autenticação

O sistema utiliza **Supabase Auth** via `src/lib/supabase.ts` (cliente tipado com `Database`) e `src/hooks/useAuth.ts`. O fluxo é:

1. Login com `supabase.auth.signInWithPassword`.
2. Carregamento do perfil na tabela `public.perfis` (função `carregarPerfil`).
3. Níveis de acesso: `admin/ adm`, `gestor`, `rh`, `dp1`, `dp2`, `mesa`, `inspetoria`, `financeiro`, `visualizador`.
4. Novos usuários sem perfil são criados automaticamente como `visualizador` — nunca como admin.

**Recomendação para o módulo de férias:**

- Reutilizar `useAuth()` e o objeto `user` para obter `nivel_acesso` e `empresa_id`.
- Todas as permissões de interface devem usar `ProtectedRoute` (como em `src/App.tsx`) e as funções de `src/lib/permissoes.ts`.
- Novas funções de permissão devem ser adicionadas em `src/lib/permissoes.ts`, seguindo o padrão `isAdm()` / `isDp()`.

### 1.2 Row Level Security (RLS)

A migration `037_rbac_granular.sql` criou as funções auxiliares:

- `public.is_admin()`
- `public.is_editor()`
- `public.is_visualizador()`
- `public.is_dp()`, `is_mesa()`, `is_inspetoria()`, `is_financeiro()`, `is_gestor()`, `is_rh()`

E a função `public.aplicar_rls_padrao(p_tabela TEXT)`, que aplica:

- `SELECT` para autenticados.
- `INSERT/UPDATE` para editores.
- `DELETE` apenas para admins.

Já a migration `034_restringir_select_dados_sensiveis.sql` aplica `SELECT` restrito em tabelas administrativas (`perfis`, `configuracoes`, `log_auditoria`, `auditoria`).

**Recomendação para o módulo de férias:**

- Criar as novas tabelas no schema `public` e habilitar RLS.
- Aplicar `public.aplicar_rls_padrao(...)` nas tabelas principais, **exceto** tabelas que contenham dados sensíveis (como histórico salarial/aviso de férias), que devem usar `SELECT` restrito a editores.
- Registrar as tabelas na migration `037` (ou em nova migration) para garantir consistência.
- Garantir `GRANT EXECUTE` para as funções de permissão quando novas funções forem criadas.

### 1.3 Novas permissões sugeridas

Adicionar em `src/lib/permissoes.ts`:

```ts
// Férias
export const podeVisualizarFerias = (p: NivelAcesso) =>
  isAdm(p) || p === 'gestor' || p === 'rh' || isDp(p) || p === 'mesa' || p === 'inspetoria' || p === 'financeiro'

export const podeEditarFerias = (p: NivelAcesso) =>
  isAdm(p) || p === 'rh' || isDp(p) || p === 'mesa'

export const podeAprovarFerias = (p: NivelAcesso) =>
  isAdm(p) || p === 'rh' || isDp(p)

export const podeGerenciarFeristas = (p: NivelAcesso) =>
  isAdm(p) || p === 'rh' || isDp(p) || p === 'mesa'
```

---

## 2. Tabelas existentes consumidas e mapeamento

### 2.1 Tabelas mestras (somente leitura para o módulo)

| Tabela | Uso no módulo de férias | Campos relevantes |
|---|---|---|
| `public.colaboradores` | Titular das férias e base para feristas substitutos | `id`, `matricula`, `nome_completo`, `cpf`, `cargo`, `departamento`, `departamento_id`, `empresa_id`, `status`, `data_admissao`, `data_demissao`, `tipo_contrato` |
| `public.departamentos` | Alocação de feristas por departamento/posto | `id`, `nome`, `nome_curto`, `empresa_id`, `status` |
| `public.empresas` | Filtro e segregação de dados por empresa | `id`, `nome`, `cnpj` |
| `public.contratos_adicionais` | Regras de regime de trabalho e adicionais do titular | `id`, `nome`, `departamento_id`, `regime_trabalho`, `adicionais` |
| `public.vinculos_adicionais` | Vínculo ativo do colaborador em contrato/departamento | `id`, `contrato_id`, `colaborador_id`, `data_inicio`, `data_fim` |
| `public.calendario_adicionais` | Histórico de dias de férias já registrados (status `ferias`) | `vinculo_id`, `data`, `status`, `substituto_colaborador_id` |
| `public.extras` | Ausências do tipo `Férias` e `Cobertura férias extra faturadas` | `data_ocorrencia`, `colaborador_ausente_id`, `substituto_id`, `motivo`, `status` |

### 2.2 Mapeamento de entidades de férias

Sugestão de novas tabelas:

| Entidade | Tabela | Responsabilidade |
|---|---|---|
| Período aquisitivo | `public.ferias_periodos` | Armazena cada período aquisitivo do colaborador (início, fim, dias de direito, dias usufruídos, saldo, status). |
| Programação de férias | `public.ferias_programacoes` | Cada gozo programado: data início, data fim, dias, período aquisitivo vinculado, status (`solicitado`, `aprovado`, `em_ferias`, `concluido`, `cancelado`). |
| Alocação de feristas | `public.ferias_alocacoes` | Vincula um ferista/substituto a uma programação de férias, com departamento/contrato, data início/fim e status. |
| Feristas disponíveis | `public.ferias_feristas` | Cadastro de colaboradores aptos a atuar como feristas (flag `disponivel`, competências, restrições). |
| Aprovações | `public.ferias_aprovacoes` | Workflow de aprovação: nível (`gestor`, `rh`), aprovador, status, observação. |

### 2.3 Regras de mapeamento obrigatórias

1. **Titular:** `ferias_periodos.colaborador_id` -> `colaboradores.id`.
2. **Empresa:** herdar `colaboradores.empresa_id` no momento da criação do período; filtrar todas as consultas por `empresa_id` quando o usuário logado tiver `empresa_id` preenchido.
3. **Departamento/Posto:** utilizar `departamento_id` e `nome_curto` para alocação; nunca confiar apenas no campo texto `departamento` de `colaboradores`.
4. **Status do colaborador:** não permitir programação de férias para colaboradores `Inativo` ou `Afastado`, salvo fluxo específico de retorno.
5. **Adicionais/Contratos:** quando um ferista for alocado, verificar se ele possui vínculo ativo em `vinculos_adicionais` e `calendario_adicionais` para contabilizar corretamente os adicionais e substituições.
6. **Extras:** ao aprovar férias, verificar se já existe extra do tipo `Férias` ou `Cobertura férias extra faturadas` para o mesmo colaborador/período, evitando duplicidade.


---

## 3. Padrão recomendado de hooks/services

### 3.1 Estrutura de arquivos

Seguir o padrão já adotado no projeto:

```
src/
  hooks/
    useFerias.ts                 # Programações e períodos
    useFeriasPeriodos.ts         # CRUD de períodos aquisitivos
    useFeriasAlocacoes.ts        # Alocação de feristas
    useFeristas.ts               # Cadastro de feristas disponíveis
    useFeriasAprovacoes.ts       # Workflow de aprovação
  lib/
    ferias/
      calculos.ts                # Cálculo de saldo, direito, dias, vencimentos
      alocacao.ts                # Lógica de alocação automática de feristas
      validacoes.ts              # Validações CLT e regras de negócio
      notificacoes.ts            # Geração de alertas/avisos
  types/
    ferias.ts                    # Tipos do módulo
  pages/
    ferias/
      FeriasPage.tsx
      FeriasProgramacaoPage.tsx
      FeriasAlocacaoPage.tsx
      FeristasPage.tsx
```

### 3.2 Hook exemplo — `useFerias`

Inspirado em `useOcorrencias.ts` e `useExtras.ts`:

```ts
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { FeriasProgramacao } from '@/types/ferias'

export interface FiltrosFerias {
  empresaId?: string
  departamentoId?: string
  colaboradorId?: string
  status?: string
  dataInicio?: string
  dataFim?: string
}

export function useFerias() {
  const [programacoes, setProgramacoes] = useState<FeriasProgramacao[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (filtros: FiltrosFerias = {}) => {
    setLoading(true)
    try {
      let query = supabase
        .from('ferias_programacoes')
        .select('*, colaborador:colaborador_id(id, nome_completo, matricula, departamento_id)')
        .order('data_inicio', { ascending: true })

      if (filtros.empresaId) query = query.eq('empresa_id', filtros.empresaId)
      if (filtros.departamentoId) query = query.eq('departamento_id', filtros.departamentoId)
      if (filtros.colaboradorId) query = query.eq('colaborador_id', filtros.colaboradorId)
      if (filtros.status) query = query.eq('status', filtros.status)
      if (filtros.dataInicio) query = query.gte('data_inicio', filtros.dataInicio)
      if (filtros.dataFim) query = query.lte('data_fim', filtros.dataFim)

      const { data, error } = await query
      if (error) throw error
      setProgramacoes(data || [])
      return data || []
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar férias')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(async (payload: Partial<FeriasProgramacao>) => {
    try {
      const { data, error } = await supabase
        .from('ferias_programacoes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      toast.success('Programação de férias criada')
      return data as FeriasProgramacao
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar programação')
      return null
    }
  }, [])

  return { programacoes, loading, listar, criar }
}
```

### 3.3 Tipos — `src/types/ferias.ts`

```ts
export type StatusFeriasProgramacao =
  | 'solicitado'
  | 'aprovado'
  | 'em_ferias'
  | 'concluido'
  | 'cancelado'

export type StatusPeriodoAquisitivo = 'aberto' | 'quitado' | 'vencido'

export interface FeriasPeriodo {
  id: string
  colaborador_id: string
  empresa_id: string | null
  data_inicio_aquisitivo: string
  data_fim_aquisitivo: string
  data_inicio_concessivo: string
  data_fim_concessivo: string
  dias_direito: number
  dias_usufruidos: number
  dias_vendidos: number
  saldo_dias: number
  status: StatusPeriodoAquisitivo
  observacoes: string | null
  created_at?: string
  updated_at?: string
}

export interface FeriasProgramacao {
  id: string
  periodo_id: string
  colaborador_id: string
  empresa_id: string | null
  departamento_id: string | null
  data_inicio: string
  data_fim: string
  dias: number
  dias_vendidos: number
  status: StatusFeriasProgramacao
  usuario_id: string | null
  created_at?: string
  updated_at?: string
}

export interface FeriasAlocacao {
  id: string
  programacao_id: string
  ferista_id: string
  colaborador_substituto_id: string
  contrato_id: string | null
  departamento_id: string | null
  data_inicio: string
  data_fim: string
  status: 'previsto' | 'confirmado' | 'cancelado'
  observacoes: string | null
  created_at?: string
  updated_at?: string
}
```

### 3.4 Integração com `Database` em `src/types/database.ts`

Adicionar no `Database.public.Tables`:

```ts
ferias_periodos: {
  Row: FeriasPeriodo & Record<string, unknown>
  Insert: Partial<FeriasPeriodo> & Record<string, unknown>
  Update: Partial<FeriasPeriodo> & Record<string, unknown>
  Relationships: []
}
ferias_programacoes: { /* ... */ }
ferias_alocacoes: { /* ... */ }
ferias_feristas: { /* ... */ }
ferias_aprovacoes: { /* ... */ }
```

---

## 4. Estratégia de triggers/functions no Supabase

### 4.1 Objetivos das automações

1. Calcular saldo de dias ao inserir/atualizar programação.
2. Gerar alerta quando o período concessivo estiver próximo do vencimento.
3. Atualizar `calendario_adicionais` com status `ferias` e `substituto_colaborador_id`.
4. Criar ou atualizar registro em `public.extras` quando houver cobertura faturada.
5. Auditoria automática das tabelas de férias (reaproveitar `public.auditar_operacao`).

### 4.2 Trigger de cálculo de saldo

```sql
CREATE OR REPLACE FUNCTION public.calcular_saldo_ferias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ferias_periodos
  SET dias_usufruidos = COALESCE((
    SELECT SUM(dias)
    FROM public.ferias_programacoes
    WHERE periodo_id = NEW.periodo_id
      AND status NOT IN ('cancelado')
  ), 0),
      saldo_dias = dias_direito - COALESCE((
    SELECT SUM(dias + dias_vendidos)
    FROM public.ferias_programacoes
    WHERE periodo_id = NEW.periodo_id
      AND status NOT IN ('cancelado')
  ), 0),
      updated_at = now()
  WHERE id = NEW.periodo_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_calcular_saldo_ferias ON public.ferias_programacoes;
CREATE TRIGGER trigger_calcular_saldo_ferias
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_programacoes
  FOR EACH ROW EXECUTE FUNCTION public.calcular_saldo_ferias();
```

### 4.3 Trigger de alocação automática no calendário de adicionais

```sql
CREATE OR REPLACE FUNCTION public.sincronizar_ferias_calendario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vinculo_id uuid;
  v_data date;
BEGIN
  -- Considera apenas programações aprovadas
  IF NEW.status = 'aprovado' OR NEW.status = 'em_ferias' THEN
    -- Busca vínculo ativo do colaborador no período
    SELECT id INTO v_vinculo_id
    FROM public.vinculos_adicionais
    WHERE colaborador_id = NEW.colaborador_id
      AND data_inicio <= NEW.data_inicio
      AND data_fim >= NEW.data_fim
    ORDER BY data_inicio DESC
    LIMIT 1;

    IF v_vinculo_id IS NOT NULL THEN
      v_data := NEW.data_inicio;
      WHILE v_data <= NEW.data_fim LOOP
        INSERT INTO public.calendario_adicionais (vinculo_id, data, status)
        VALUES (v_vinculo_id, v_data, 'ferias')
        ON CONFLICT (vinculo_id, data)
        DO UPDATE SET status = 'ferias', updated_at = now();
        v_data := v_data + INTERVAL '1 day';
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sincronizar_ferias_calendario ON public.ferias_programacoes;
CREATE TRIGGER trigger_sincronizar_ferias_calendario
  AFTER INSERT OR UPDATE ON public.ferias_programacoes
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_ferias_calendario();
```

### 4.4 Function para gerar alertas de vencimento

```sql
CREATE OR REPLACE FUNCTION public.gerar_alertas_ferias_vencidas()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.alertas (tipo, titulo, descricao, severidade, status, data_vencimento, colaborador_id, empresa_id, dados_json)
  SELECT
    'ferias_vencendo',
    'Período concessivo próximo do vencimento',
    'O colaborador ' || c.nome_completo || ' possui férias do período aquisitivo ' ||
      to_char(fp.data_inicio_aquisitivo, 'DD/MM/YYYY') || ' a ' ||
      to_char(fp.data_fim_aquisitivo, 'DD/MM/YYYY') || ' com vencimento em ' ||
      to_char(fp.data_fim_concessivo, 'DD/MM/YYYY'),
    CASE
      WHEN fp.data_fim_concessivo <= CURRENT_DATE THEN 'critica'
      WHEN fp.data_fim_concessivo <= CURRENT_DATE + INTERVAL '90 days' THEN 'alta'
      ELSE 'media'
    END,
    'ativo',
    fp.data_fim_concessivo,
    c.id,
    c.empresa_id,
    jsonb_build_object('periodo_id', fp.id, 'dias_saldo', fp.saldo_dias)
  FROM public.ferias_periodos fp
  JOIN public.colaboradores c ON c.id = fp.colaborador_id
  WHERE fp.status = 'aberto'
    AND fp.saldo_dias > 0
    AND fp.data_fim_concessivo <= CURRENT_DATE + INTERVAL '180 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.alertas a
      WHERE a.colaborador_id = c.id
        AND a.tipo = 'ferias_vencendo'
        AND a.status = 'ativo'
        AND a.dados_json->>'periodo_id' = fp.id::text
    );
END;
$$;
```

Essa function pode ser chamada por um cron job do Supabase ou por uma Edge Function diária.

### 4.5 Cuidados com triggers

- Evitar triggers `BEFORE` que modifiquem `NEW` de forma a quebrar inserções em lote.
- Sempre usar `ON CONFLICT` para evitar falhas em reprocessamentos.
- Garantir que as functions sejam `SECURITY DEFINER` apenas quando necessário; preferir `SECURITY INVOKER` para validações que dependam do usuário.
- Registrar triggers de auditoria nas novas tabelas reaproveitando `public.auditar_operacao` (migration `029`).

---

## 5. Pontos de atenção para não quebrar o sistema existente

### 5.1 Banco de dados

1. **Não alterar tabelas mestres** (`colaboradores`, `departamentos`, `empresas`, `contratos_adicionais`, `vinculos_adicionais`) sem migration separada e justificada.
2. **Índices:** adicionar índices nas chaves estrangeiras e campos de filtro (`colaborador_id`, `empresa_id`, `departamento_id`, `status`, `data_inicio`, `data_fim`).
3. **Constraints:** evitar constraints complexas que impeçam importações do e-Contador (ver lição da migration `033_matricula_unica_por_empresa.sql`).
4. **RLS:** toda tabela nova deve ter RLS habilitado antes de ir para produção.

### 5.2 Código

1. **Lazy loading:** registrar novas páginas em `src/routes/lazyPages.ts` e adicionar rotas em `src/App.tsx`, seguindo o padrão existente.
2. **Menu:** atualizar `src/components/layout/Sidebar.tsx` substituindo o placeholder `/ferias` por rotas reais.
3. **Toast e loading:** manter o padrão `try/catch/finally` com `toast` e `setLoading` dos hooks existentes.
4. **Tipos:** nunca usar `any` nos novos tipos; estender `Database` em `src/types/database.ts`.
5. **Permissões:** não duplicar lógica de permissão; centralizar em `src/lib/permissoes.ts`.

### 5.3 Integração com módulos existentes

1. **Adicionais contratuais:** ao marcar férias no calendário, respeitar o `status` existente (`trabalhou`, `folga`, `ferias`, etc.) e não sobrescrever dias já preenchidos manualmente sem confirmação.
2. **Extras:** ao criar cobertura de férias, verificar duplicidade com a tabela `extras` (campos `colaborador_ausente_id`, `data_ocorrencia`, `motivo`).
3. **VR:** colaboradores em férias aparecerão com 0 dias elegíveis no VR; isso já é comportamento esperado (ver migration/ajuste `2.9` do checklist).
4. **e-Contador:** importação de colaboradores não deve sobrescrever datas de férias — apenas dados cadastrais.

### 5.4 LGPD e auditoria

1. Novas tabelas devem ser auditadas via trigger `public.auditar_operacao`.
2. Dados sensíveis (como aviso de férias com valores) devem ter `SELECT` restrito.
3. Consentimento LGPD já cobre "gestão de colaboradores" e "controle de ponto" (migration `036`); adicionar "gestão de férias" se necessário.

### 5.5 Testes

1. Criar testes unitários em `src/lib/ferias/*.test.ts` para cálculos de saldo, vencimento e alocação.
2. Validar migrations em ambiente de homologação antes de produção.
3. Testar fluxo com perfis `visualizador`, `mesa`, `dp1`, `dp2` e `admin`.

---

## 6. Sugestão de migration inicial e ordem de execução

Criar o arquivo `supabase/migrations/039_modulo_ferias.sql`.

### 6.1 Ordem recomendada dentro da migration

1. **Criar tipos/enums** (se necessário).
2. **Criar tabelas** na ordem de dependência:
   - `ferias_periodos`
   - `ferias_programacoes`
   - `ferias_feristas`
   - `ferias_alocacoes`
   - `ferias_aprovacoes`
3. **Criar índices**.
4. **Criar functions/triggers** (cálculo de saldo, sincronização com calendário).
5. **Habilitar RLS** e criar policies.
6. **Adicionar triggers de auditoria**.
7. **Inserir seeds** (se houver configurações padrão).

### 6.2 Migration sugerida (esqueleto)

```sql
-- Migração 039: Módulo de Férias e Alocação de Feristas

-- ============================================================
-- 1. Tabelas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ferias_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  data_inicio_aquisitivo date NOT NULL,
  data_fim_aquisitivo date NOT NULL,
  data_inicio_concessivo date NOT NULL,
  data_fim_concessivo date NOT NULL,
  dias_direito integer NOT NULL DEFAULT 30,
  dias_usufruidos integer NOT NULL DEFAULT 0,
  dias_vendidos integer NOT NULL DEFAULT 0,
  saldo_dias integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'quitado', 'vencido')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ferias_programacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.ferias_periodos(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias integer NOT NULL,
  dias_vendidos integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'aprovado', 'em_ferias', 'concluido', 'cancelado')),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ferias_feristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL UNIQUE REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  disponivel boolean NOT NULL DEFAULT true,
  competencias text[] DEFAULT '{}',
  restricoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ferias_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_id uuid NOT NULL REFERENCES public.ferias_programacoes(id) ON DELETE CASCADE,
  ferista_id uuid NOT NULL REFERENCES public.ferias_feristas(id) ON DELETE CASCADE,
  colaborador_substituto_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos_adicionais(id) ON DELETE SET NULL,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status text NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto', 'confirmado', 'cancelado')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ferias_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_id uuid NOT NULL REFERENCES public.ferias_programacoes(id) ON DELETE CASCADE,
  aprovador_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nivel text NOT NULL CHECK (nivel IN ('gestor', 'rh')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ferias_periodos_colaborador_id ON public.ferias_periodos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ferias_periodos_empresa_id ON public.ferias_periodos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ferias_periodos_status ON public.ferias_periodos(status);
CREATE INDEX IF NOT EXISTS idx_ferias_programacoes_periodo_id ON public.ferias_programacoes(periodo_id);
CREATE INDEX IF NOT EXISTS idx_ferias_programacoes_colaborador_id ON public.ferias_programacoes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ferias_programacoes_empresa_id ON public.ferias_programacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ferias_programacoes_status ON public.ferias_programacoes(status);
CREATE INDEX IF NOT EXISTS idx_ferias_programacoes_data_inicio ON public.ferias_programacoes(data_inicio);
CREATE INDEX IF NOT EXISTS idx_ferias_alocacoes_programacao_id ON public.ferias_alocacoes(programacao_id);
CREATE INDEX IF NOT EXISTS idx_ferias_alocacoes_ferista_id ON public.ferias_alocacoes(ferista_id);

-- ============================================================
-- 3. Functions e triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.calcular_saldo_ferias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.ferias_periodos
  SET
    dias_usufruidos = COALESCE((
      SELECT SUM(dias)
      FROM public.ferias_programacoes
      WHERE periodo_id = NEW.periodo_id
        AND status NOT IN ('cancelado')
    ), 0),
    saldo_dias = dias_direito - COALESCE((
      SELECT SUM(dias + dias_vendidos)
      FROM public.ferias_programacoes
      WHERE periodo_id = NEW.periodo_id
        AND status NOT IN ('cancelado')
    ), 0),
    updated_at = now()
  WHERE id = NEW.periodo_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_calcular_saldo_ferias ON public.ferias_programacoes;
CREATE TRIGGER trigger_calcular_saldo_ferias
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_programacoes
  FOR EACH ROW EXECUTE FUNCTION public.calcular_saldo_ferias();

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE public.ferias_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_programacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_feristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias_aprovacoes ENABLE ROW LEVEL SECURITY;

-- Policies padrão
DROP POLICY IF EXISTS "Permitir select de ferias_periodos" ON public.ferias_periodos;
DROP POLICY IF EXISTS "Permitir insert de ferias_periodos" ON public.ferias_periodos;
DROP POLICY IF EXISTS "Permitir update de ferias_periodos" ON public.ferias_periodos;
DROP POLICY IF EXISTS "Permitir delete de ferias_periodos" ON public.ferias_periodos;

CREATE POLICY "Permitir select de ferias_periodos"
  ON public.ferias_periodos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir insert de ferias_periodos"
  ON public.ferias_periodos FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Permitir update de ferias_periodos"
  ON public.ferias_periodos FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY "Permitir delete de ferias_periodos"
  ON public.ferias_periodos FOR DELETE TO authenticated USING (public.is_admin());

-- (Repetir padrão para ferias_programacoes, ferias_feristas, ferias_alocacoes, ferias_aprovacoes)

-- ============================================================
-- 5. Auditoria
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auditoria_ferias_programacoes ON public.ferias_programacoes;
CREATE TRIGGER trigger_auditoria_ferias_programacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_programacoes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();

DROP TRIGGER IF EXISTS trigger_auditoria_ferias_alocacoes ON public.ferias_alocacoes;
CREATE TRIGGER trigger_auditoria_ferias_alocacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.ferias_alocacoes
  FOR EACH ROW EXECUTE FUNCTION public.auditar_operacao();
```

### 6.3 Passos de implantação

1. Executar migration `039_modulo_ferias.sql` no ambiente de homologação.
2. Atualizar `src/types/ferias.ts` e `src/types/database.ts`.
3. Implementar hooks `useFerias`, `useFeriasPeriodos`, `useFeriasAlocacoes`, `useFeristas`.
4. Implementar páginas em `src/pages/ferias/` e registrá-las em `src/routes/lazyPages.ts` e `src/App.tsx`.
5. Atualizar `src/components/layout/Sidebar.tsx` e `src/lib/permissoes.ts`.
6. Executar testes unitários e testes de integração.
7. Promover para produção.

---

## 7. Resumo executivo

O módulo de Férias e Alocação de Feristas deve ser construído como uma **camada adicional sobre os dados mestres existentes** (`colaboradores`, `departamentos`, `contratos_adicionais`, `vinculos_adicionais`, `calendario_adicionais`, `extras`), sem alterar a estrutura dessas tabelas. A autenticação e o RLS devem seguir o padrão RBAC granular já estabelecido (`is_admin`, `is_editor`, etc.), e as permissões devem ser centralizadas em `src/lib/permissoes.ts`.

A arquitetura recomendada é:

- **Banco:** 5 novas tabelas versionadas em uma única migration `039`, com RLS, índices e triggers de cálculo/auditoria.
- **Frontend:** hooks por domínio (`useFerias*`), páginas lazy-loaded em `src/pages/ferias/`, tipos em `src/types/ferias.ts`.
- **Automação:** triggers no Supabase para cálculo de saldo, sincronização com `calendario_adicionais` e geração de alertas de vencimento.

Os principais riscos a mitigar são: duplicidade com o módulo de Extras, sobrescrita inadvertida de dias no calendário de Adicionais, permissões abertas em tabelas novas e falta de auditoria. Seguindo este plano, o módulo pode ser integrado de forma segura e progressiva, sem indisponibilidade do sistema existente.
