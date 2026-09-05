# AGENTS.md — RH Plena Unificado (CORH)

> Arquivo de orientação para agentes de código. Leia este documento antes de modificar qualquer arquivo do projeto. O projeto usa **português** nos comentários, documentos, interfaces e mensagens de commit.

---

## 1. Visão geral

**RH Plena Unificado** (também chamado **CORH — Controle Operacional e de RH**) é uma plataforma web institucional para gestão de recursos humanos e operação. Ele unifica os módulos:

- **Core** — empresas, departamentos/postos, colaboradores, perfis de acesso, LGPD, auditoria.
- **Ocorrências** — registros disciplinares, anexos, testemunhas, defesas, aprovação, modelos e alertas.
- **CEU** — controle de entrega de Crachá, Equipamento e Uniforme (EPI), com recibos.
- **VR** — Vale Refeição: cálculo de elegibilidade a partir de PDF de pontos e Excel de escalas.
- **Adicionais** — contratos, vínculos, calendário de jornada e importação de ponto.
- **Extras** — lançamentos, categorias, recibos de pagamento e assinatura digital.
- **e-Contador** — importação de empresas e funcionários da API Alterdata e-Contador.
- **Escalas** — locais de trabalho, mapeamento FLIT e importação de escala.
- **Férias** — períodos por colaborador (gozo/agendado/previsto), importação da planilha Flit, painel CLT e notificações.
- **PerformanceLab (BI)** — dashboard de checklists, visitas dos inspetores e eventos, alimentado 1x ao dia da API PerformanceLab pela Edge Function `sync-performancelab` (tabelas `bi_*`).

O backend (banco, autenticação, storage, edge functions) roda no **Supabase**. O frontend é uma SPA/PWA estática gerada pelo **Vite**.

---

## 2. Stack e arquitetura de runtime

| Camada | Tecnologia |
|--------|------------|
| Framework UI | React 19 + TypeScript 5.8 |
| Build tool | Vite 8 (com plugin React) |
| Roteamento | React Router DOM 7 |
| Estilos | Tailwind CSS 4 + `tailwindcss-animate` |
| Componentes base | shadcn/ui (Radix UI) — `src/components/ui/` |
| Design System | Componentes próprios em `src/components/corh/` |
| Toasts | Sonner |
| Ícones | Lucide React |
| Backend | Supabase (Auth + PostgreSQL + RLS + Storage + Edge Functions) |
| Cliente Supabase | `@supabase/supabase-js` |
| PDF/Excel | `jspdf`, `jspdf-autotable`, `pdfjs-dist`, `@e965/xlsx` |
| Gráficos | `chart.js` 4 (módulo PerformanceLab; wrapper em `src/components/bi/Grafico.tsx`) |
| Testes | Vitest 4 + jsdom + `@testing-library/react` + `@testing-library/jest-dom` |
| Scripts utilitários | `tsx` com `tsconfig.scripts.json` |
| PWA | `vite-plugin-pwa` (modo `injectManifest`, service worker em `src/sw.ts`) |

**Arquitetura de runtime:**

- O frontend é uma SPA. O `BrowserRouter` do React Router DOM gerencia rotas no cliente.
- O backend fica **sempre no Supabase**; não existe servidor Node próprio. O frontend chama diretamente o Supabase e, quando necessário, as **Edge Functions** (Deno).
- A autenticação é feita pelo Supabase Auth (email/senha). O perfil e as permissões ficam em tabelas PostgreSQL protegidas por RLS.
- O banco de dados não deve ser migrado para um VPS sem decisão técnica explícita; o deploy atual prevê servir apenas os arquivos estáticos de `dist/` em um VPS/nginx.

---

## 3. Estrutura de diretórios

```
src/
├── main.tsx              # Entrypoint React + BrowserRouter
├── App.tsx               # Layout, rotas principais e lazy loading
├── sw.ts                 # Service Worker do PWA (Workbox)
├── index.css             # Tokens de cor, tema e utilitários Tailwind
├── components/           # Componentes React
│   ├── ui/               # Componentes shadcn/ui base (button, dialog, etc.)
│   ├── corh/             # Design System do CORH (PageHeader, Filters, Button, etc.)
│   ├── layout/           # Sidebar, Header, ProtectedRoute, ModuleShell
│   ├── ceu/              # Componentes específicos do CEU
│   ├── ocorrencias/      # Componentes específicos de ocorrências
│   ├── extras/           # Componentes específicos de extras
│   └── *.tsx             # Componentes compartilhados (Autocomplete, Paginacao, etc.)
├── pages/                # Páginas das rotas
│   ├── rh/               # Módulo Ocorrências e Colaboradores
│   ├── ceu/              # Módulo CEU
│   ├── vr/               # Módulo VR
│   ├── adicionais/       # Módulo Adicionais
│   ├── extras/           # Módulo Extras
│   ├── escalas/          # Módulo Escalas
│   ├── ferias/           # Módulo Férias (visão geral, importação Flit, notificações)
│   └── *.tsx             # Páginas transversais (Dashboard, Login, Permissoes, etc.)
├── routes/
│   └── lazyPages.ts      # Lazy loading de todas as páginas
├── hooks/                # Hooks de domínio (useAuth, useColaboradores, useOcorrencias, etc.)
├── lib/                  # Lógica pura, utilitários e parsers
│   ├── utils.ts          # Formatação CPF/CNPJ/moeda/telefone, funções auxiliares
│   ├── permissoes.ts     # Mapa de permissões e cache
│   ├── supabase.ts       # Cliente Supabase tipado
│   ├── auth.ts           # Wrappers de login/logout/signup do Supabase Auth
│   ├── storage.ts        # Upload/download de arquivos no Supabase Storage
│   ├── importar.ts       # Lógica de importação CSV/Excel genérica
│   ├── pdf.ts            # Geração de PDFs
│   ├── pdfPosicional.ts  # Parser posicional de PDF (espelho de ponto Flit)
│   ├── empresas.ts       # Resolução da empresa do colaborador (recibos/PDFs)
│   ├── adicionais/       # Cálculos e importação de ponto para adicionais
│   ├── ceu/              # Emissão unificada de recibos do CEU
│   ├── ceuRecibos.ts     # Lógica de recibos do CEU
│   ├── escalas/          # Importação de escala FLIT e inferência de local
│   ├── ferias/           # Parser da planilha de férias do Flit e cálculo CLT
│   ├── ocorrencias/      # Tipos, classificação e importação de ponto (espelho Flit) de ocorrências
│   └── vr/               # Cálculo de VR, parsers PDF/Excel, comprovantes e storage
├── services/
│   └── econtadorApi.ts   # Cliente para a Edge Function econtador
├── types/                # Tipos TypeScript
│   ├── database.ts       # Tipos das tabelas Supabase + type Database
│   ├── econtador.ts      # Tipos da API e-Contador
│   ├── adicionais.ts     # Tipos do módulo Adicionais
│   ├── extras.ts         # Tipos do módulo Extras
│   └── vr.ts             # Tipos do módulo VR
└── test/
    └── setup.ts          # Setup do Vitest (polyfill DOMMatrix para pdfjs-dist)

supabase/
├── migrations/             # 103 migrations SQL (numeradas 001 a 103)
└── functions/              # Edge Functions Deno: `econtador` (integração e-Contador) e `suporte` (e-mail de ajuda via Resend)

scripts/                  # Scripts utilitários e SQL de manutenção (migração de dados, análises, etc.)
public/                   # Assets estáticos (ícones, logo, OG image, manifest)
docs/                     # Documentação extensa do projeto (deploy, design system, regras de negócio, auditorias)
```

**Observação sobre subdiretórios `AGENTS.md`:** existe um arquivo `src/pages/ceu/AGENTS.md` com regras específicas do módulo CEU (ex.: datas de recibo no 1º dia do mês). Ao alterar arquivos dentro desses subdiretórios, verifique se há um `AGENTS.md` local.

---

## 4. Configuração e variáveis de ambiente

