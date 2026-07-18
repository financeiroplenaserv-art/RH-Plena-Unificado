# Relatório de Trabalho — CORH (Sessão de 17–18/07/2026)

> Resumo executivo de todo o trabalho realizado: redesign do Design System, auditoria de segurança em 4 levas, migração de chaves de API, saneamento de dados mestres e importações históricas. Tudo commitado e enviado ao GitHub (`main` sincronizada).

---

## 1. Design System CORH v1.0

Implementação completa da especificação `public/CORH — Design System (para Kimi Code).md`:

- **Tokens:** paleta azul Microsoft (`#0F6CBD`), sidebar azul-marinho (`#0C1730`), degradê restrito a 3 lugares (login, hero do dashboard, botões primários).
- **Correção crítica:** adicionado `@theme inline` no `index.css` — sem ele, o Tailwind v4 não gerava nenhuma classe de token (`bg-popover`, `bg-card`, etc.), deixando **todos os dropdowns e modais transparentes**.
- **Componentes novos em `src/components/corh/`:** Button, PageHeader, Filters, DataTable, StatusBadge, EmptyState, ConfirmDialog, ModuleTabs.
- **Layout:** Sidebar escura com ícones monocromáticos e item ativo em pill; Header virou Topbar (breadcrumb, busca, notificações, avatar com displayName).
- **Telas redesenhadas:** Dashboard, Colaboradores, Departamentos, Empresas, Escalas, Extras, Ocorrências (busca unificada Cadastrados/Históricos + dica em tooltip), CEU (legenda EPI/Uniforme/Crachá), Login, Placeholders.
- **Centralização:** `ModuleShell`/`ModuleCard`/`ModuleButton` atualizados (afeta ~25 telas); `PageHeader` legado removido (21 páginas migradas).
- **Regras aplicadas:** overlay `bg-black/60` único, sem transparência/blur em dropdowns e modais, exclusão por ícone discreto, vermelho sólido só em confirmações, botão de filtro sempre "Aplicar".

Commits: `289469a`, `ce618f6`, `2c5e2af`.

---

## 2. Auditoria de Segurança (4 levas)

Auditoria com 4 agentes especializados (banco/RLS, frontend/auth, performance, qualidade). Backlog completo em `docs/BACKLOG_AUDITORIA_PRE_GOLIVE.md`.

### Leva 1 — Críticos
- **Escalonamento a admin:** qualquer usuário podia virar admin alterando o próprio `nivel_acesso` (policies órfãs da migration 042 + self-update sem trava). Fechado na **migration 064** (drops + trigger `proteger_campos_sensiveis_perfil` + self-INSERT só `visualizador` + auditoria em `perfis`).
- **`calendario_adicionais` com CRUD aberto:** fechado na migration 064.
- **Policy aberta da 037 em `departamentos`** anulava a 063 — drop incluído.
- **Validador RLS** (`scripts/validar_rls.py`) alinhado — teste voltou a passar.
- `/colaboradores` com `ProtectedRoute` + CPF mascarado; `/mobile/falta` dentro de Suspense; cache de permissões limpo no logout.
- **Bloco CEU na tela Permissões** (9 ações) + guards nas páginas.

Commits: `9c12918`, `5f96046`, `9ca0e6d`, `2c5e2af`, `ce618f6`.

### Leva 2 — Altos
- **Migration 063:** SELECT de `empresas`/`departamentos` restrito por perfil.
- **Migration 065:** SELECT restrito em escalas (4 tabelas), CEU (3 tabelas), alertas e modelos; `rh` não lê mais o token e-Contador.
- **Importação de colaboradores** não zera mais dados (payload sem vazios, validações, testes).
- **CEU:** entrega atômica em lote (`criarLote`); item não perde valor na edição; falso sucesso eliminado.
- **Permissões:** mapa único `PERMISSOES_PADRAO` — a tela Permissões passou a mostrar o valor efetivo real (fim do "desmarcado enganoso"); bug do toggle que apagava fallbacks corrigido.

Commits: `2b94fbd`, `a1dae07`, `593b553`.

