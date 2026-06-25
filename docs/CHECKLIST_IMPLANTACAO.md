# 📋 Checklist de Implantação — RH Plena Unificado

> Objetivo: deixar o sistema seguro e estável para implantar **localmente primeiro**, e depois migrar para um **VPS**.
> 
> Ordem: executar uma fase por vez, na ordem abaixo. Não pular etapas.

---

## ✅ Fase 1 — Críticos de Segurança (obrigatório antes do deploy local)

Estes itens são blockers. O sistema não deve ser implantado sem eles.

### 1.1 Corrigir bypass de autenticação via `localStorage` ✅
- **Arquivos:** `src/hooks/useAuth.ts`, `src/App.tsx`, `src/components/layout/ProtectedRoute.tsx`
- **Problema:** perfil é lido do `localStorage` e usado como estado inicial, permitindo acesso administrativo sem credenciais válidas.
- **Ação:**
  - [x] Inicializar `user` como `null` ou `undefined` (nunca do `localStorage`).
  - [x] Só definir `user` após `supabase.auth.getSession()` confirmar sessão válida.
  - [x] Limpar `localStorage` e estado quando não houver sessão.
  - [ ] Garantir que `ProtectedRoute` e `App.tsx` espere a validação da sessão antes de renderizar.

### 1.2 Remover privilégio excessivo da função `aplicar_rls_admin` ✅
- **Arquivos:** `supabase/migrations/010_rls_tabelas_negocio.sql`, `supabase/migrations/013_remover_funcao_aplicar_rls_admin.sql`
- **Problema:** `GRANT EXECUTE ON FUNCTION public.aplicar_rls_admin(TEXT) TO authenticated;` permite que qualquer usuário logado altere policies.
- **Ação:**
  - [x] Remover o `GRANT` para `authenticated` na migration 010.
  - [x] Criar migration 013 que revoga o privilégio e dropa a função.
  - [ ] Aplicar migration 013 no banco de produção via SQL Editor.

### 1.3 Restringir policies do RLS por nível de acesso ✅
- **Arquivos:** `supabase/migrations/010_rls_tabelas_negocio.sql`, `supabase/migrations/014_rls_restrito_por_nivel_acesso.sql`
- **Problema:** SELECT/INSERT/UPDATE liberados para qualquer usuário autenticado.
- **Ação:**
  - [x] `visualizador`: apenas SELECT.
  - [x] `gestor`/`rh`: SELECT/INSERT/UPDATE.
  - [x] `admin`: permissões completas (DELETE incluso).
  - [x] Todos os usuários acessam todas as empresas (sem isolamento por `empresa_id`).
  - [ ] Aplicar migration 014 no banco de produção via SQL Editor.
  - [ ] Validar se o sistema continua funcionando após as restrições.

### 1.4 Proteger token do eContador
- **Arquivos:** `src/services/econtadorApi.ts`, `supabase/migrations/010_rls_tabelas_negocio.sql`
- **Problema:** token da API Alterdata armazenado em texto plano e legível por qualquer usuário autenticado.
- **Ação:**
  - [ ] Restringir leitura da tabela `configuracoes` a `admin`/`rh`.
  - [ ] Avaliar criptografia do token no banco ou uso de Edge Function para chamadas à API Alterdata.

### 1.5 Remover override `any` do Supabase
- **Arquivo:** `src/lib/supabase.ts`
- **Problema:** `declare module '@supabase/supabase-js'` força `.from()` a retornar `any`.
- **Ação:**
  - [ ] Remover o `declare module`.
  - [ ] Corrigir erros de tipagem que aparecerem após a remoção.

### 1.6 Resolver modo mock hardcoded em Adicionais Contratuais
- **Arquivo:** `src/hooks/useAdicionaisContratuais.ts`
- **Problema:** `MODO_MOCK = true` hardcoded; módulo inteiro opera em `localStorage`.
- **Ação:**
  - [ ] Definir `MODO_MOCK` via variável de ambiente (`import.meta.env.VITE_MODO_MOCK`).
  - [ ] Corrigir mutação de estado (`lista.push(novo); setLista(lista)` → imutabilidade).
  - [ ] Decidir se o módulo será persistido no Supabase antes do deploy.

---

## ⚠️ Fase 2 — Qualidade e Estabilidade (antes do deploy local)