Crie um arquivo `.env` na raiz (não commitado). Veja `.env.example`:

```env
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
# VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>  # futuro; fallback para ANON_KEY

# Apenas para scripts/edge functions (nunca no frontend)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Modo mock local (usado em desenvolvimento; em produção deve ser false ou omitido)
VITE_MODO_MOCK=false
```

**Nunca commite `.env` ou chaves de API.** As chaves do Supabase devem ser rotacionadas imediatamente se forem vazadas.

### Configuração do TypeScript

- `tsconfig.json` referencia `tsconfig.app.json` e `tsconfig.node.json`.
- `tsconfig.app.json` define `baseUrl: "."` e path alias `"@/*": ["./src/*"]`.
- `tsconfig.scripts.json` estende `tsconfig.app.json` e inclui a pasta `scripts/`.

---

## 5. Comandos de build, teste e lint

```bash
# Instalar dependências
npm ci

# Desenvolvimento local (porta 5173)
npm run dev

# Build de produção (gera dist/)
npm run build

# Preview da build (porta 4173)
npm run preview

# Lint com ESLint
npm run lint

# Testes (executa sem paralelismo de arquivo — padrão)
npm test

# Testes em paralelo (pode causar flutuação em testes que compartilham estado)
npm run test:parallel

# Testes em modo watch
npm run test:watch

# Script de testes adicionais (via tsx)
npm run test:adicionais

# Regenera public/pdf.worker.min.mjs com os polyfills ES2025 (roda também no
# postinstall — necessário após atualizar o pdfjs-dist; ver scripts/corrigir-pdf-worker.cjs)
npm run pdf:worker
```

### Estado atual dos checks

- `npm run lint` — **passa**.
- `npm run build` — **passa** (gera `dist/` com PWA e service worker).
- `npm test` — **249 testes passam, 1 pulado por ambiente**:
  - `src/lib/rls.test.ts` executa um validador Python para verificar conflitos de RLS nas migrations. Quando o Python não está instalado no ambiente, o teste é **pulado automaticamente** (`it.skipIf`, desde 30/07/2026) — antes ele falhava com erro 9009. Com Python no PATH, ele roda normalmente.
  - Todos os demais testes de lógica (utils, permissões, departamentos, VR, escalas, adicionais, hooks, componentes, smoke) passam.

---

## 6. Convenções de código e estilo

### Linguagem e nomenclatura

- Código, comentários e commits em **português** (exceto nomes de bibliotecas e termos técnicos).
- Componentes React: `PascalCase.tsx`.
- Hooks customizados: `useDominio.ts` (ex.: `useColaboradores.ts`).
- Funções utilitárias puras: `camelCase.ts`.
- Tipos/interfaces: `PascalCase`.
- Tabelas do banco: `snake_case`.

### Path alias

Use `@/` para importar de `src/`:

```tsx
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Perfil } from '@/types/database'
```

### Estrutura de páginas e rotas

- As páginas são importadas via `lazyNamed` em `src/routes/lazyPages.ts`, garantindo code splitting por módulo.
- O `App.tsx` monta as `<Route>` dentro de `<Suspense fallback={<PageLoading />}>`.
- Rotas protegidas usam `<ProtectedRoute user={user} permissao={{ recurso: 'rota', acao: 'nome_da_rota' }}>`.
- O `ProtectedRoute` verifica permissões dinâmicas carregadas do banco (`permissoes_perfil`) ou o mapa padrão em `src/lib/permissoes.ts`.

### Design System

- Consulte `docs/DESIGN_SYSTEM.md` e a especificação em `docs/CORH — Design System (para Kimi Code).md`.
- Tokens de cor em `src/index.css` (Tailwind v4 com `@theme inline`).
- Paleta principal: azul `#0F6CBD` (Microsoft/Edge). Sidebar: `#0C1730`.
- Degradês permitidos em apenas 3 lugares: painel do login, cartão de boas-vindas do dashboard e botões primários (`.bg-brand-gradient-soft`).
- Use componentes de `src/components/corh/` para manter consistência: `PageHeader`, `Filters`, `DataTable`, `StatusBadge`, `EmptyState`, `ConfirmDialog`, `ModuleTabs`, `Button`.
- Botões de filtro devem se chamar **"Aplicar"**, nunca "Filtrar" ou "Buscar".
- Tela com filtro persistido (`useFiltroPersistente`) deve indicar filtros ativos com `FiltrosAtivosBadge` (`src/components/corh/`) — inclusive com o painel fechado; sem isso o filtro restaurado fica invisível e parece "vazar" de outra tela.
- Tabelas: `min-w-[720px]`, cabeçalho small-caps, hover `bg-accent/40`, números/datas `tabular-nums`.

### Regras de ESLint

- Usa `@eslint/js`, `typescript-eslint` recomendado, `eslint-plugin-react-hooks` e `eslint-plugin-react-refresh`.
- A regra experimental `react-hooks/set-state-in-effect` está **desabilitada** para evitar falsos positivos ao carregar dados assíncronos.

---

## 7. Testes

### Estrutura de testes

- Configuração central em `vitest.config.ts`.
- Setup em `src/test/setup.ts` (inclui polyfill de `DOMMatrix` para `pdfjs-dist`).
- Padrão de arquivo: `*.test.{ts,tsx}`.
- Localização: testes de lógica ficam ao lado do arquivo testado (`src/lib/utils.test.ts`); testes de hooks e componentes ficam em `src/hooks/` e `src/components/layout/`.
- Testes de smoke para páginas CEU em `src/pages/ceu/CeuPages.smoke.test.tsx`.

### Executando testes específicos

```bash
# Testes de um arquivo
npx vitest run src/lib/utils.test.ts

# Testes de um módulo
npx vitest run src/lib/vr
npx vitest run src/lib/escalas

# Watch mode
npx vitest
```

### Testes de RLS

- `src/lib/rls.test.ts` depende do Python para rodar um validador sobre as migrations. Se Python não estiver disponível, o teste falha com erro 9009. **Antes de tratar isso como bug de RLS, verifique se o Python está instalado e acessível no PATH.**
- Para verificar manualmente as policies de RLS, analise as migrations `supabase/migrations/058_consolidar_rls_seguro.sql` e `supabase/migrations/059_corrigir_rls_conflitantes.sql`.

---

## 8. Banco de dados e Supabase

### Migrations

