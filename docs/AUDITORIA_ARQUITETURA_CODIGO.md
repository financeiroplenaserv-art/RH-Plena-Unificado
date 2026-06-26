# Relatório de Auditoria de Arquitetura e Qualidade de Código

**Projeto:** RH Plena Unificado  
**Repositório:** `c:\Projetos\RH-Plena-Unificado`  
**Data da análise:** 2026-06-25  
**Escopo:** Arquitetura React + TypeScript + Vite + Supabase

---

## Resumo Executivo

O projeto é uma aplicação React 18 + TypeScript + Vite + Supabase que unifica os módulos de RH (ocorrências, colaboradores), e-Contador, CEU (uniformes/EPI), VR (benefícios), Adicionais e Extras. A base está funcional: build e lint passam, há lazy loading de páginas, tipagem razoável e separação inicial por domínio. Entretanto, a arquitetura já apresenta sinais claros de estresse por crescimento rápido: páginas gigantes, componentes de UI replicados por módulo, lógica de dados misturada a toast/console, mock data em produção e ausência total de testes. Sem intervenção, a manutenibilidade vai degradar rapidamente conforme novos módulos forem adicionados.

---

## Nota Geral de Arquitetura/Código

**Nota: 5.5 / 10**

**Pontos fortes:**
- Build e lint estáveis.
- Tipagem presente e `any` praticamente ausente.
- Lazy loading de páginas já implementado.
- Separação inicial por domínio (hooks, páginas, tipos).
- Uso de Tailwind + shadcn/ui como base.

**Pontos fracos dominantes:**
- Páginas e hooks muito grandes e acoplados.
- Design system fragmentado com cópias por módulo.
- Ausência de testes.
- Mock data em produção.
- Supabase espalhado em componentes.
- Tratamento de erro inconsistente.

**Recomendação estratégica:** antes de adicionar novos módulos (Escalas, Férias, Relatórios), invista 2–3 sprints em refatoração estrutural: camada de serviço, componentes compartilhados, testes e quebra de páginas monolíticas. Isso evitará que a dívida técnica cresça exponencialmente.

---

## Achados por Severidade

### Críticos

| # | Achado | Impacto | Onde |
|---|--------|---------|------|
| 1 | **Ausência total de testes automatizados** | Não há cobertura de regressão; refatorações são de alto risco. | `package.json` não tem `test`; zero arquivos `*.test.ts(x)` / `*.spec.ts(x)`; scripts só têm `test:adicionais` que roda script isolado. |
| 2 | **Páginas monolíticas de 400–960 linhas** | Responsabilidade mista (UI + estado + regras + efeitos); difíceis de testar e manter. | `OcorrenciaFormPage.tsx` (962), `OcorrenciaDetailPage.tsx` (828), `CeuRelatoriosPage.tsx` (782), `AdicionaisCalendarioPage.tsx` (768), `CeuEntregaFormPage.tsx` (700), `VrProjetoDetailPage.tsx` (699). |
| 3 | **Componentes de UI replicados por módulo** | Design system fragmentado; alterar cor/estilo exige tocar em N arquivos. | `CeuButton`, `CeuCard`, `CeuInput`, `CeuWrapperCard`, `CeuWrapperButton` (`src/components/ceu/` e `CeuPageWrapper.tsx`); `VrButton`, `VrCard` (`src/components/vr/`); `ExtrasPageWrapper` duplica card/button; `AdicionaisPageWrapper` idêntico ao Extras com outra cor. |
| 4 | **Supabase chamado diretamente em componentes** | Viola a camada de dados; dificulta testes, cache e troca de backend. | `AutocompleteColaborador.tsx` (linhas 39, 65–81, 94–126); `DashboardPage.tsx` (linhas 93–110); `OcorrenciaFormPage.tsx` usa `supabase` direto em vários pontos. |
| 5 | **Mock data e modo demonstração embarcados em produção** | Risco de dados falsos entrarem no bundle de produção; aumenta bundle. | `CeuEntregaFormPage.tsx` linha 23 (`COLABORADORES_MOCK`, `ITENS_MOCK`), 49 (`modoMock`); `src/components/ceu/mockData.ts` (13 KB no bundle); `useAdicionaisContratuais.ts` usa `localStorage` como “banco mock” quando `VITE_MODO_MOCK=true`. |
| 6 | **Nenhuma camada de serviço/repositório padronizada** | Cada hook faz SQL à sua maneira; queries complexas duplicadas. | `useColaboradores.ts`, `useOcorrencias.ts`, `useCEUEntregas.ts`, `useAdicionaisContratuais.ts`, etc., todos chamam `supabase.from(...)` inline. |

