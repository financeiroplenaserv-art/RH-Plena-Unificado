# Revisão de Arquitetura Geral — CORH / RH Plena Unificado

**Data:** 25/06/2026  
**Projeto:** `C:\Projetos\RH-Plena-Unificado`  
**Escopo:** Frontend SPA (React + Vite + Supabase) e camada de dados (migrations).

---

## 1. Visão Geral da Arquitetura Atual

O projeto é uma **SPA React 19** compilada com **Vite**, estilizada com **Tailwind CSS v4** e **shadcn/ui** (componentes baseados em Radix UI), e tipada com **TypeScript 5.8**. A persistência e autenticação são inteiramente delegadas ao **Supabase** (Auth + PostgreSQL + Row Level Security + Storage). A arquitetura pode ser classificada como um **frontend monolítico modular**, com separação por domínio de negócio dentro do diretório `src/pages/` e `src/hooks/`.

### Stack e configurações relevantes

| Camada | Tecnologia |
|---|---|
| Build / HMR | Vite 8 (`vite.config.ts` com alias `@/` para `./src`) |
| Framework UI | React 19 + React Router DOM 7 |
| Estilo | Tailwind CSS v4 via plugin `@tailwindcss/vite` |
| Componentes | shadcn/ui (`src/components/ui/`) + Radix primitives |
| Ícones | `lucide-react` |
| Notificações | `sonner` |
| Dados / Auth | `@supabase/supabase-js` |
| Testes | Vitest 4 + jsdom + `@testing-library/react` |
| Relatórios/PDF | `jspdf`, `jspdf-autotable`, `pdfjs-dist` |
| Planilhas | `@e965/xlsx` |

### Organização de diretórios

```
src/
├── App.tsx                 # Ponto de montagem da aplicação + todas as rotas
├── routes/lazyPages.ts     # Lazy loading centralizado de todas as páginas
├── pages/                  # Páginas organizadas por domínio (rh, ceu, vr, extras, adicionais)
├── hooks/                  # Hooks customizados de dados (useColaboradores, useExtras etc.)
├── lib/                    # Utilitários, parsers, cálculos, cliente Supabase, permissões
├── services/               # Apenas econtadorApi.ts (integração externa)
├── components/             # Componentes compartilhados + componentes por domínio
├── types/                  # Tipos TypeScript (database.ts, adicionais.ts, extras.ts, vr.ts etc.)
└── test/setup.ts           # Configuração de testes
```

### Padrão de acesso a dados

Cada domínio possui um hook em `src/hooks/` que encapsula:

- Estado local (`useState`) para listas, loading e paginação.
- Chamadas diretas ao cliente Supabase (`supabase.from(...)`).
- Toasts de sucesso/erro via `sonner`.
- CRUD básico e, em alguns casos, lógica de negócio (ex.: `useEContador` sincroniza departamentos e importa colaboradores).

A autenticação é tratada por `useAuth`, que sincroniza o objeto `Perfil` (tabela `perfis`) com a sessão do Supabase Auth, sem confiar em `localStorage` para restaurar sessão — uma decisão de segurança correta.

### Segurança e permissões

- **RBAC granular:** 10 perfis/níveis (`admin/adm`, `gestor`, `rh`, `dp1`, `dp2`, `mesa`, `inspetoria`, `financeiro`, `visualizador`).
- **Autorização no frontend:** `ProtectedRoute` recebe `nivelMinimo` e redireciona usuários sem acesso; `src/lib/permissoes.ts` centraliza helpers de permissão por ação.
- **RLS no banco:** 38 migrations versionadas em `supabase/migrations/`, incluindo policies RLS (`037_rbac_granular.sql`, `032_rls_extras_e_recibos.sql` etc.), criptografia do token e-Contador (`030_criptografar_token_econtador.sql`) e consentimento LGPD (`036_consentimento_lgpd.sql`).
- **Integração externa:** e-Contador pode operar via Edge Function (`supabase/functions/econtador`) para não expor o token JWT no frontend; há fallback legado de chamada direta controlado por feature flag `VITE_USAR_EDGE_FUNCTION_ECONTADOR`.

---

## 2. Pontos Fortes

1. **Domínios bem delimitados no frontend**  
   As pastas `src/pages/rh/`, `src/pages/ceu/`, `src/pages/vr/`, `src/pages/extras/` e `src/pages/adicionais/` refletem os módulos de negócio, facilitando localização de código.

2. **Tipagem centralizada e customizada do Supabase**  
   `src/types/database.ts` define a interface `Database` usada no `createClient<Database>`, garantindo autocomplete e segurança de tipo nas queries.

3. **Lazy loading de páginas**  
   `src/routes/lazyPages.ts` carrega todas as páginas sob demanda, reduzindo o bundle inicial. O helper `lazyNamed` evita exports default forçados.

4. **Migrations versionadas e disciplinadas**  
   38 arquivos SQL sequenciais, com comentários explicando regras de negócio (ex.: `038_departamentos_sem_nome_curto_inativos.sql`). Isso é raro em projetos de mesmo porte e facilita auditoria.