- Existem **103 migrations** em `supabase/migrations/` (numeradas `001_*` a `103_*`).
- Aplique migrations via Supabase CLI ou SQL Editor.
- Antes de qualquer alteração estrutural no banco, **faça backup** (veja `docs/AGENTES_RH_PLENA.md`, regra de ouro).
- Migrations recentes e críticas para segurança:
  - `058_consolidar_rls_seguro.sql`
  - `059_corrigir_rls_conflitantes.sql`
  - `062_select_permissoes_perfil_autenticados.sql`
  - `063_rls_empresas_departamentos_por_perfil.sql`
  - `064_seguranca_perfis_calendario_ceu.sql`
  - `065_rls_escalas_ceu_alertas_modelos.sql`
  - `066_auditoria_tabelas_operacionais.sql`
  - `067_rpcs_transacionais_vr_recibos.sql`
  - `068_consentimento_lgpd_rpc.sql`
  - `069_acesso_mobile_falta_inspetoria.sql`
  - `070_ferias_periodos.sql`
  - `071_ferias_notificacoes.sql`
  - `072_ocorrencia_assinatura.sql`
  - `073_ceu_recibo_sequencial_situacao.sql`
  - `074_extras_falta_sem_extra_reforco.sql`
  - `075_rpc_extra_plantao_gera_extra_reforco.sql`
  - `076_fix_consentimento_lgpd_rpc.sql`
  - `077_rpc_extra_plantao_duplicidade_nao_se_aplica.sql`
  - `078_remove_tabelas_backup_2026_07_16.sql` (remove 27 tabelas de backup manuais sem RLS — alerta crítico do Security Advisor)
  - `079_indice_unico_matricula_colaboradores.sql` (índice único em `colaboradores.matricula` — aplicada via `db query --linked` em 29/07/2026 após renumeração dos duplicados com prefixo `ANT-`)
  - `080_calendario_adicionais_delete_editor.sql` (DELETE em `calendario_adicionais` passa a aceitar `is_admin() OR is_editor()` — a importação de ponto falhava para perfis editores como `mesa`, pois ela exclui os dias do período antes de reinserir; remove também as policies legadas de DELETE das migrations 019/064)
  - `081_recibos_extras_perfil_financeiro.sql` (perfil `financeiro` passa a gerenciar recibos de extras — quem assina é o colaborador, mas no dispositivo do operador logado; nova função `pode_gerenciar_recibos_extras()`, policies INSERT/UPDATE de `recibos_extras` e RPCs `assinar_recibo_extras`/`cancelar_recibo_extras` alinhadas ao `PERMISSOES_PADRAO`, que já autorizava financeiro na UI mas era bloqueado no banco)
  - `082_departamentos_financeiro_extras_excluir_mesa.sql` (dois alinhamentos RLS↔UI: (1) `financeiro` pode INSERT/UPDATE/DELETE em `departamentos` — o UPDATE bloqueado por RLS falhava **silenciosamente** (0 linhas, sem erro) e a tela mostrava toast de sucesso sem gravar; remove policies legadas redundantes; (2) DELETE em `extras` passa a aceitar `mesa` além de admin — nova ação `extras.excluir` no `PERMISSOES_PADRAO` e na tela Permissões)
  - `083_vr_arquivos_dp1.sql` (`pode_ver_vr_arquivos()` passa a incluir `dp1` — a tela Permissões concedeu `vr.gerenciar` ao dp1 via `permissoes_perfil`, mas o upload no bucket `vr-arquivos` era bloqueado: o toast de erro aparecia após o processamento do ponto e o cálculo funcionava mesmo assim, pois os dados já estavam em memória)
  - `084_fix_recibos_extras_cast_uuid_jsonb.sql` (corrige "cannot cast type uuid[] to jsonb" ao assinar/cancelar recibo de extras: `recibos_extras.extras_ids` é `uuid[]` desde a migration 026, mas as RPCs `assinar_recibo_extras`/`cancelar_recibo_extras` (067, recriadas na 081) faziam `extras_ids::jsonb` — cast inexistente no PostgreSQL; o bug ficou oculto atrás do erro de permissão que a 081 corrigiu. Trocado por `unnest(r.extras_ids)`; demais lógicas intactas. Aplicada via `db query --linked` em 30/07/2026)
  - `085_colaboradores_data_demissao.sql` (versiona a coluna `colaboradores.data_demissao` (date), que existia em produção fora das migrations — drift. O app já a usa de ponta a ponta: formulário (demissão preenchida força status Inativo), detalhes, importação Excel ("Data Demissão") e e-Contador (atributo `demissao` da Alterdata → `data_demissao` + status Inativo). Idempotente, no-op em produção. Aplicada via `db query --linked` em 30/07/2026)
  - `086_extras_empresa_trigger_backfill.sql` (todos os extras estavam com `empresa_id` NULL — os 3 caminhos de lançamento (form web, plantão web, RPC mobile) gravavam NULL, então o filtro "Empresa" da tela Recibos só funcionava em "Todas". Trigger `trg_extras_preencher_empresa` (BEFORE INSERT OR UPDATE) deriva a empresa do substituto (ou do ausente, sem substituto) em qualquer caminho de escrita; backfill dos 67 históricos (52 Plena EA, 12 Plena Tech, 3 sem vínculo permanecem NULL). Aplicada via `db query --linked` em 30/07/2026)
  - `087_rls_alinhamento_divergencias_permissoes.sql` (auditoria das 34 divergências `permissoes_perfil` × `PERMISSOES_PADRAO` — relatório em `docs/AUDITORIA_DIVERGENCIAS_PERMISSOES_2026-07-30.md`, script `scripts/auditar-divergencias-permissoes.ts`. Alinha o backend às concessões da tela: `pode_ver_extras()` +dp2/inspetoria, `pode_ver_adicionais()` +dp1, DELETE `departamentos` +dp1/dp2, RPC `cancelar_recibo_extras` +dp2/mesa, INSERT/UPDATE `ocorrencias` +inspetoria. E falhas que já estavam no padrão: INSERT/UPDATE `extras` +inspetoria, `categorias_extras` INSERT/UPDATE +financeiro/inspetoria e DELETE +mesa/financeiro. As 9 restrições (tela mais restrita) são intencionais — sem alteração. Aplicada via `db query --linked` em 30/07/2026)
  - `088_contratos_adicionais_delete_por_perfil.sql` (DELETE de `contratos_adicionais` era só `is_admin()`, mas a UI já mostrava a lixeira para `editar_contrato` (gestor, dp2, mesa, financeiro) — falha silenciosa com toast "Contrato removido". Decisão da gestão: os 4 perfis podem excluir. Hooks `removerContrato`/`removerVinculo` passaram a checar linhas afetadas (`.select('id')`) para nunca fingir sucesso; `vinculos_adicionais` DELETE segue só admin — decisão pendente. Aplicada via `db query --linked` em 30/07/2026)
  - `089_vinculos_delete_e_recibos_inspetoria.sql` (decisões da gestão em 30/07/2026: (1) mesa/dp1/dp2 com os mesmos poderes do admin em `vinculos_adicionais` — DELETE incluído (SELECT/INSERT/UPDATE já cobriam); `editar_vinculo` no mapa padrão ganhou dp1 (dinâmico já concedia); (2) inspetoria pode gerar recibo de extras para o colaborador assinar e marcar como pago — `pode_gerenciar_recibos_extras()` +inspetoria e linhas dinâmicas `extras.gerenciar_recibo`/`extras.marcar_pago` viradas para true; UPDATE de extras já liberado na 087. Aplicada via `db query --linked` em 30/07/2026)
  - `090_proximo_numero_recibo_permissao.sql` (a RPC `proximo_numero_recibo()` (CEU, migration 073) era SECURITY DEFINER sem nenhuma guarda — qualquer autenticado podia "queimar" números da `ceu_recibo_seq` via PostgREST. Passa a exigir `is_editor()`, a mesma função das policies de INSERT/UPDATE de `entregas` (037), para não bloquear nenhum emissor legítimo; o frontend já tem fallback para número aleatório em caso de erro. Aplicada via `db query --linked` em 30/07/2026)
  - `091_recibos_extras_delete_admin_financeiro.sql` (decisão da gestão em 30/07/2026: admin e financeiro podem EXCLUIR recibos de extras — não havia policy de DELETE, então nem admin excluía via API. Condição espelha a RPC `cancelar_recibo_extras` (081). Cancelamento formal segue via RPC; DELETE é limpeza administrativa. Aplicada via `db query --linked` em 30/07/2026)
  - `092_entregas_matricula_backfill.sql` (decisão da gestão em 30/07/2026: cria `entregas.matricula` — o formulário CEU sempre enviou o campo, mas a tabela não tinha a coluna e o PostgREST descartava o valor em silêncio. Backfill das 5.542 entregas a partir de `colaboradores.matricula`. Aplicada via `db query --linked` em 30/07/2026)
  - `093_consolidacao_policies_limpezas.sql` (bloco 3 da varredura de 30/07/2026: (1) remove a policy legada `write_admin_rh` de `departamentos` — INSERT/UPDATE de rh já eram cobertos por `is_editor()` e o DELETE foi incorporado à policy "Permitir delete de departamentos" (+rh), comportamento idêntico; `select_autenticado` foi MANTIDA de propósito (removê-la tiraria o SELECT do visualizador); (2) remove a linha dinâmica redundante `dp1/editar_vinculo` de `permissoes_perfil` (o padrão já concede desde a 089); (3) comentário na RPC `registrar_extra_plantao` documentando a exceção de duplicidade. Aplicada via `db query --linked` em 30/07/2026)
  - `094_ponto_espelho_arquivos.sql` (persiste o espelho de ponto (PDF do Flit) para reutilização entre operadores: bucket privado `ponto-espelhos` (só PDF, 50 MB) + tabela `ponto_espelho_arquivos` (metadados: nome, path, tamanho, `enviado_por`). SELECT/INSERT com `is_editor()` (o PDF contém CPFs — visualizador fica fora), DELETE só `is_admin()`. A tela Adicionais → Importar Ponto salva o PDF ao processar e mostra o card "Arquivos já enviados" com "Usar este arquivo". Aplicada via `db query --linked` em 31/07/2026)
  - `095_colaboradores_tamanho_luva.sql` (cria `colaboradores.tamanho_luva` — na mesma sessão foi **substituída pela 096**: as medidas saíram do cadastro; a coluna permanece mas não é lida pelo app. Aplicada via `db query --linked` em 31/07/2026)
  - `096_ceu_tamanhos.sql` (decisão da gestão em 31/07/2026: tamanhos de uniforme/EPI (camisa, calça, calçado, luva) são dado operacional do CEU, não do cadastro geral — nova tabela `ceu_tamanhos` (1:1 com colaborador) com backfill das colunas legadas `colaboradores.tamanho_*` (estas ficam sem uso). RLS: SELECT/INSERT/UPDATE com `is_editor()`, DELETE só `is_admin()`. Nova aba CEU → Tamanhos (`/ceu/tamanhos`); o Lançamento Rápido lê as medidas dela (linha 📏 e coluna "Tam.", apenas referência visual — tamanho não vai para a entrega nem para o recibo; selo fica vermelho em negrito quando o tamanho do item escolhido diverge do cadastro, sem bloquear o fluxo). Backfill do histórico de entregas em 31/07/2026 (`scripts/preencher-tamanhos-ceu.mjs`, revisão em `dados-locais/revisao_tamanhos_ceu.xlsx`): vale a entrega mais recente por categoria; o nome original do item importado está em `entregas.observacao` ("Item: ..."). Resultado: 162 de 314 ativos com alguma medida (calçado 126, luva 153 — calça/camisa quase sem tamanho no histórico, decisão da gestão ignorar). Aplicada via `db query --linked` em 31/07/2026)
  - `097_feriados.sql` (decisão da gestão em 31/07/2026: o flag `adicionais.feriado` do contrato existia sem efeito — não havia datas nem cálculo. Tabela `feriados` (data única + nome) com seed dos 10 feriados nacionais de 2026; municipais/datas de contrato entram pela nova aba **Adicionais → Feriados** (`/adicionais/feriados`). RLS: SELECT autenticado, INSERT/UPDATE `is_editor()`, DELETE admin. **Regra de contagem:** o adicional conta APENAS para vínculos cujo contrato tem o flag E cuja escala prevê trabalho no feriado (substituto/cobertura não recebe — não estava previamente escalado). Relatório de Adicionais ganha a coluna "Feriado" (tela, CSV, Excel e filtro); lógica pura testada em `src/lib/adicionais/calculoAdicionais.ts` (`escaladoParaTrabalhar`, `contarDiasFeriadoEscalado`). Aplicada via `db query --linked` em 31/07/2026)
  - `098_financeiro_ocorrencias.sql` (decisão da gestão em 01/08/2026: financeiro acessa o quadro do colaborador, **insere** ocorrências e **vê o CPF completo**. `pode_ver_ocorrencias()` +financeiro (SELECT em `ocorrencias` e tabelas filhas), INSERT de `ocorrencias` +financeiro (UPDATE/DELETE não), linhas dinâmicas `rota.ocorrencias`, `menu.rh`, `ocorrencia.criar`, `ocorrencia.ver_detalhes` e `colaborador.ver_cpf_completo` = true; `PERMISSOES_PADRAO` espelhado (nova ação `colaborador.ver_cpf_completo`: gestor/rh/dp1/dp2/financeiro — listagem e ficha usam essa ação; mesa/inspetoria/visualizador seguem com CPF mascarado). O detalhe do colaborador já abria para ele (rota + SELECT de colaboradores existiam) — a seção de ocorrências é que zerava em silêncio. Na UI, o botão "Nova Ocorrência" da ficha passou de `ocorrencia.editar` para `ocorrencia.criar`. Limitação conhecida: `reset_permissoes_perfil` (054) tem lista fixa — "Restaurar padrão" do financeiro remove as concessões. Aplicada via `db query --linked` em 01/08/2026)
  - `099_extras_excluir_inspetoria.sql` (decisão da gestão em 04/08/2026: inspetoria pode excluir extra lançado errado — ex.: lançou e o extra não aconteceu. A concessão já estava na tela Permissões (linha dinâmica `inspetoria/extras/excluir` = true), mas a policy de DELETE de `extras` (082) só aceitava admin/mesa — o inspetor via a lixeira e levava erro de permissão. DELETE passa a aceitar `inspetoria`; `PERMISSOES_PADRAO` espelhado (`extras.excluir`: mesa + inspetoria) e teste adicionado em `permissoes.test.ts`. Aplicada via `db query --linked` em 04/08/2026)
  - `100_escala_arquivos.sql` (espelha a 094 para o módulo Escalas: persiste o Excel de marcações do Flit para reutilização entre operadores — bucket privado `escala-arquivos` (xlsx/xls, 50 MB) + tabela `escala_arquivos` (metadados). RLS: SELECT/INSERT com `is_editor()`, DELETE só `is_admin()`. A tela Escalas → Importar salva o Excel ao importar e mostra o card "Arquivos já enviados" com "Usar este arquivo", mesmo padrão do Adicionais → Importar Ponto. Aplicada via `db query --linked` em 06/08/2026)
  - `102_bi_performancelab.sql` (módulo **PerformanceLab (BI)**: tabelas `bi_locais`, `bi_checklists`, `bi_checklist_qas`, `bi_coletas`, `bi_eventos`, `bi_eventos_analises` alimentadas pela Edge Function `sync-performancelab` (service_role; sem policies de escrita para autenticados). RLS de leitura via nova função `pode_ver_bi_performancelab()` — admin/adm/gestor/inspetoria/mesa (decisão da gestão, 19/08/2026). Seeds `menu.bi`/`rota.bi` em `permissoes_perfil` (true: gestor/inspetoria/mesa; false: rh/dp1/dp2/financeiro/visualizador). Aplicada via `db query --linked` em 19/08/2026; agendamento do sync em `docs/APLICAR_MIGRATION_102.md`)
  - `103_bi_sync_log_e_limpeza.sql` (BI: tabela `bi_sync_log` — um registro por execução do sync (sucesso ou erro), lido pela página para o selo "Sincronizado em ..." e o alerta amarelo quando a última execução falhou ou o último sucesso tem mais de 26h (`statusSync` em `src/lib/bi/agregacoes.ts`); função `bi_limpar_dados_antigos()` (SECURITY DEFINER, só service_role) chamada pela Edge Function ao fim do sync — retém 90 dias (o sync cobre 35). Na mesma sessão a function foi corrigida: a API do PerformanceLab devolve horário de Brasília sem fuso e o `dt()` gravava como UTC (tudo 3h adiantado — confirmado pelos turnos reais dos inspetores, 06–17h e 14–23h); agora grava `-03:00` e o upsert corrigiu a janela de 35 dias retroativamente. `diaDe()` passou a usar o dia civil local (recortar o ISO pegava o dia UTC). Aplicada via `db query --linked` em 20/08/2026; detalhes em `docs/APLICAR_MIGRATION_103.md`)
  - `104_reset_permissoes_bi.sql` (a função `reset_permissoes_perfil` (054) tem listas fixas e não conhecia `menu.bi`/`rota.bi` (semente da 102): "Restaurar padrão" na tela Permissões apagava as linhas e a aba PerformanceLab sumia do menu. Recria a função idêntica à 054 incluindo `menu.bi`/`rota.bi` em todos os blocos — true para gestor/mesa/inspetoria, false para visualizador/rh/dp1/dp2/financeiro (mesmo escopo da 102). Aplicada via `db query --linked` em 24/08/2026)
  - `105_calendario_substituto_sem_adicional.sql` (decisão da gestão em 27/08/2026: coluna `calendario_adicionais.substituto_sem_adicional` (boolean, default false) — substituição de controle interno: o substituto cobre o posto mas não recebe o adicional nem aparece no relatório (ex.: pago via extra por fora); os dias saem do titular e não são pagos a ninguém. Backup prévio em `dados-locais/backup_calendario_adicionais_105_2026-08-27.json` (2.714 linhas). Aplicada via `db query --linked` em 27/08/2026)
  - `106_perf_rls_log_auditoria.sql` (28/08/2026: policy de SELECT de `log_auditoria` passa a usar `(select is_admin()) or (select is_editor())` — o qual direto avaliava as funções SECURITY DEFINER por linha (~4s em 150 mil linhas) e, somado ao count exato, estourava o timeout do PostgREST na página Auditoria. Com InitPlan, ~170ms. Aplicada via `db query --linked` em 28/08/2026)
  - `107_log_auditoria_indices_busca.sql` (28/08/2026: índices GIN trigram em `log_auditoria(tabela/operacao/registro_id)` + btree em `usuario_id` — a busca ILIKE '%termo%' não usava índice e o ORDER BY + LIMIT varria a tabela (15s+). Aplicada via `db query --linked` em 28/08/2026)
  - `108_rpc_buscar_log_auditoria.sql` (28/08/2026: a policy RLS não-leakproof barra o planner de usar os índices GIN sob RLS (barreira de segurança; LEAKPROOF exige superuser, indisponível no Supabase). Solução definitiva: a listagem da Auditoria passou para a RPC SECURITY DEFINER `buscar_log_auditoria` (dono ignora RLS; autorização verificada no corpo com is_admin/is_editor) — busca caiu de 15-20s para ~12ms. `useAuditoria` usa a RPC; a policy da 106 fica como defesa em profundidade. Aplicada via `db query --linked` em 28/08/2026)