### Altos

| # | Achado | Impacto | Onde |
|---|--------|---------|------|
| 7 | **Excesso de type assertions (`as`)** | Quebra a garantia do TypeScript; esconde erros de modelagem. | 488 ocorrências de `as`/`as const` em 84 arquivos. Destaques: `useOcorrenciaFormPage.tsx` (67), `useAdicionaisContratuais.ts` (15), `VrProjetoDetailPage.tsx` (13), `useColaboradores.ts` (14). |
| 8 | **Hooks de domínio misturam UI (toast) e regras de negócio** | Reutilização difícil; testes unitários precisam mockar `sonner`. | Quase todos os hooks (`useExtras.ts`, `useColaboradores.ts`, `useOcorrencias.ts`, `useAdicionaisContratuais.ts`) chamam `toast` dentro das operações. |
| 9 | **Estado local massivo nas páginas** | Muitos `useState` e `useEffect` dificultam rastrear fluxo de dados. | `ExtrasPlantaoPage.tsx` (26 hooks), `CeuMovimentacoesPage.tsx` (26), `AdicionaisCalendarioPage.tsx` (28), `CeuEntregaFormPage.tsx` (27). |
| 10 | **Tratamento de erro inconsistente** | Alguns erros são silenciados, outros logados no console, outros exibem toast. | `DashboardPage.tsx` linha 189: `catch { /* Silencia erros */ }`; `useEContador.ts` usa `console.error`; `useOcorrencias.ts` usa `toast.error`. |
| 11 | **Formulários com listas estáticas gigantes no código** | Dificulta manutenção de catálogos (tipos de ocorrência, motivos extras). | `OcorrenciaFormPage.tsx` linha 41 em diante: `TIPOS_OCORRENCIA` com ~30 itens; `ExtrasFormPage.tsx` linhas 23–27: arrays estáticos de turnos/categorias/motivos. |
| 12 | **Uso de `Record<string, unknown>` para dados de API** | Perde tipagem em campos dinâmicos. | `Colaborador.dados_completos: Record<string, unknown>`; `Ocorrencia.dados_json`; `ProjetoVR.configuracao_json`; uso em `useEContador.ts` linha 263. |

### Médios

| # | Achado | Impacto | Onde |
|---|--------|---------|------|
| 13 | **Páginas não lazy que poderiam ser lazy** | Aumentam o chunk inicial. | `App.tsx` importa diretamente `LoginPage`, `DashboardPage`, `ColaboradoresPage`, `PlaceholderPage`; apenas as demais são lazy. |
| 14 | **Filtro mágico `'todos'` replicado** | Lógica de filtro repetida em várias páginas. | `ColaboradoresPage.tsx`, `OcorrenciasPage.tsx`, `DepartamentosPage.tsx`, `VrProjetoDetailPage.tsx`, `ExtrasLancamentosPage.tsx`, páginas de Adicionais. |
| 15 | **Pacotes pesados no bundle** | jspdf + pdfjs-dist + xlsx somam ~1,3 MB gzippado no build. | Build output: `pdf-DorRZDk9.js` 468 KB, `xlsx-BUdumILT.js` 493 KB, `jspdf.es.min-FxnTYf2X.js` 399 KB. |
| 16 | **Configurações de UI inline (cores hex, fontes)** | Dificulta tema consistente e manutenção. | `ExtrasPageWrapper.tsx` linhas 25, 39, 42, 66, 69, 70, 98–101; `CeuPageWrapper.tsx` similar. |
| 17 | **`useEffect` sem dependências completas** | Pode causar bugs sutis de sincronização. | `DashboardPage.tsx` linha 197: `useEffect(..., [])` chama `carregarKpis` mas usa `setCarregando` interno (ok), porém lógica toda encapsulada dificulta testes. |
| 18 | **Funções utilitárias misturadas com domínio** | `utils.ts` cresce com máscaras, slugify, escapeHtml — tudo junto. | `src/lib/utils.ts` (115 linhas) — sem separar em `formatters.ts`, `validators.ts`, `strings.ts`. |
| 19 | **Nomenclatura de rotas não padronizada** | Algumas em inglês, outras em português; módulos têm prefixos diferentes. | `/rh/ocorrencias`, `/ceu/itens`, `/vr/projetos`, `/adicionais/contratos`, `/extras/lancamentos`. |