5. **Atenção a segurança pontual**  
   - Token do e-Contador criptografado no banco.
   - Modo Edge Function disponível para esconder token JWT.
   - `useAuth` não restaura sessão a partir de `localStorage`.
   - Escape HTML em `src/lib/utils.ts` (`escapeHtml`).

6. **Testes configurados**  
   Vitest + jsdom + testing-library configurados; há testes para permissões (`src/lib/permissoes.test.ts`), utils (`src/lib/utils.test.ts`), VR (`src/lib/vr/calculoVR.test.ts`) e importação de ponto (`src/lib/adicionais/importarPonto.test.ts`).

7. **Design system emergente**  
   Componentes shadcn/ui (`button`, `input`, `dialog`, `select`, `tabs` etc.) e componentes de domínio (`CeuPage`, `VrPage`, `VrCard`, `CeuKpiCard`) indicam preocupação com consistência visual.

---

## 3. Débitos Técnicos e Riscos Identificados

### 3.1. `App.tsx` como "God Component" de rotas

`src/App.tsx` possui **573 linhas** e define manualmente **dezenas de `<Route>`**, cada um com um `ProtectedRoute` e lista de perfis. Isso:

- Dificulta a leitura da estrutura de navegação.
- Torna a manutenção de permissões propensa a erros de cópia/cola.
- Atrasa o carregamento do arquivo e aumenta conflitos em merges.
- Não há `ErrorBoundary` global nem layout route padronizado.

### 3.2. Autorização duplicada e dispersa

A lógica de quem pode acessar o quê existe em dois lugares:

- **Em `App.tsx`:** listas literais de `NivelAcesso` em cada rota.
- **Em `src/lib/permissoes.ts`:** funções semânticas como `podeEditarExtra`, `podeGerenciarVR`.

Essas duas fontes não estão vinculadas. Se `lib/permissoes.ts` mudar, as rotas em `App.tsx` não refletem automaticamente. O risco é inconsistência de RBAC.

### 3.3. Hooks de dados são ao mesmo tempo repositório, estado e UI

Exemplos: `useColaboradores.ts` (340 linhas), `useEContador.ts` (435 linhas), `useExtras.ts`. Eles:

- Executam queries SQL diretamente.
- Gerenciam `loading` e estado local.
- Disparam `toast`.
- Contêm lógica de negócio (sincronização de departamentos, matching fuzzy, importação em lote).

Isso viola o princípio de responsabilidade única e dificulta testes unitários.

### 3.4. Ausência de uma camada de API / repositório

A pasta `src/services/` contém apenas `econtadorApi.ts`. Todas as demais chamadas ao Supabase estão espalhadas pelos hooks. Isso significa que:

- Não há cache automático, deduplicação ou invalidação de queries.
- Não há tratamento centralizado de erro de rede/retry.
- Testes precisam mockar o cliente Supabase ou renderizar hooks.
- Mudanças no schema exigem busca global por `supabase.from(...)`.

### 3.5. RLS muito permissivo em algumas tabelas

A migration `037_rbac_granular.sql` aplica a policy:

```sql
CREATE POLICY "Permitir select para autenticados"
  ON public.<tabela> FOR SELECT TO authenticated USING (true);
```

Isso permite que **qualquer usuário autenticado** leia todas as linhas das tabelas de negócio. Em um cenário multi-empresa/multi-tenant, isso é um risco de vazamento de dados (cross-tenant). Recomenda-se restringir por `empresa_id` ou vínculo de usuário, conforme a regra de negócio.

### 3.6. Lógica de negócio no frontend

Exemplos de cálculos/fluxos críticos rodando no cliente:

- Cálculo de VR (`src/lib/vr/calculoVR.ts`).
- Cálculo de adicionais contratuais (`src/lib/adicionais/calculoAdicionais.ts`).
- Importação e matching de departamentos/colaboradores do e-Contador.

Isso é aceitável para protótipos, mas para produção em escala expõe a lógica a manipulação e dificulta auditoria. A fonte da verdade deve ser o banco/edge functions.

### 3.7. Uso de `localStorage` para logs de auditoria local

`src/lib/ceuLogs.ts` armazena logs de exclusão no `localStorage`. Isso:

- Não é compartilhado entre dispositivos/usuários.
- Pode ser apagado pelo navegador.
- Não é auditável no banco.

### 3.8. Ausência de gerenciamento de estado de servidor

Não há uso de **TanStack Query**, **SWR** ou similar. Cada componente/page gerencia seu próprio ciclo de fetch/loading/erro, o que leva a:

- Requisições redundantes.
- Estados desnecessariamente complexos.
- Dificuldade de invalidar cache após mutações.

### 3.9. Testes de cobertura baixa

Apesar da infraestrutura de testes existir, há poucos arquivos `.test.ts`. A maioria dos hooks e páginas não possui testes automatizados.

### 3.10. Páginas placeholder para funcionalidades futuras

`App.tsx` declara rotas para `/escalas`, `/ferias` e `/relatorios` apontando para `PlaceholderPage`. Isso é aceitável, mas indica que o crescimento do sistema precisa de planejamento arquitetural antes da implementação.