### Edge Function `econtador`

- Local: `supabase/functions/econtador/index.ts`.
- Integra com a API Alterdata e-Contador (`dp.pack.alterdata.com.br/api/v1`).
- O token JWT é **criptografado com AES-256-GCM** na Edge Function e armazenado cifrado no banco; nunca transita no frontend.
- Requer a secret `ENCRYPTION_KEY` no dashboard do Supabase.
- Permissão: apenas `admin`, `adm`, `dp1` e `dp2`.
- Deploy:
  ```bash
  supabase functions deploy econtador --project-ref jmdjdogskvybsdjtmpmb
  ```

### Edge Function `suporte`

- Local: `supabase/functions/suporte/index.ts`.
- Envia e-mail de ajuda/suporte (botão de bóia no header, `SuporteDialog`) via **Resend**; o endereço de destino fica oculto no backend. Aceita até 5 anexos (imagem ou PDF, ~5 MB cada) enviados em base64 no corpo da requisição.
- Requer a secret `RESEND_API_KEY` (`supabase secrets set RESEND_API_KEY=...`). Passo a passo em `docs/CONFIGURAR_FUNCAO_SUPORTE.md`.
- Deploy:
  ```bash
  supabase functions deploy suporte --project-ref jmdjdogskvybsdjtmpmb
  ```