### 2.1 Corrigir loop de re-renderização no Dashboard
- **Arquivo:** `src/pages/DashboardPage.tsx`
- **Ação:**
  - [ ] Remover dependências cíclicas do `useEffect`.
  - [ ] Usar `count: 'exact', head: true` para KPIs.
  - [ ] Avaliar criar RPC/View no Supabase para consolidar KPIs.

### 2.2 Corrigir `useEffect` suprimido em Ocorrências
- **Arquivo:** `src/pages/rh/OcorrenciasPage.tsx`
- **Ação:**
  - [ ] Incluir dependências corretas no `useEffect`.
  - [ ] Usar `useCallback` para `loadOcorrencias`.

### 2.3 Adicionar paginação server-side
- **Arquivos:** `src/hooks/useColaboradores.ts`, `useOcorrencias.ts`, `useCEUEntregas.ts`, etc.
- **Ação:**
  - [ ] Substituir `select('*')` sem limites por `range()` + `count: 'exact'`.
  - [ ] Aplicar filtros de busca no backend (`.ilike()`).

### 2.4 Sanitizar HTML em recibos e comprovantes ✅
- **Arquivos:** `src/lib/ceuRecibos.ts`, `src/lib/vr/comprovanteVR.ts`
- **Ação:**
  - [x] Escapar caracteres especiais (dados dinâmicos já usam `escapeHtml`).
  - [x] Aplicar CSP no iframe via meta tag `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` em todos os templates HTML de CEU e VR.
  - [x] Iframe de preview do recibo já possui `sandbox="allow-same-origin"`.

### 2.5 Corrigir tratamento de erros silenciados ✅
- **Arquivos:** `src/hooks/useEContador.ts`, `src/hooks/useResultadosVR.ts`, `src/pages/DashboardPage.tsx`
- **Ação:**
  - [x] Verificar erros de `delete`, `insert`, `update` no Supabase.
  - [x] Não silenciar `catch` vazio (Dashboard agora exibe toast e loga no console).
  - [x] Retornar erros detalhados para a UI via `toast.error`.
  - [x] `useResultadosVR.salvarLote` agora verifica erro do `delete` antes de inserir.
  - [x] `useEContador` agora trata erros de token, histórico, criação de empresa e sincronização de departamentos.

### 2.6 Gerar IDs seguros
- **Arquivos:** `src/lib/ceuLogs.ts`, `src/hooks/useDepartamentos.ts`, `src/hooks/useAdicionaisContratuais.ts`
- **Ação:**
  - [ ] Substituir `Math.random()` e `crypto.randomUUID()` sem fallback por função própria robusta.

### 2.7 Revisar scripts de diagnóstico
- **Pasta:** `scripts/`
- **Ação:**
  - [ ] Separar scripts em `scripts/migrations/`, `scripts/tests/`, `scripts/debug/`.
  - [ ] Remover `teste-pdf-real.log` do repositório.
  - [ ] Documentar propósito de cada script.

---

## 🔧 Fase 3 — Dependências e Build

### 3.1 Resolver vulnerabilidades e dependências mortas
- **Arquivo:** `package.json`
- **Ação:**
  - [ ] Migrar de `xlsx@0.18.5` para alternativa sem vulnerabilidades (`exceljs`, `xlsx-js-style`, ou versão licenciada compatível).
  - [ ] Mover `@types/xlsx` para `devDependencies` ou removê-lo.
  - [ ] Remover `pg` (não utilizado).
  - [ ] Voltar TypeScript para versão 5.x estável e remover `ignoreDeprecations: "6.0"` do `tsconfig.app.json`.

### 3.2 Adicionar testes automatizados
- **Ação:**
  - [ ] Instalar Vitest.
  - [ ] Converter `scripts/teste-adicionais.ts` em testes unitários reais.
  - [ ] Criar testes para funções críticas (`calculoVR`, parsers, mappers, utils).

### 3.3 Otimizar build e assets
- **Ação:**
  - [ ] Remover arquivos de teste do `public/` (`teste*.pdf`, `modelo*.png`, `Departamentos.xlsx`).
  - [ ] Converter imports estáticos de `xlsx` para dinâmicos nas páginas de relatório.
  - [ ] Otimizar imagens PNG ou converter para WebP.

---