### 3.11. Configurações e URLs hardcoded

A URL base do e-Contador (`https://dp.pack.alterdata.com.br/api/v1`) está hardcoded em `src/services/econtadorApi.ts`. Dados sensíveis e endpoints devem vir de variáveis de ambiente.

### 3.12. `services/` subutilizado vs `lib/` sobrecarregado

`lib/` mistura: cliente Supabase, utilitários de formatação, parsers de PDF/Excel, lógica de permissões, recibos e logs. A separação de responsabilidades não é clara.

---

## 4. Sugestões de Melhorias Arquiteturais

### 4.1. Curto prazo (0-2 meses)

1. **Extrair configuração de rotas de `App.tsx`**  
   Criar `src/routes/routeConfig.ts` com um array de objetos:

   ```ts
   export const routes: AppRoute[] = [
     { path: '/rh/ocorrencias', element: OcorrenciasPage, nivelMinimo: ['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria'] },
     ...
   ]
   ```

   Renderizar com um mapa em `App.tsx`. Reduz o arquivo para ~100 linhas.

2. **Criar hook `usePermissao`**  
   Unificar a lógica de `lib/permissoes.ts` com o roteamento. Exemplo:

   ```ts
   const { podeEditarExtra } = usePermissao();
   ```

3. **Mover chamadas Supabase para `src/repositories/` ou `src/services/supabase/`**  
   Criar funções puras como:

   ```ts
   export async function listarColaboradores(filtros: FiltrosColaborador) { ... }
   ```

   Os hooks passam a orquestrar apenas estado e UI.

4. **Adicionar `ErrorBoundary` global**  
   Evitar telas em branco em caso de erro de renderização.

5. **Remover logs de auditoria do `localStorage`**  
   Migrar `ceuLogs.ts` para usar a tabela `log_auditoria` já existente.

6. **Validar variáveis de ambiente no build**  
   Usar Zod para garantir `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` etc.

### 4.2. Médio prazo (3-6 meses)

1. **Adotar TanStack Query (React Query) para estado de servidor**  
   Substituir os hooks de fetch manuais por `useQuery` / `useMutation`. Benefícios:
   - Cache e deduplicação automáticos.
   - Refetch em focus/reconnect.
   - Estados de loading/erro padronizados.
   - Invalidação de cache por `queryKey`.

2. **Refatorar RLS para isolamento multi-tenant**  
   Substituir `USING (true)` por policies baseadas em `empresa_id` / vínculo de usuário, usando funções `SECURITY DEFINER` quando necessário.

3. **Extrair lógica crítica para Edge Functions ou RPCs**  
   Cálculos financeiros (VR, adicionais, extras, futuro módulo de férias) devem ser validados/executados no backend.

4. **Introduzir padrão de feature modules**  
   Agrupar código por domínio:

   ```
   src/features/extras/
   ├── api/
   ├── components/
   ├── hooks/
   ├── types/
   └── utils/
   ```

   Facilita remoção/adição de módulos.

5. **Criar testes para hooks críticos**  
   Priorizar `useAuth`, `useColaboradores`, `useExtras`, `useEContador` e cálculos financeiros.

6. **Adicionar feature flags**  
   Permitir habilitar/desabilitar módulos (ex.: férias) sem alterar código.

### 4.3. Longo prazo (6-12 meses)

1. **Avaliar separação backend-for-frontend (BFF)**  
   Para cálculos complexos, relatórios e integrações externas, um backend dedicado reduz exposição e melhora performance.

2. **Event-driven audit**  
   Substituir inserções manuais de auditoria por triggers no banco ou fila de eventos.

3. **Monorepo ou micro-frontends**  
   Se o número de módulos crescer além de 6-8, avaliar dividir em aplicações independentes (ex.: CEU, VR, RH, Férias).

4. **Documentação de decisões arquiteturais (ADRs)**  
   Criar `docs/adr/` para registrar por que RLS aberto, por que hooks customizados, por que Supabase etc.

---

## 5. Considerações para Escalar com o Novo Módulo de Férias

O módulo de férias deve seguir os mesmos padrões dos módulos existentes, mas aproveitando as lições desta revisão:

### 5.1. Estrutura recomendada

```
src/
├── pages/ferias/
│   ├── FeriasDashboardPage.tsx
│   ├── FeriasSolicitacaoPage.tsx
│   ├── FeriasAprovacaoPage.tsx
│   └── FeriasRelatorioPage.tsx
├── hooks/
│   └── useFerias.ts
├── types/
│   └── ferias.ts
└── lib/ferias/
    ├── calculoFerias.ts
    └── regrasAquisitivo.ts
```

Ou, se adotar feature modules:

```
src/features/ferias/
├── api/feriasRepository.ts
├── components/
├── hooks/useFerias.ts
├── types.ts
├── utils/calculoFerias.ts
└── pages/
```

### 5.2. Reutilização de dados mestres

O módulo de férias deve reaproveitar:

- `useColaboradores` / tabela `colaboradores`.
- `useEmpresas` / tabela `empresas`.
- `useDepartamentos` / tabela `departamentos`.
- Tipos de ausência já existentes em `extras.motivo` (`Férias`, `Folga`, `Atestado`).

### 5.3. Modelo de dados sugerido

Criar migrations para:

- `solicitacoes_ferias` (colaborador_id, periodo_aquisitivo, data_inicio, data_fim, dias, status, usuario_id).
- `periodos_aquisitivos` (colaborador_id, inicio, fim, dias_direito, dias_usados, dias_saldo).
- `aprovacoes_ferias` (solicitacao_id, aprovador_id, nivel, status, observacao).
- `historico_ferias` (auditoria das alterações).

### 5.4. Regras de negócio críticas

- **Cálculo do período aquisitivo** (12 meses + eventuais adiamentos por faltas/afastamentos).
- **Controle de saldo** — evitar solicitações que excedam o direito.
- **Aprovação em múltiplos níveis** — similar a `ocorrencia_aprovacoes`.
- **Conflito com extras/ocorrências** — verificar se o colaborador já possui lançamentos no período.
- **LGPD** — dados de férias são sensíveis; garantir RLS restritivo e auditoria.

### 5.5. Permissões

Adicionar em `src/lib/permissoes.ts`:

```ts
export const podeSolicitarFerias = (p: NivelAcesso) => isAdm(p) || p === 'rh' || isDp(p) || p === 'gestor';
export const podeAprovarFerias = (p: NivelAcesso) => isAdm(p) || p === 'gestor' || p === 'rh';
```

E vincular às rotas via configuração centralizada.

### 5.6. Performance

- Usar **Range Queries** em `data_inicio`/`data_fim`.
- Criar índices em `colaborador_id`, `status`, `periodo_aquisitivo`.
- Calcular saldo preferencialmente em uma **materialized view** ou function no PostgreSQL.

---

## 6. Recomendações de Organização de Código e Padrões

### 6.1. Separe estado de servidor de estado de cliente

- **Servidor:** use TanStack Query.
- **Cliente (UI):** `useState`/`useReducer` local.
- **Global raro:** Zustand ou Context apenas para tema, auth user, LGPD consent.

### 6.2. Adote uma camada de repositório

```ts
// src/repositories/colaboradorRepository.ts
export async function buscarColaboradorPorId(id: string) { ... }
export async function listarColaboradores(filtros: Filtros) { ... }
```

Hooks chamam repositórios; repositórios não sabem de React.

### 6.3. Padronize tratamento de erro

Criar função `handleError` que decida entre `toast.error`, `console.error` e report para Sentry. Não dispare toast dentro de repositórios.

### 6.4. Use barrel exports por domínio

```ts
// src/features/ferias/index.ts
export * from './api';
export * from './hooks';
export * from './types';
```

Facilita imports e define a "API pública" de cada módulo.

### 6.5. Mantenha componentes de página magros

Páginas devem orquestrar hooks e componentes. Lógica de negócio pertence a `lib/` ou `features/*/utils/`.

### 6.6. Documente convenções

Criar `docs/AGENTS.md` ou `docs/PADRÕES.md` com:

- Nomenclatura de arquivos (`PascalCase` para componentes, `camelCase` para hooks/utils).
- Regra de onde colocar novo código.
- Checklist antes de abrir PR (testes, RLS, permissões, auditoria).

### 6.7. Evite crescimento orgânico descontrolado

Antes de criar um novo módulo, responda:

1. Quais tabelas serão criadas?
2. Quais policies RLS serão aplicadas?
3. Quais perfis terão acesso?
4. A lógica crítica ficará no frontend ou no backend?
5. Como será auditado?

### 6.8. RLS como fonte da verdade

A autorização deve ser reforçada no banco. O frontend pode usar `ProtectedRoute` e `lib/permissoes.ts` para UX, mas a segurança real está nas policies.

---

## 7. Conclusão

O CORH é um projeto maduro, com domínios de negócio claros, migrations disciplinados e preocupações de segurança já presentes. Os principais desafios arquiteturais são:

- **Acúmulo de responsabilidade em `App.tsx` e nos hooks de dados.**
- **Falta de uma camada de API/repositório e de gerenciamento de estado de servidor.**
- **RLS ainda muito permissivo para um cenário multi-tenant.**
- **Lógica de negócio financeira concentrada no cliente.**

As melhorias sugeridas, especialmente a extração de rotas, a introdução de uma camada de repositório e o uso de TanStack Query, devem ser priorizadas antes ou junto com o desenvolvimento do módulo de férias, para evitar que o novo módulo amplifique os débitos técnicos atuais.

---

**Próximos passos recomendados:**