### Edge Function `sync-performancelab`

- Local: `supabase/functions/sync-performancelab/index.ts`.
- Sincroniza a API pública do PerformanceLab (checklists, visitas dos inspetores e eventos) para as tabelas `bi_*` — janela de 35 dias, só locais do grupo PLENA. Alimenta a aba **PerformanceLab** (`/bi`, grupo Operacional).
- **Job de máquina**: exige `Authorization: Bearer <SYNC_CRON_KEY>` (chave aleatória dedicada — o projeto usa as novas API keys `sb_secret_`/`sb_publishable`, então a guarda não usa a service role; verificação de JWT do gateway desativada só nesta function). Agendada 5x ao dia via pg_cron (desde 04/09/2026): `sync-performancelab-diario` 03h00 BRT (`0 6 * * *` UTC; criado em 20/08 como 06h30, movido em 03/09), `sync-performancelab-06h` (`0 9 * * *`), `sync-performancelab-07h30` (`30 10 * * *`), `sync-performancelab-meio-dia` 09h30 BRT (`30 12 * * *`) e `sync-performancelab-15h` (`0 18 * * *`) — passo a passo em `docs/APLICAR_MIGRATION_102.md`. **A varredura matinal existe porque a API `pwbi` do PerformanceLab não é tempo real**: o dia anterior só aparece na API em algum momento da manhã, em horário variável (em 04/09/2026, às 03h00 BRT o sync rodou com sucesso mas o dia 03/09 ainda não existia na API; às 09h05 já havia 15 visitas do dia anterior). As tentativas entre 03h e 09h30 garantem que o CORH pega os dados logo que o PL publica (decisão da gestão: usuário remoto 5h à frente precisa dos dados cedo); a das 15h cobre atualizações intraday. O sync é idempotente (upsert + reconciliação) — não remover execuções, rodar 5x/dia é seguro e barato.
- Requer os secrets `PLAB_LOGIN`, `PLAB_SENHA` e `PLAB_TOKEN` (valores com a Elaine; nunca no código) e `SYNC_CRON_KEY`.
- **A API do PerformanceLab responde 404 com corpo `{"status":false,"message":"Não foram encontrados ..."}` quando a consulta não retorna linhas** — isso NÃO é erro: o `getPlab` trata esse 404 como lista vazia (correção de 24/08/2026, quando a janela de 35 dias ficou sem checklists e o sync quebrou dois dias seguidos). Um 404 com outro corpo continua sendo erro.
- **A sincronização do PerformanceLab espelha os últimos 90 dias**: além de inserir/atualizar, a Edge Function remove das tabelas `bi_*` os registros da janela que não são mais retornados pelo PL, incluindo respostas de checklists e análises de eventos. O filtro padrão da tela continua em 5 dias, mas permite consultar os 90 dias retidos.
- **Só importa checklists ATIVOS (decisão da gestão, 03/09/2026)**: a API marca com o campo numérico `ativo` (1 = ativo, 0 = inativo — o toggle "Status" da tela do PL). Os inativos são removidos do espelho `bi_checklists` explicitamente por id (antes da reconciliação — os nunca iniciados têm `data_inicio` NULL e o filtro de data não os alcançaria); os QAs órfãos saem no `bi_limpar_dados_antigos()`. Registro sem o campo é considerado ativo (fail-open). A chamada com corpo `{"debug": true}` devolve os campos e a distribuição de `ativo` na resposta.
- Deploy: **o CLI está bloqueado nesta máquina (Device Guard)** — usar `powershell scripts/lib/implantar-edge-function.ps1 -Slug sync-performancelab -Arquivo supabase/functions/sync-performancelab/index.ts` (deploy pela Management API, já sai com `verify_jwt: false`). Se o CLI voltar a funcionar: `supabase functions deploy sync-performancelab --no-verify-jwt --project-ref jmdjdogskvybsdjtmpmb` (**sempre com `--no-verify-jwt`**, senão o gateway rejeita a chave do cron).

### Storage

- Buckets principais: `ocorrencia-anexos`, `vr-arquivos`, `ponto-espelhos` (PDF do Flit — migration 094), `escala-arquivos` (Excel do Flit — migration 100).
- Políticas de RLS definidas nas migrations `010` a `011` e `058`/`059`.

---

## 9. Segurança e permissões

### Autenticação e autorização

- Login via Supabase Auth (`email`/`password`).
- O hook `useAuth` carrega o perfil e as permissões no boot. **O perfil nunca é inicializado a partir do `localStorage`** para evitar bypass de autenticação.
- Novos usuários são criados automaticamente com nível `visualizador` (menor privilégio). Não existe criação automática de admin.
- A tabela `perfis` define `nivel_acesso` (`admin`, `adm`, `gestor`, `rh`, `dp1`, `dp2`, `mesa`, `inspetoria`, `financeiro`, `visualizador`).
- Permissões granulares ficam em `permissoes_perfil` (recurso, ação, permitido). A tela `PermissoesPage` permite editar essas permissões.
- Quando não há linha explícita em `permissoes_perfil`, o sistema usa o mapa padrão em `src/lib/permissoes.ts` (`PERMISSOES_PADRAO`).