### Baixos

| # | Achado | Impacto | Onde |
|---|--------|---------|------|
| 20 | **Placeholders para módulos futuros** | Escalas, Férias e Relatórios são só tela de “em construção”. | `App.tsx` linhas 511–513 (`/escalas`, `/ferias`, `/relatorios`). |
| 21 | **`console.log/error` espalhados** | Polui console de produção. | 23 ocorrências em 12 arquivos (`useEContador.ts`, `useColaboradores.ts`, `useAuth.ts`, etc.). |
| 22 | **Funções pequenas repetidas (`Paginacao`, `ResultadoPaginado`)** | Interfaces duplicadas em vários hooks. | `useColaboradores.ts`, `useOcorrencias.ts`, `useCEUEntregas.ts` definem suas próprias `Paginacao`/`ResultadoPaginado`. |
| 23 | **Versão `0.0.0` no package.json** | Indicador de falta de versionamento semântico. | `package.json` linha 4. |

---

## Arquivos e Trechos Específicos

### `src/App.tsx` (525 linhas)
- Roteamento monolítico; todos os `<ProtectedRoute>` estão inline.
- Importa 54 páginas; lazy funciona, mas `DashboardPage`, `LoginPage`, `ColaboradoresPage` e `PlaceholderPage` entram no chunk inicial.
- Linhas 511–513: rotas para módulos ainda não implementados.

### `src/routes/lazyPages.ts`
- Boa ideia, mas `lazyNamed` faz `as ComponentType<unknown>`, perdendo tipagem de props.

### `src/hooks/useColaboradores.ts` (298 linhas)
- Lógica de paginação misturada com filtro por departamento (`departamentoNomeCurto`).
- Count duplicado: a query de contagem reaplica filtros manualmente (linhas 119–131) — risco de divergência.
- `upsertPorMatricula` faz lógica de merge complexa e usa `throw error` em vez de retorno controlado.

### `src/hooks/useOcorrencias.ts` (251 linhas)
- Busca por texto faz subquery em `colaboradores` e depois concatena IDs em string para `or` (linhas 62–75) — concatenação manual de `.or` é arriscada.

### `src/hooks/useAdicionaisContratuais.ts` (570 linhas)
- Alternância entre Supabase e `localStorage` via `VITE_MODO_MOCK` gera dois caminhos de execução para cada operação CRUD.
- Mock usa `Math.random()` para gerar IDs (linha 76–78).

### `src/pages/rh/OcorrenciaFormPage.tsx` (962 linhas)
- ~200 linhas só de catálogo `TIPOS_OCORRENCIA` embutido.
- Múltiplos `useState` para campos do formulário.
- Supabase chamado diretamente.

### `src/components/AutocompleteColaborador.tsx` (285 linhas)
- Componente genérico que deveria estar em `components/ui/` ou `components/forms/`.
- Faz query direta no Supabase (linhas 94–101) em vez de usar `useColaboradores`.
- `handleSelecionarNovo` cria um `Colaborador` “vazio” com `id: ''` (linhas 154–188) — perigoso para consumers.