1. Criar `src/routes/routeConfig.ts` e reduzir `App.tsx`.
2. Criar `src/repositories/` e mover as funções de Supabase dos hooks.
3. Adotar TanStack Query em um módulo piloto (sugestão: `extras` ou `ferias`).
4. Revisar e restringir policies RLS em produção.
5. Escrever ADRs para as decisões acima.
```

# Revisão de Arquitetura Geral — CORH / RH Plena Unificado

**Data:** 25/06/2026  
**Projeto:** `C:\Projetos\RH-Plena-Unificado`  
**Escopo:** Frontend SPA (React + Vite + Supabase) e camada de dados (migrations).

---

## 1. Visão Geral da Arquitetura Atual

O projeto é uma **SPA React 19** compilada com **Vite**, estilizada com **Tailwind CSS v4** e **shadcn/ui** (componentes baseados em Radix UI), e tipada com **TypeScript 5.8**. A persistência e autenticação são inteiramente delegadas ao **Supabase** (Auth + PostgreSQL + Row Level Security + Storage). A arquitetura pode ser classificada como um **frontend monolítico modular**, com separação por domínio de negócio dentro do diretório `src/pages/` e `src/hooks/`.

### Stack e configurações relevantes

| Camada | Tecnologia |
|---|---|
| Build / HMR | Vite 8 (`vite.config.ts` com alias `@/` para `./src`) |
| Framework UI | React 19 + React Router DOM 7 |
| Estilo | Tailwind CSS v4 via plugin `@tailwindcss/vite` |
| Componentes | shadcn/ui (`src/components/ui/`) + Radix primitives |
| Ícones | `lucide-react` |
| Notificações | `sonner` |
| Dados / Auth | `@supabase/supabase-js` |
| Testes | Vitest 4 + jsdom + `@testing-library/react` |
| Relatórios/PDF | `jspdf`, `jspdf-autotable`, `pdfjs-dist` |
| Planilhas | `@e965/xlsx` |

### Organização de diretórios

```
src/
├── App.tsx                 # Ponto de montagem da aplicação + todas as rotas
├── routes/lazyPages.ts     # Lazy loading centralizado de todas as páginas
├── pages/                  # Páginas organizadas por domínio (rh, ceu, vr, extras, adicionais)
├── hooks/                  # Hooks customizados de dados (useColaboradores, useExtras etc.)
├── lib/                    # Utilitários, parsers, cálculos, cliente Supabase, permissões
├── services/               # Apenas econtadorApi.ts (integração externa)
├── components/             # Componentes compartilhados + componentes por domínio
├── types/                  # Tipos TypeScript (database.ts, adicionais.ts, extras.ts, vr.ts etc.)
└── test/setup.ts           # Configuração de testes
```

### Padrão de acesso a dados

Cada domínio possui um hook em `src/hooks/` que encapsula:

- Estado local (`useState`) para listas, loading e paginação.
- Chamadas diretas ao cliente Supabase (`supabase.from(...)`).
- Toasts de sucesso/erro via `sonner`.
- CRUD básico e, em alguns casos, lógica de negócio (ex.: `useEContador` sincroniza departamentos e importa colaboradores).

A autenticação é tratada por `useAuth`, que sincroniza o objeto `Perfil` (tabela `perfis`) com a sessão do Supabase Auth, sem confiar em `localStorage` para restaurar sessão — uma decisão de segurança correta.

### Segurança e permissões

- **RBAC granular:** 10 perfis/níveis (`admin/adm`, `gestor`, `rh`, `dp1`, `dp2`, `mesa`, `inspetoria`, `financeiro`, `visualizador`).
- **Autorização no frontend:** `ProtectedRoute` recebe `nivelMinimo` e redireciona usuários sem acesso; `src/lib/permissoes.ts` centraliza helpers de permissão por ação.
- **RLS no banco:** 38 migrations versionadas em `supabase/migrations/`, incluindo policies RLS (`037_rbac_granular.sql`, `032_rls_extras_e_recibos.sql` etc.), criptografia do token e-Contador (`030_criptografar_token_econtador.sql`) e consentimento LGPD (`036_consentimento_lgpd.sql`).
- **Integração externa:** e-Contador pode operar via Edge Function (`supabase/functions/econtador`) para não expor o token JWT no frontend; há fallback legado de chamada direta controlado por feature flag `VITE_USAR_EDGE_FUNCTION_ECONTADOR`.

---

## 2. Pontos Fortes

1. **Domínios bem delimitados no frontend**  
   As pastas `src/pages/rh/`, `src/pages/ceu/`, `src/pages/vr/`, `src/pages/extras/` e `src/pages/adicionais/` refletem os módulos de negócio, facilitando localização de código.

2. **Tipagem centralizada e customizada do Supabase**  
   `src/types/database.ts` define a interface `Database` usada no `createClient<Database>`, garantindo autocomplete e segurança de tipo nas queries.

3. **Lazy loading de páginas**  
   `src/routes/lazyPages.ts` carrega todas as páginas sob demanda, reduzindo o bundle inicial. O helper `lazyNamed` evita exports default forçados.

4. **Migrations versionadas e disciplinadas**  
   38 arquivos SQL sequenciais, com comentários explicando regras de negócio (ex.: `038_departamentos_sem_nome_curto_inativos.sql`). Isso é raro em projetos de mesmo porte e facilita auditoria.

5. **Atenção a segurança pontual**  
   - Token do e-Contador criptografado no banco.
   - Modo Edge Function disponível para esconder token JWT.
   - `useAuth` não restaura sessão a partir de `localStorage`.
   - Escape HTML em `src/lib/utils.ts` (`escapeHtml`).

6. **Testes configurados**  
   Vitest + jsdom + testing-library configurados; há testes para permissões (`src/lib/permissoes.test.ts`), utils (`src/lib/utils.test.ts`), VR (`src/lib/vr/calculoVR.test.ts`) e importação de ponto (`src/lib/adicionais/importarPonto.test.ts`).

7. **Design system emergente**  
   Componentes shadcn/ui (`button`, `input`, `dialog`, `select`, `tabs` etc.) e componentes de domínio (`CeuPage`, `VrPage`, `VrCard`, `CeuKpiCard`) indicam preocupação com consistência visual.

---

## 3. Débitos Técnicos e Riscos Identificados

### 3.1. `App.tsx` como "God Component" de rotas

`src/App.tsx` possui **573 linhas** e define manualmente **dezenas de `<Route>`**, cada um com um `ProtectedRoute` e lista de perfis. Isso:

- Dificulta a leitura da estrutura de navegação.
- Torna a manutenção de permissões propensa a erros de cópia/cola.
- Atrasa o carregamento do arquivo e aumenta conflitos em merges.
- Não há `ErrorBoundary` global nem layout route padronizado.

### 3.2. Autorização duplicada e dispersa

A lógica de quem pode acessar o quê existe em dois lugares:

- **Em `App.tsx`:** listas literais de `NivelAcesso` em cada rota.
- **Em `src/lib/permissoes.ts`:** funções semânticas como `podeEditarExtra`, `podeGerenciarVR`.

Essas duas fontes não estão vinculadas. Se `lib/permissoes.ts` mudar, as rotas em `App.tsx` não refletem automaticamente. O risco é inconsistência de RBAC.

### 3.3. Hooks de dados são ao mesmo tempo repositório, estado e UI

Exemplos: `useColaboradores.ts` (340 linhas), `useEContador.ts` (435 linhas), `useExtras.ts`. Eles:

- Executam queries SQL diretamente.
- Gerenciam `loading` e estado local.
- Disparam `toast`.
- Contêm lógica de negócio (sincronização de departamentos, matching fuzzy, importação em lote).

Isso viola o princípio de responsabilidade única e dificulta testes unitários.

### 3.4. Ausência de uma camada de API / repositório

A pasta `src/services/` contém apenas `econtadorApi.ts`. Todas as demais chamadas ao Supabase estão espalhadas pelos hooks. Isso significa que:

- Não há cache automático, deduplicação ou invalidação de queries.
- Não há tratamento centralizado de erro de rede/retry.
- Testes precisam mockar o cliente Supabase ou renderizar hooks.
- Mudanças no schema exigem busca global por `supabase.from(...)`.

### 3.5. RLS muito permissivo em algumas tabelas

A migration `037_rbac_granular.sql` aplica a policy:

```sql
CREATE POLICY "Permitir select para autenticados"
  ON public.<tabela> FOR SELECT TO authenticated USING (true);