### Row Level Security (RLS)

- Todas as tabelas de negócio têm RLS habilitado.
- As migrations `058` e `059` consolidam as policies; verifique-as antes de adicionar novas.
- Nunca crie policies abertas (`using (true)` sem restrição) em tabelas de negócio.
- A tabela `configuracoes` armazena o token e-Contador cifrado; o acesso é restrito a perfis autorizados via RLS.

### Dados sensíveis e LGPD

- Dados pessoais (CPF, RG, dados de ocorrências, anexos, recibos) devem ser tratados conforme LGPD.
- O sistema exige consentimento LGPD no primeiro login (tela `ConsentimentoLGPDPage`).
- Mascaramento de CPF: use `mascararCPF()` em `src/lib/utils.ts` para exibição parcial.
- Anexos de ocorrências (vídeos, áudios) devem permanecer no bucket `ocorrencia-anexos` com RLS apropriado.
- Não implemente certificado digital próprio; a assinatura digital simples (canvas/base64) é apenas para registro interno. Para valor jurídico pleno, use Youk ou ferramenta externa.

### Variáveis e chaves

- **Nunca commite `.env`**, `SUPABASE_SERVICE_ROLE_KEY` ou tokens de API.
- `VITE_*` são expostas no frontend por natureza; use apenas `VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_URL` no frontend.
- A `SUPABASE_SERVICE_ROLE_KEY` é usada apenas em scripts e Edge Functions.

---

## 10. Deploy

- Veja o roteiro completo em `docs/DEPLOY.md`.
- **PWA — ciclo de atualização do service worker (02/09/2026)**: `src/sw.ts` usa `skipWaiting()` + `clientsClaim()` (workbox-core) e `src/main.tsx` ouve `controllerchange` para recarregar a aba **uma vez** quando o SW novo assume (guarda `recarregando`); no `load`, chama `reg.update()` e repete a cada 60 min. Sem o trecho do `main.tsx`, o `registerSW.js` do vite-plugin-pwa apenas registra o SW e quem mantém a aba aberta fica preso no build antigo após o deploy. **Não remova nenhum dos dois lados** — trabalham em par.
- O banco de dados continua no **Supabase**; o VPS serve apenas o frontend estático.
- Build de produção: `npm ci && npm run build` → gera `dist/`.
- Servir `dist/` com nginx/caddy, configurando fallback SPA para `index.html`.
- Headers de segurança recomendados:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - CSP ajustada conforme o ambiente.
- Edge Functions: deploy via `supabase functions deploy <nome>` (`econtador`, `suporte`).
- Migrations: aplicar **manualmente** (SQL Editor ou `npx supabase db query --linked`). **Nunca usar `supabase db push`** — as migrations foram aplicadas manualmente e não constam no histórico remoto; o push tentaria reaplicar tudo. Nota: o CLI falha ao parsear o `.env` local — renomear temporariamente (`mv .env .env.bak && <comando>; mv .env.bak .env`). **Desde 03/09/2026 o executável do Supabase CLI (`supabase.exe`) é bloqueado nesta máquina pelo Device Guard/Smart App Control do Windows** (binário sem editor confirmado) — fallback: `scripts/lib/executar-sql-management-api.ps1 -Query "..."`, que lê o token do CLI no Gerenciador de Credenciais do Windows e executa SQL pela Management API (`POST /v1/projects/<ref>/database/query`).
- **Netlify: cada deploy de produção custa 15 créditos** (plano Personal = 1.000/mês). Regra de ouro: **1–2 deploys por dia de trabalho, agrupando mudanças**. Deploy preview (sem `--prod`) é grátis.
- **⚠️ Netlify — site certo (armadilha dos dois sites):** a conta tem DOIS sites — produção é **`plena-corh`** (id `2a90aecb-278e-4472-b7ff-b07dc521ce25`); **NUNCA** deployar em `sweet-nasturtium-fa7dc4` (id `f0b43221-5d2d-4493-bb96-4897d797311f`). O `.netlify/state.json` já está linkado no `plena-corh` — se um deploy cair no site errado, confira o state.json. Comando: `npx netlify deploy --prod --dir=dist` (ou com `--site 2a90aecb-278e-4472-b7ff-b07dc521ce25` explícito). **Após CADA deploy, verificar que produção serve o bundle novo** (erro de 03/08/2026: dois deploys perdidos no site errado, 30 créditos):
  ```bash
  curl -s https://plena-corh.netlify.app/ | grep -o 'assets/index-[^"]*\.js' | head -1
  grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1   # os dois hashes devem ser IGUAIS
  ```
- Backup: antes de deploy/migrations, faça backup do banco (plano Free não tem backup automático; usar `scripts/backup_supabase_free.sql` no SQL Editor).

---

## 11. Regras de negócio importantes

Consulte `docs/REGRAS_NEGOCIO.md` para detalhes. Destaques:

- **Adicionais / insalubridade e periculosidade** (regra da gestão, 01/08/2026): titular (qualquer escala) recebe **30 − faltas − dias de férias/afastado transferidos ao substituto** (férias sem substituto não transferem). Transferidos: escala normal = dias com substituto; **12×36 = dias com substituto + folga pareada** de cada dia de escala coberto (trabalhado+folga). **Substituto:** insalubridade = dias transferidos + coberturas de falta/folga; periculosidade = **apenas** dias de férias/afastado transferidos (falta não gera). Afastado segue a regra de férias. Detalhes em `docs/REGRAS_NEGOCIO.md`; lógica em `src/lib/adicionais/calculoAdicionais.ts` (`adicionalTitular30`, `contarDiasTransferidos`). Não altere sem validação de negócio.
- **Adicionais — substituição "sem adicional" (controle interno, decisão da gestão, 27/08/2026)**: ao definir o substituto no Calendário (dia único ou em lote), o checkbox "Não gerar adicional (controle interno)" grava `substituto_sem_adicional = true` (migration 105): o substituto cobre o posto (some o alerta de pendência), mas **não recebe o adicional nem aparece no relatório final** (ex.: pago via extra por fora). Os dias cobertos **saem do titular normalmente** e **não são pagos a ninguém** — se perdem para ambos. O flag só é definido na criação (para mudar, remover e recriar a substituição). Helper `substituicaoGeraAdicional` em `src/lib/adicionais/calculoAdicionais.ts`, com testes.
- **Adicionais — alerta "precisa de substituto" só em dia de escala (28/08/2026, caso Alcemir)**: férias/afastado que caem em **folga** da escala (ex.: o descanso do 12×36 dentro das férias) **não exigem substituto** — o alerta só dispara em dia de escala sem cobertura (falta e "folga com substituição" sempre exigem). Helper `diaExigeSubstituto` em `src/lib/adicionais/calculoAdicionais.ts`, com testes.
- **e-Contador / Importação Alterdata**: apenas perfis `adm`, `dp1`, `dp2`.
- **e-Contador — inativo com matrícula em uso não é erro (decisão da gestão, 12/08/2026)**: o e-Contador devolve demitidos antigos cujas matrículas foram reutilizadas por outros colaboradores; como o índice `colaboradores_matricula_unique` é global (migration 079), o INSERT deles falhava com 23505 e sujava o histórico de importação. Regra: erro 23505 de matrícula em funcionário **Inativo/demitido** é ignorado em silêncio (só `console.info`); em quem está **Ativo** continua erro. Lógica em `src/lib/econtador.ts` (`deveIgnorarErroImportacao`), com testes. Em 12/08/2026 os 4 registros `ANT-` conflitantes (demitidos 2015–2018) foram excluídos do banco a pedido da gestão (backup em `dados-locais/backup_exclusao_ant_econtador_2026-08-12.json`); 6 entregas e 1 férias que a importação legada tinha ligado por engano à ROSANE (ANT-000016) foram religadas à Alessandra (dona atual da matrícula 000016). Também foi excluído o duplicado vazio da Alessandra (matrícula "16", sem empresa): 4 dias de `locais_trabalho_diario` sem sobreposição foram religados ao cadastro oficial dela e os 18 sobrepostos descartados (backup em `dados-locais/backup_alessandra_dup_locais_2026-08-12.json`). **Detalhes dos erros no histórico (12/08/2026):** a coluna "Erros" do Histórico de importações virou expansível (clique no número) e mostra `detalhes_erros` (nome + erro) de cada linha; o helper `extrairMensagemErro` (`src/lib/econtador.ts`) extrai a mensagem legível de PostgrestError (objeto simples, **não** é `instanceof Error`) e do formato legado (string com JSON serializado) — erros novos são gravados já como mensagem limpa. **Histórico compartilhado (decisão da gestão, 12/08/2026 — migration 101):** o histórico de importações era por usuário (RLS `auth.uid() = usuario_id`) e a operação importa de várias contas (adm/dp1), gerando confusão; a policy de SELECT passou a usar `pode_importar_econtador()` (admin/adm/dp1/dp2, mesmos perfis da Edge Function) e a tela mostra a coluna "Importado por". Na mesma sessão foram excluídas do histórico as 7 linhas antigas com erro (as 4 demitidas + Alessandra, todas já resolvidas — backup em `dados-locais/backup_historico_erros_econtador_2026-08-12.json`).
- **Extras**: visualização `adm, mesa, financeiro, dp1`; edição por `is_editor()`; exclusão por `adm`, `mesa` e `inspetoria` (lançamento errado — migrations 082 e 099).
- **Ocorrências**: visualização restrita; exclusão apenas `adm`.
- **Ocorrências — documentos para ativar (decisão da gestão, 06/08/2026)**: ocorrência Pendente com anexo obrigatório (`exigeAnexo`) em geral exige 2 anexos para ativar — **comprobatório** + **documento assinado**. Exceção: os tipos nascidos de atestado médico (`Falta Justificada (atestado)`, `Licença Médica (até 15 dias)`, `Licença Médica (acima 15 dias — INSS)`) exigem **apenas o comprobatório** — o documento de assinatura não é obrigatório. Lógica em `src/lib/ocorrencias/tiposOcorrencia.ts` (`TIPOS_SEM_ASSINATURA_OBRIGATORIA`, `exigeDocumentoAssinado`), aplicada em `useOcorrenciaDetalhe`, `DetailHeader`, `StatusBanner` e `AnexosTab`, com testes.
- **Recibos de Extras**: ficam no sistema (`recibos_extras`), não são enviados para Youk.
- **Assinatura digital**: simples (canvas/base64), sem valor jurídico pleno; valor jurídico via Youk.
- **CEU**: recibos de entrega podem ser datados no **1º dia do mês** por prática operacional. Não altere para "hoje" automaticamente.
- **CEU — CA no recibo (regra permanente, 04/08/2026)**: o recibo mostra o CA do **snapshot da entrega** (`snapshot_item.ca`, foto do item na data da entrega), nunca o do cadastro atual do item — o fabricante pode trocar o CA ao longo do tempo e recibo emitido é imutável. O cadastro do item pode ser atualizado livremente (vale para entregas futuras); o `item.ca` só serve de fallback para snapshots antigos sem CA. Prioridade implementada em `src/lib/ceu/emissaoRecibos.ts` e `relatorios.utils.ts` (`caItem`), travada por teste em `src/lib/ceu/emissaoRecibos.test.ts`. Em 04/08/2026 foi feita a emissão retroativa de todos os recibos pendentes (5.494), após correção de 129 snapshots com o CA histórico do PDF do sistema legado (backup em `dados-locais/backup_ca_recibos_2026-08-04.json`).
- **CEU — situação padrão da entrega (decisão da gestão, 04/08/2026)**: novas entregas nascem com situação **"Troca"** (a maioria é troca); "Novo" é escolhido manualmente, só para admissão. Vale para Nova Entrega e Lançamento Rápido — este passou a gravar o status também em `entregas.situacao` (antes ia só para `observacao` e o recibo saía sempre "Novo"). O histórico foi reclassificado em 04/08/2026: para cada colaborador, as entregas da **primeira data** ficaram "Novo" (kit de admissão) e as demais "Troca" (996 Novo / 4.819 Troca; backup em `dados-locais/backup_situacao_entregas_2026-08-04.json`).
- **CEU — CPF no recibo (regra do programa de assinatura, 04/08/2026)**: o CPF deve sair SEMPRE no formato `000.000.000-00` nos recibos. CPFs gravados sem o zero à esquerda (importação de planilha) chegavam com 10 dígitos e saíam sem máscara, misturando formatos no mesmo lote — o programa de assinatura agrupava as páginas por causa disso. O `formatarCPF` de `src/lib/ceuRecibos.ts` normaliza (só dígitos + `padStart(11,'0')` + máscara); regra travada em `src/lib/ceuRecibos.test.ts`.
- **CEU — importação de entregas em lote (05/09/2026)**: a aba CEU → Importar ganhou o tipo "Entregas (EPI/Uniforme)" — sobe CSV/Excel com colunas `colaborador;quantidade;item;tamanho`, escolhe data (padrão 1º do mês) e situação (padrão Troca), mostra prévia linha a linha com matching automático de colaborador (ignora parênteses, aceita nome truncado) e de item (conversões fixas do histórico: máscara → respirador com válvula, óculos → incolor, nitrílica 8→M/9→G, "extra G"→EG, PVC ≠ bota, bota ≠ botina), desmarca duplicadas já existentes na data e inativos/afastados, e grava em lote via `criarLote` SEM emitir recibo. Lógica pura em `src/lib/ceu/importarEntregas.ts`, com testes.
- **CEU — recibo sempre em 1 página A4 (04/08/2026)**: recibo com muitos itens estourava a página (EPI a partir de ~8 itens com CA) e o programa de assinatura juntava a página de continuação com a do recibo seguinte. Os templates de `src/lib/ceuRecibos.ts` aplicam compactação automática por altura estimada (`cssCompactacao`): redução de fontes/espaçamentos, nível ultra e `zoom` calculado como margem de segurança. Verificação de regressão: `scripts/testar-paginas-recibo.ts` + `scripts/converter-medir-recibos.ts` (impressão headless do Chrome, mede páginas por recibo).
- **Escalas — inferência de local lê o turno ANTES do departamento (decisão da gestão, 06/08/2026)**: ordem em `src/lib/escalas/inferirLocalTrabalho.ts` = **dispositivo fixo → perímetro → nome do horário (turno) → departamento** (double check final). Motivo: faltistas têm departamento fixo/genérico no Flit ("PLENA EA FACILITIES" etc.), mas trabalham em postos diferentes a cada dia — só o turno registra o posto real. Em empate de `prioridade`, o valor mapeado **mais longo vence** (específico nunca perde para genérico). O match é "contém" sobre texto normalizado (minúsculas, sem acentos; **traços/pontos preservados** — "CBO -" discrimina Niterói de "CBO MACAÉ"). Nunca mapear valor genérico demais ("CBO" casaria com os dois postos). Turnos de função ("Faltista ASG", "Inspetor Diurno") não são lugar — ficam para confirmação manual por desenho. Histórico: o parâmetro `turno` existia desde a criação do módulo (f3667b4) mas nunca era lido — a intenção original era esta; implementado e travado por testes em 07/08/2026 (commit `b632d8c`, handoff em `docs/HANDOFF_07-08-2026.md`).
- **Importação de ponto unificada**: um único upload do espelho Flit (relatório **"CORH - Adicionais e Ocorrências"**) em **Adicionais → Importar Ponto** (`/adicionais/importar-ponto`) alimenta os dois módulos; matching por **CPF**. A importação **não cria vínculos automaticamente** — dias só vão para `calendario_adicionais` de quem já tem vínculo cobrindo a data (colaborador com 2+ vínculos grava em todos); quem não tem vínculo recebe só as ocorrências. **Reimportar reseta o período ao estado do espelho** (decisão da gestão, 01/08/2026): lançamentos manuais e substitutos do período são apagados de propósito — após reimportar, refazer o substituto pelo Calendário ("Definir substituto" em lote). **`listarCalendario` pagina em lotes de 1.000** (27/08/2026): o PostgREST corta em 1.000 linhas por padrão e o período de um mês já passa de 1.700 — sem paginação, vínculos além do corte apareciam em "fallback" (sem dados) na tela e no relatório, parecendo que a importação gravou só um vínculo (bug do Deleon). Nunca remover a paginação.
- **Extras — duplicidade**: lançamento com "Gera extra = Sim" + ausente "Não se aplica" **não checa duplicidade** de cliente/data (permite equipe extra no mesmo serviço). Com ausente informado ou "Não — falta (controle interno)", a checagem continua.
- **Extras — "Gera extra?" simplificado (decisão da gestão, 06/08/2026)**: os botões são apenas **Sim** e **Não** (sem "falta/controle interno" no rótulo). O **Não apenas exclui o registro do pagamento ao colaborador** (balanço/recibos) — não força mais a categoria "Faltista" (Faltista virou categoria comum, selecionável manualmente). Como não há pagamento, clicar em Não **zera e TRAVA o campo Valor** e o submit **grava sempre `valor = 0`** — registro sem pagamento nunca exibe valor na listagem. **R$ 0,00 é permitido** em "Valor acordado" com Sim (a validação de valor > 0 caiu). **"Extra faturado" é independente do Sim/Não** (correção da gestão, 06/08/2026): faturado é a **cobrança do cliente**, não o pagamento ao colaborador — um faltista que já está na folha pode não receber pelo serviço (Não) e mesmo assim ser faturado ao cliente; o campo fica sempre visível e editável, e o submit nunca o altera. Checkboxes renomeados para **"Não tem colaborador ausente"** e **"Não tem colaborador substituto"** nas 3 telas de lançamento.
- **Extras — substituto "SEM NOME" (06/08/2026)**: quando há falta e ninguém substituiu, o lançamento deve marcar a opção **"Não tem colaborador substituto"** no campo Substituto — grava `substituto_nome = 'SEM NOME'` (constante `SUBSTITUTO_SEM_NOME` em `src/types/extras.ts`) com `substituto_id` null, para a falta ficar anotada nos relatórios em vez de o campo sair em branco. Disponível nas 3 telas de lançamento (Novo Extra, Registro de Plantão e Falta Mobile — nesta, opção no seletor de substituto). O grupo "SEM NOME" **não gera recibo de pagamento** (filtrado em `ExtrasRecibosPage`, como "Não informado" — não há quem assinar).
- **Extras — motivos do dropdown (02/09/2026)**: a lista `MotivoExtra` (`src/types/extras.ts`) e os arrays `MOTIVOS` das 3 telas de lançamento (`ExtrasFormPage`, `ExtrasPlantaoPage`, `MobileFaltaPage`) ficam em **ordem alfabética** e devem ser mantidos iguais entre si. A coluna `extras.motivo` no banco é texto livre (sem CHECK), então incluir motivo novo não exige migration — só os 4 arquivos.
- **BI — busca da aba Eventos é restrita aos campos visíveis (decisão da gestão, 04/09/2026)**: a busca genérica `buscaTextual` (casa o termo no JSON inteiro do registro) fazia pesquisar "Maciel" trazer eventos que ele só **abriu** (`usuario_nome`) ou onde foi citado na observação. A aba Eventos usa `buscaEventos` (`src/lib/bi/agregacoes.ts`): casa apenas número/ano, assunto, subtipo, local e o **responsável exibido** (`respEv`, que já reflete a análise mais recente). Checklists e Visitas seguem com `buscaTextual`. Testes em `agregacoes.test.ts` travam o caso.
- **BI — filtro de status da aba Eventos tem opções agregadas (04/09/2026)**: o `status_texto` vem verbatim do PerformanceLab ("Em Análise", "Crítico", "Aguardando", "Concluído") e o select só lista os status **presentes no período carregado** — por isso "Crítico" não aparecia na janela padrão de 5 dias (os 27 críticos abertos são de 08/06 a 24/08/2026). As sentinelas **"Em aberto (todos)"** e **"Finalizados (todos)"** (`STATUS_EV_EM_ABERTO`/`STATUS_EV_FINALIZADOS` em `src/lib/bi/agregacoes.ts`, `filtrarStatusEvento`) agrupam por situação seguindo a regra do KPI — `eventoFinalizado` = tem `data_finalizacao`, independente do nome do status.
- **BI — filtros das abas alimentam a aba inteira e os visuais são clicáveis (decisão da gestão, 04/09/2026)**: antes, os filtros de cada aba (busca, status, SLA etc.) valiam só para a tabela de detalhe — KPIs, gráficos e agregados ignoravam. Agora a lógica é a **cascata** (`cascataChecklists`/`cascataVisitas`/`cascataEventos` em `agregacoes.ts`, com testes): cada estágio acumula um filtro e cada visual usa o estágio **anterior ao filtro que ele mesmo controla**, para o seletor não colapsar (padrão Power BI — filtrou "Maciel" na tabela de responsáveis, ela segue mostrando os demais). Cross-filter: fatia do doughnut de SLA → filtro de SLA; barra de assunto/inspetor/dia → respectivo filtro (dia vira chip removível); linha de "Eventos por responsável" e KPIs ("Em aberto", "Finalizados", conclusões de checklist) também filtram, com destaque no item ativo. Cada aba tem "Limpar filtros" próprio. O filtro global "Pessoa" de eventos foi alinhado: casa **apenas** com o responsável exibido (`respEv`), não mais com quem abriu. **Alerta de críticos antigos**: a página conta `bi_eventos` com status "Crítico" abertos **antes** do período carregado e mostra aviso amarelo na aba Eventos com botão "Ampliar período e ver críticos" (carrega os 90 dias retidos + aplica o filtro).

