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
│   ├── adicionais/       # Cálculos e importação de ponto para adicionais
│   ├── ceuRecibos.ts     # Lógica de recibos do CEU
│   ├── escalas/          # Importação de escala FLIT e inferência de local
│   ├── ocorrencias/      # Tipos e classificação de ocorrências
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
├── migrations/             # 68 migrations SQL (numeradas 001 a 068)
└── functions/econtador/    # Edge Function Deno para integração e-Contador

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
```

### Estado atual dos checks

- `npm run lint` — **passa**.
- `npm run build` — **passa** (gera `dist/` com PWA e service worker).
- `npm test` — **125 testes passam, 1 falha esperada por ambiente**:
  - `src/lib/rls.test.ts` executa um validador Python para verificar conflitos de RLS nas migrations. **Esse teste falha porque o Python não está instalado no ambiente atual** (erro 9009). Ele não indica falha de RLS real; o validador não consegue rodar.
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

- Consulte `docs/DESIGN_SYSTEM.md` e a especificação em `public/CORH — Design System (para Kimi Code).md`.
- Tokens de cor em `src/index.css` (Tailwind v4 com `@theme inline`).
- Paleta principal: azul `#0F6CBD` (Microsoft/Edge). Sidebar: `#0C1730`.
- Degradês permitidos em apenas 3 lugares: painel do login, cartão de boas-vindas do dashboard e botões primários (`.bg-brand-gradient-soft`).
- Use componentes de `src/components/corh/` para manter consistência: `PageHeader`, `Filters`, `DataTable`, `StatusBadge`, `EmptyState`, `ConfirmDialog`, `ModuleTabs`, `Button`.
- Botões de filtro devem se chamar **"Aplicar"**, nunca "Filtrar" ou "Buscar".
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

- Existem **68 migrations** em `supabase/migrations/` (numeradas `001_*` a `068_*`).
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

### Storage

- Buckets principais: `ocorrencia-anexos`, `vr-arquivos`.
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
- O banco de dados continua no **Supabase**; o VPS serve apenas o frontend estático.
- Build de produção: `npm ci && npm run build` → gera `dist/`.
- Servir `dist/` com nginx/caddy, configurando fallback SPA para `index.html`.
- Headers de segurança recomendados:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - CSP ajustada conforme o ambiente.
- Edge Function: deploy via `supabase functions deploy econtador`.
- Migrations: `supabase link --project-ref jmdjdogskvybsdjtmpmb && supabase db push`.
- Backup: antes de deploy/migrations, faça backup do banco (plano Free não tem backup automático; usar `scripts/backup_supabase_free.sql` no SQL Editor).

---

## 11. Regras de negócio importantes

Consulte `docs/REGRAS_NEGOCIO.md` para detalhes. Destaques:

- **Adicionais / 12×36**: quem trabalha em regime 12×36 tem direito a insalubridade/periculosidade de **30 dias cheios**, independentemente dos dias efetivamente trabalhados. Não é erro; não altere para proporcional.
- **e-Contador / Importação Alterdata**: apenas perfis `adm`, `dp1`, `dp2`.
- **Extras**: visualização `adm, mesa, financeiro, dp1`; edição por `is_editor()`; exclusão apenas `adm`.
- **Ocorrências**: visualização restrita; exclusão apenas `adm`.
- **Recibos de Extras**: ficam no sistema (`recibos_extras`), não são enviados para Youk.
- **Assinatura digital**: simples (canvas/base64), sem valor jurídico pleno; valor jurídico via Youk.
- **CEU**: recibos de entrega podem ser datados no **1º dia do mês** por prática operacional. Não altere para "hoje" automaticamente.

---

## 12. O que não fazer

- Não crie usuários admin automaticamente.
- Não armazene a service role key ou tokens privados no frontend ou em código.
- Não modifique o mapa padrão de permissões (`PERMISSOES_PADRAO`) sem refletir na tela `PermissoesPage` e vice-versa.
- Não adicione degradês em novos lugares sem autorização do design system.
- Não altere a regra de 30 dias para adicionais sem validação de negócio.
- Não mude o banco de dados sem backup e sem migrations versionadas.
- Não ignore o teste de RLS sem verificar se o Python está instalado.

---

## 13. Referências rápidas

- `README.md` — visão geral e stack.
- `docs/DEPLOY.md` — deploy e configuração de servidor.
- `docs/DESIGN_SYSTEM.md` — regras visuais e componentes.
- `docs/REGRAS_NEGOCIO.md` — decisões de negócio validadas.
- `docs/AGENTES_RH_PLENA.md` — prompts para agentes de avaliação (atenção: contém informações parcialmente desatualizadas, como React 18).
- `src/pages/ceu/AGENTS.md` — exceção específica do módulo CEU sobre datas de recibo.
- `public/CORH — Design System (para Kimi Code).md` — especificação visual completa.

---

*Atualizado em: 2026-07-22*