```

Isso permite que **qualquer usuário autenticado** leia todas as linhas das tabelas de negócio. Em um cenário multi-empresa/multi-tenant, isso é um risco de vazamento de dados (cross-tenant). Recomenda-se restringir por `empresa_id` ou vínculo de usuário, conforme a regra de negócio.

### 3.6. Lógica de negócio no frontend

Exemplos de cálculos/fluxos críticos rodando no cliente:

- Cálculo de VR (`src/lib/vr/calculoVR.ts`).
- Cálculo de adicionais contratuais (`src/lib/adicionais/calculoAdicionais.ts`).
- Importação e matching de departamentos/colaboradores do e-Contador.

Isso é aceitável para protótipos, mas para produção em escala expõe a lógica a manipulação e dificulta auditoria. A fonte da verdade deve ser o banco/edge functions.

### 3.7. Uso de `localStorage` para logs de auditoria local

`src/lib/ceuLogs.ts` armazena logs de exclusão no `localStorage`. Isso:

- Não é compartilhado entre dispositivos/usuários.
- Pode ser apagado pelo navegador.
- Não é auditável no banco.

### 3.8. Ausência de gerenciamento de estado de servidor

Não há uso de **TanStack Query**, **SWR** ou similar. Cada componente/page gerencia seu próprio ciclo de fetch/loading/erro, o que leva a:

- Requisições redundantes.
- Estados desnecessariamente complexos.
- Dificuldade de invalidar cache após mutações.

### 3.9. Testes de cobertura baixa

Apesar da infraestrutura de testes existir, há poucos arquivos `.test.ts`. A maioria dos hooks e páginas não possui testes automatizados.

### 3.10. Páginas placeholder para funcionalidades futuras

`App.tsx` declara rotas para `/escalas`, `/ferias` e `/relatorios` apontando para `PlaceholderPage`. Isso é aceitável, mas indica que o crescimento do sistema precisa de planejamento arquitetural antes da implementação.

### 3.11. Configurações e URLs hardcoded

A URL base do e-Contador (`https://dp.pack.alterdata.com.br/api/v1`) está hardcoded em `src/services/econtadorApi.ts`. Dados sensíveis e endpoints devem vir de variáveis de ambiente.