---

## 12. O que não fazer

- Não crie usuários admin automaticamente.
- Não armazene a service role key ou tokens privados no frontend ou em código.
- Não modifique o mapa padrão de permissões (`PERMISSOES_PADRAO`) sem refletir na tela `PermissoesPage` e vice-versa.
- Não adicione degradês em novos lugares sem autorização do design system.
- Não altere a regra de 30 dias para adicionais sem validação de negócio.
- Não mude o banco de dados sem backup e sem migrations versionadas.
- Não ignore o teste de RLS sem verificar se o Python está instalado.
- Não faça UPDATE/DELETE via PostgREST sem terminar em `.select('id')` e checar se alguma linha foi afetada — escrita bloqueada por RLS retorna 0 linhas SEM erro e o toast fingiria sucesso (padrão anti-falso-sucesso aplicado em todos os hooks em 01/08/2026; ver `src/hooks/useExtras.ts`).

---

## 13. Referências rápidas

- `README.md` — visão geral e stack.
- `docs/DEPLOY.md` — deploy e configuração de servidor.
- `docs/DESIGN_SYSTEM.md` — regras visuais e componentes.
- `docs/REGRAS_NEGOCIO.md` — decisões de negócio validadas.
- `docs/AGENTES_RH_PLENA.md` — prompts para agentes de avaliação (atenção: contém informações parcialmente desatualizadas, como React 18).
- `src/pages/ceu/AGENTS.md` — exceção específica do módulo CEU sobre datas de recibo.
- `docs/CORH — Design System (para Kimi Code).md` — especificação visual completa.
- `docs/manual/` — Manual do Usuário (Word + PDF) gerado a partir de `scripts/manual/` (capítulos em Markdown + screenshots automáticos com dados fictícios; ver `scripts/manual/README.md` para atualizar).

---

*Atualizado em: 2026-09-04*