### Leva 3 — Integridade e LGPD
- **Migration 066:** trilha de auditoria em departamentos, empresas, CEU e adicionais.
- **Migration 067:** RPCs transacionais — `salvar_resultados_vr_lote` (sem perda total), `assinar_recibo_extras` (atômico), `cancelar_recibo_extras` (reverte extras).
- **Migration 068:** consentimento LGPD via RPC com prova imutável (`consentimentos_lgpd`) + trigger anti-bypass.
- CNPJ/CPF com máscara e validação; extras exige departamento e valor > 0; VR sem negativos; `ConfirmDialog` em todas as exclusões; arquivo VR PAT valida CPF no Tipo 60; `plena_perfil` fora do localStorage.

Commit: `79285ca`.

### Leva 4 — Performance
- **Service worker:** precache **5,2 MB → 1,15 MB** (whitelist; chunks lazy e imagens de marketing fora).
- **Escalas:** tabela diária não trunca mais em 1000 linhas (paginação).
- **Dropdowns:** `listarResumido` (10 colunas em vez de 32) nas 14 telas.
- **Ocorrências:** carregamento 3× → 1× no mount; Dashboard filtra no servidor.
- **Boot:** perfil+permissões 2× → 1×.
- **Logo:** 131 KB → 46 KB.

Commit: `c5a7b46`.

---

## 3. Migração de chaves de API

- A **service role vazou** em um print. Ela foi **revogada** ("Disable JWT-based API keys" no Supabase).
- App migrado para as chaves novas: **publishable key** no frontend, **secret key** no backend/Edge Function.
- `.env` local saneado (URL, anon e service key novas com nomes corretos).
- **Teste de fogo validado:** tentativa de virar admin via API retorna `400` (trava da migration 064 funcionando).

---

## 4. Saneamento de dados mestres

### Departamentos padronizados
- **Blue Terminal(s):** local de trabalho e departamento duplicados unificados — 9 escalas redirecionadas, mapeamento Flit corrigido, 1 colaboradora movida.
- **Padronização de nomes curtos:** 4 duplicados unificados (Aliança→CBO com 10 colaboradores, Matizes com 3, Ofício, Flor de Lotus), 5 nomes curtos preenchidos (CNOCC, CARMO, DALIAS, DUOCONNECT, MATIZES).
- **Limpeza:** 17 registros inativos sem vínculos excluídos (18 com vínculos preservados).
- **Itaguaí:** Rosas e Dálias unificados em **ITAGUAÍ** (2 contratos + 2 colaboradores).
- **Resultado:** 67 ativos, todos com nome curto único.

### Contratos adicionais
- **89/89 contratos importados** da planilha (`scripts/importar-contratos-adicionais.cjs`, idempotente). Vínculos ficam para lançamento manual.

---

## 5. Ocorrências históricas

- **Backup** das 6.742 ocorrências anteriores em `dados-locais/backup-ocorrencias-*.json` (9,2 MB).
- **Reimportação:** 9.233 ocorrências da planilha do sistema antigo.
- **Casamento correto de colaboradores** (após flagrar erro do usuário no caso Ramulpho): nome exato único + CPF via PDF com **validação cruzada** (protege contra colisão de códigos entre sistemas — "974" era Alexandre na OCC e Ramulpho no PDF). Resultado: **4.200 casadas + 5.033 placeholder**, contagens conferidas (Ramulpho 17, Alexandre 15 — exatos).
- **`colaborador_nome` preenchido** em todas as casadas (fim do "N/A" causado pelo filtro de status anulando o embed).
- **Regras do formulário:** descrição obrigatória adicionada; medida corretiva tornou-se **opcional** (a pedido).

Commits: `9c99c9f`, `9cd47a6`. Script: `scripts/importar-ocorrencias-historicas.cjs`.

---

## 6. Estado final e verificações

- **Git:** tudo commitado e enviado — `main` sincronizada com `origin/main` (0 commits à frente).
- **Testes:** 126 passando · **Lint:** limpo · **Validador RLS:** OK · **Build:** OK.
- **Segurança:** RLS completa, trava anti-admin, consentimento com prova, auditoria em todas as tabelas sensíveis — nada desconfigurado pelas importações (só dados foram trocados).
- **Migrations aplicadas pelo usuário:** 062, 063, 064, 065, 066, 067, 068 (docs de aplicação em `docs/APLICAR_MIGRATION_*.md`).

### Observações para o futuro
- Vínculos dos contratos adicionais: lançamento manual pendente.
- Geração de alertas (P6): otimização real exige RPC agendada (projeto futuro).
- Módulos placeholder: Férias e Relatórios aguardam implementação.