### 3.12. `services/` subutilizado vs `lib/` sobrecarregado

`lib/` mistura: cliente Supabase, utilitários de formatação, parsers de PDF/Excel, lógica de permissões, recibos e logs. A separação de responsabilidades não é clara.

---

## 4. Sugestões de Melhorias Arquiteturais

### 4.1. Curto prazo (0-2 meses)

1. **Extrair configuração de rotas de `App.tsx`**  
   Criar `src/routes/routeConfig.ts` com um array de objetos:

   ```ts
   export const routes: AppRoute[] = [
     { path: '/rh/ocorrencias', element: OcorrenciasPage, nivelMinimo: ['admin', 'adm', 'gestor', 'rh', 'dp1', 'dp2', 'mesa', 'inspetoria'] },
     ...
   ]
   ```

   Renderizar com um mapa em `App.tsx`. Reduz o arquivo para ~100 linhas.

2. **Criar hook `usePermissao`**  
   Unificar a lógica de `lib/permissoes.ts` com o roteamento. Exemplo:

   ```ts
   const { podeEditarExtra } = usePermissao();
   ```

3. **Mover chamadas Supabase para `src/repositories/` ou `src/services/supabase/`**  
   Criar funções puras como:

   ```ts
   export async function listarColaboradores(filtros: FiltrosColaborador) { ... }
   ```

   Os hooks passam a orquestrar apenas estado e UI.

4. **Adicionar `ErrorBoundary` global**  
   Evitar telas em branco em caso de erro de renderização.

5. **Remover logs de auditoria do `localStorage`**  
   Migrar `ceuLogs.ts` para usar a tabela `log_auditoria` já existente.

6. **Validar variáveis de ambiente no build**  
   Usar Zod para garantir `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` etc.

### 4.2. Médio prazo (3-6 meses)

1. **Adotar TanStack Query (React Query) para estado de servidor**  
   Substituir os hooks de fetch manuais por `useQuery` / `useMutation`. Benefícios:
   - Cache e deduplicação automáticos.
   - Refetch em focus/reconnect.
   - Estados de loading/erro padronizados.
   - Invalidação de cache por `queryKey`.

2. **Refatorar RLS para isolamento multi-tenant**  
   Substituir `USING (true)` por policies baseadas em `empresa_id` / vínculo de usuário, usando funções `SECURITY DEFINER` quando necessário.

3. **Extrair lógica crítica para Edge Functions ou RPCs**  
   Cálculos financeiros (VR, adicionais, extras, futuro módulo de férias) devem ser validados/executados no backend.

4. **Introduzir padrão de feature modules**  
   Agrupar código por domínio:

   ```
   src/features/extras/
   ├── api/
   ├── components/
   ├── hooks/
   ├── types/
   └── utils/
   ```

   Facilita remoção/adição de módulos.

5. **Criar testes para hooks críticos**  
   Priorizar `useAuth`, `useColaboradores`, `useExtras`, `useEContador` e cálculos financeiros.

6. **Adicionar feature flags**  
   Permitir habilitar/desabilitar módulos (ex.: férias) sem alterar código.

### 4.3. Longo prazo (6-12 meses)

1. **Avaliar separação backend-for-frontend (BFF)**  
   Para cálculos complexos, relatórios e integrações externas, um backend dedicado reduz exposição e melhora performance.

2. **Event-driven audit**  
   Substituir inserções manuais de auditoria por triggers no banco ou fila de eventos.

3. **Monorepo ou micro-frontends**  
   Se o número de módulos crescer além de 6-8, avaliar dividir em aplicações independentes (ex.: CEU, VR, RH, Férias).

4. **Documentação de decisões arquiteturais (ADRs)**  
   Criar `docs/adr/` para registrar por que RLS aberto, por que hooks customizados, por que Supabase etc.

---

## 5. Considerações para Escalar com o Novo Módulo de Férias

O módulo de férias deve seguir os mesmos padrões dos módulos existentes, mas aproveitando as lições desta revisão:

### 5.1. Estrutura recomendada

```
src/
├── pages/ferias/
│   ├── FeriasDashboardPage.tsx
│   ├── FeriasSolicitacaoPage.tsx
│   ├── FeriasAprovacaoPage.tsx
│   └── FeriasRelatorioPage.tsx
├── hooks/
│   └── useFerias.ts
├── types/
│   └── ferias.ts
└── lib/ferias/
    ├── calculoFerias.ts
    └── regrasAquisitivo.ts
```

Ou, se adotar feature modules:

```
src/features/ferias/
├── api/feriasRepository.ts
├── components/
├── hooks/useFerias.ts
├── types.ts
├── utils/calculoFerias.ts
└── pages/
```

### 5.2. Reutilização de dados mestres

O módulo de férias deve reaproveitar:

- `useColaboradores` / tabela `colaboradores`.
- `useEmpresas` / tabela `empresas`.
- `useDepartamentos` / tabela `departamentos`.
- Tipos de ausência já existentes em `extras.motivo` (`Férias`, `Folga`, `Atestado`).

### 5.3. Modelo de dados sugerido

Criar migrations para:

- `solicitacoes_ferias` (colaborador_id, periodo_aquisitivo, data_inicio, data_fim, dias, status, usuario_id).
- `periodos_aquisitivos` (colaborador_id, inicio, fim, dias_direito, dias_usados, dias_saldo).
- `aprovacoes_ferias` (solicitacao_id, aprovador_id, nivel, status, observacao).
- `historico_ferias` (auditoria das alterações).

### 5.4. Regras de negócio críticas

- **Cálculo do período aquisitivo** (12 meses + eventuais adiamentos por faltas/afastamentos).
- **Controle de saldo** — evitar solicitações que excedam o direito.
- **Aprovação em múltiplos níveis** — similar a `ocorrencia_aprovacoes`.
- **Conflito com extras/ocorrências** — verificar se o colaborador já possui lançamentos no período.
- **LGPD** — dados de férias são sensíveis; garantir RLS restritivo e auditoria.

### 5.5. Permissões

Adicionar em `src/lib/permissoes.ts`:

```ts
export const podeSolicitarFerias = (p: NivelAcesso) => isAdm(p) || p === 'rh' || isDp(p) || p === 'gestor';
export const podeAprovarFerias = (p: NivelAcesso) => isAdm(p) || p === 'gestor' || p === 'rh';
```

E vincular às rotas via configuração centralizada.

### 5.6. Performance

- Usar **Range Queries** em `data_inicio`/`data_fim`.
- Criar índices em `colaborador_id`, `status`, `periodo_aquisitivo`.
- Calcular saldo preferencialmente em uma **materialized view** ou function no PostgreSQL.

---

## 6. Recomendações de Organização de Código e Padrões

### 6.1. Separe estado de servidor de estado de cliente

- **Servidor:** use TanStack Query.
- **Cliente (UI):** `useState`/`useReducer` local.
- **Global raro:** Zustand ou Context apenas para tema, auth user, LGPD consent.

### 6.2. Adote uma camada de repositório

```ts
// src/repositories/colaboradorRepository.ts
export async function buscarColaboradorPorId(id: string) { ... }
export async function listarColaboradores(filtros: Filtros) { ... }
```

Hooks chamam repositórios; repositórios não sabem de React.

### 6.3. Padronize tratamento de erro

Criar função `handleError` que decida entre `toast.error`, `console.error` e report para Sentry. Não dispare toast dentro de repositórios.

### 6.4. Use barrel exports por domínio

```ts
// src/features/ferias/index.ts
export * from './api';
export * from './hooks';
export * from './types';
```

Facilita imports e define a "API pública" de cada módulo.

### 6.5. Mantenha componentes de página magros

Páginas devem orquestrar hooks e componentes. Lógica de negócio pertence a `lib/` ou `features/*/utils/`.

### 6.6. Documente convenções

Criar `docs/AGENTS.md` ou `docs/PADRÕES.md` com:

- Nomenclatura de arquivos (`PascalCase` para componentes, `camelCase` para hooks/utils).
- Regra de onde colocar novo código.
- Checklist antes de abrir PR (testes, RLS, permissões, auditoria).

### 6.7. Evite crescimento orgânico descontrolado

Antes de criar um novo módulo, responda:

1. Quais tabelas serão criadas?
2. Quais policies RLS serão aplicadas?
3. Quais perfis terão acesso?
4. A lógica crítica ficará no frontend ou no backend?
5. Como será auditado?

### 6.8. RLS como fonte da verdade

A autorização deve ser reforçada no banco. O frontend pode usar `ProtectedRoute` e `lib/permissoes.ts` para UX, mas a segurança real está nas policies.

---

## 7. Conclusão

O CORH é um projeto maduro, com domínios de negócio claros, migrations disciplinados e preocupações de segurança já presentes. Os principais desafios arquiteturais são:

- **Acúmulo de responsabilidade em `App.tsx` e nos hooks de dados.**
- **Falta de uma camada de API/repositório e de gerenciamento de estado de servidor.**
- **RLS ainda muito permissivo para um cenário multi-tenant.**
- **Lógica de negócio financeira concentrada no cliente.**

As melhorias sugeridas, especialmente a extração de rotas, a introdução de uma camada de repositório e o uso de TanStack Query, devem ser priorizadas antes ou junto com o desenvolvimento do módulo de férias, para evitar que o novo módulo amplifique os débitos técnicos atuais.

---

**Próximos passos recomendados:**

1. Criar `src/routes/routeConfig.ts` e reduzir `App.tsx`.
2. Criar `src/repositories/` e mover as funções de Supabase dos hooks.
3. Adotar TanStack Query em um módulo piloto (sugestão: `extras` ou `ferias`).
4. Revisar e restringir policies RLS em produção.
5. Escrever ADRs para as decisões acima.
```