## 🖥️ Fase 4 — Deploy Local

### 4.1 Preparar ambiente local ✅
- **Ação:**
  - [x] Confirmar que `.env` local está configurado com a nova `anon` key.
  - [x] Verificar se todas as migrations do Supabase foram aplicadas.
  - [x] Rodar `npm run build` e `npm run lint` sem erros.

### 4.2 Servir o build localmente ✅
- **Ação:**
  - [x] Testar `npm run preview`.
  - [x] Verificar se as rotas do React Router funcionam (fallback para `index.html`).
  - Testado em `http://localhost:4173`: `/`, `/colaboradores`, `/rh/ocorrencias`, `/vr/projetos`, `/ceu/dashboard` retornaram HTTP 200.

### 4.3 Testes manuais no deploy local 🟡
- **Ação:**
  - [ ] Login com usuário comum, gestor, rh e admin.
  - [ ] CRUD de colaboradores, empresas, departamentos.
  - [ ] Criar/editar/visualizar ocorrências.
  - [ ] Registrar entrega CEU.
  - [ ] Calcular/importar VR.
  - [ ] Importar e-Contador.
  - [ ] Verificar permissões: usuário não-admin não deve conseguir deletar.
- **Observação:** roteiro documentado em `docs/DEPLOY.md`. Execução dos testes manuais depende de disponibilidade do ambiente.

---

## 🌐 Fase 5 — Preparação para VPS

### 5.1 Configurar headers de segurança 🟡
- **Arquivos:** config do servidor (nginx, Vercel, Netlify, etc.)
- **Ação:**
  - [ ] `Content-Security-Policy`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- **Observação:** exemplos de configuração documentados em `docs/DEPLOY.md`. Aguardando dados do VPS.

### 5.2 HTTPS e domínio 🟡
- **Ação:**
  - [ ] Configurar certificado SSL (Let's Encrypt).
  - [ ] Configurar domínio/apontamento DNS.
- **Observação:** aguardando dados do VPS.

### 5.3 Servir build no VPS 🟡
- **Ação:**
  - [ ] Instalar Node.js/npm no VPS ou usar Docker.
  - [ ] Copiar `dist/` para o servidor (ou fazer build no servidor).
  - [ ] Configurar nginx/caddy para servir arquivos estáticos e fallback do React Router.
  - [ ] Configurar `.env` no VPS (não commitado).
- **Observação:** roteiro documentado em `docs/DEPLOY.md`. Aguardando dados do VPS.

### 5.4 Backup e monitoramento
- **Ação:**
  - [ ] Configurar backup automático do banco Supabase.
  - [ ] Configurar monitoramento de uptime (opcional).
  - [ ] Definir processo de deploy contínuo (CI/CD).

---

## 🚀 Fase 6 — Melhorias Futuras (pós-VPS)

### 6.1 UX/UI
- [ ] Unificar design system (remover `CeuButton`, `VrButton`, `AdicionaisButton`).
- [ ] Tornar sidebar responsiva para mobile.
- [ ] Melhorar acessibilidade de autocompletes e tabelas.
- [ ] Adicionar validação de formulários (Zod/React Hook Form).
- [ ] Padronizar feedback de loading em todos os botões.

### 6.2 Performance
- [ ] Adotar TanStack Query para cache e deduplicação.
- [ ] Mover processamento de PDF/Excel para Web Workers.
- [ ] Implementar virtualização em tabelas grandes.

### 6.3 Segurança avançada
- [ ] Migrar para Publishable/Secret API keys.
- [ ] Desabilitar legacy API keys no painel.
- [ ] Revogar legacy JWT secret.
- [ ] Implementar validação de senha forte.
- [ ] Auditoria de ações críticas no banco.

### 6.4 Funcionalidades pendentes
- [ ] Decidir sobre placeholders `/escalas`, `/ferias`, `/relatorios`.
- [ ] Implementar notificações reais no Header.

---

## 📝 Registro de progresso

| Fase | Início | Fim | Responsável |
|------|--------|-----|-------------|
| 1 — Críticos de segurança | | | |
| 2 — Qualidade e estabilidade | | | |
| 3 — Dependências e build | | | |
| 4 — Deploy local | | | |
| 5 — Preparação VPS | | | |
| 6 — Melhorias futuras | | | |