### `src/pages/DashboardPage.tsx` (431 linhas)
- “God page” de KPIs: 12 chamadas paralelas ao Supabase, 12 estados separados.
- Erros silenciados (linha 189).
- Idealmente deveria ser alimentada por uma função RPC/View do Supabase.

### `src/components/ceu/mockData.ts` (13 KB)
- Entra no bundle mesmo que `modoMock` esteja desligado.

---

## Recomendações Práticas de Refatoração

### 1. Introduzir camada de repositório/serviço
```ts
// src/services/colaboradoresService.ts
export async function listarColaboradores(filtros: Filtros): Promise<Resultado<Colaborador[]>> { ... }
```
- Toda chamada ao Supabase passa por aqui.
- Facilita mock em testes e substituição futura de backend.

### 2. Extrair componentes de UI reutilizáveis
- Consolidar `CeuButton`, `VrButton`, `ExtrasButton`, `AdicionaisButton` em `components/ui/button.tsx` com novas variantes (`ceu`, `vr`, etc.) via `cva`.
- Fazer o mesmo para `Card`, `Input`, `PageWrapper`, `PageTabs`.
- Criar `components/layout/PageTabs.tsx` e `components/layout/PageWrapper.tsx` genéricos, aceitando cor/tema por prop.

### 3. Quebrar páginas gigantes
- Separar em:
  - `containers/` ou `features/<modulo>/containers/` para lógica/orquestração.
  - `features/<modulo>/components/` para sub-componentes puros.
  - `features/<modulo>/hooks/` para hooks locais.
- Meta: nenhuma página > 250 linhas.

### 4. Remover mock data do bundle de produção
- Usar `import.meta.env.DEV` + dynamic import para `mockData.ts`.
- Ou mover mocks para `src/mocks/` e configurar Vite para não incluir em produção.

### 5. Centralizar catálogos estáticos
- Mover `TIPOS_OCORRENCIA`, turnos, motivos extras para `src/constants/` ou para tabelas do Supabase (`tipos_ocorrencia`, `motivos_extras`).

### 6. Padronizar tratamento de erros
- Criar utilitário `handleError(error, { silent?: boolean, fallback?: string })`.
- Proibir `console.error` em produção via ESLint.
- Nunca silenciar erros no `catch` sem logging estruturado.

### 7. Adicionar testes
- Prioridade: hooks de domínio (`useColaboradores`, `useExtras`, `useOcorrencias`) com MSW/mock do Supabase.
- Depois: componentes críticos (`AutocompleteColaborador`, `ProtectedRoute`).
- Configurar Vitest + React Testing Library (já usam Vite).

### 8. Melhorar tipagem
- Reduzir `as Type` substituindo por:
  - Tipagem correta das respostas do Supabase (`Database` types).
  - Funções de normalização com retorno tipado.
  - Zod para validar dados externos (e-Contador, importações).
- Evitar `Record<string, unknown>`; usar tipos específicos ou `unknown` + validação.

### 9. Otimizar bundle
- Lazy-carregar `DashboardPage`, `ColaboradoresPage`, `PlaceholderPage`.
- Dynamic import de `jspdf` e `pdfjs-dist` somente nas páginas que usam.
- Revisar se `@e965/xlsx` é necessário no browser ou pode ser movido para worker/Edge Function.

### 10. Criar módulos por feature
```
src/features/
  colaboradores/
  ocorrencias/
  ceu/
  vr/
  adicionais/
  extras/
```
Cada um com `api/`, `components/`, `hooks/`, `types/`, `utils/`, `constants/`.

### 11. Migrar Dashboard para RPC/View
- Criar uma função SQL ou view no Supabase que retorne todos os KPIs de uma vez, reduzindo round-trips de 12 para 1.

---

*Documento gerado em: 2026-06-25*
