# Relatório de Auditoria de Segurança — RH Plena Unificado

**Escopo:** aplicação React + Supabase (frontend, migrations, storage, env, tokens).  
**Data da análise:** 2026-06-25.  
**Branch:** `main`.  
**Hash mais recente:** `1eb1569`.

---

## Resumo executivo

O projeto possui uma arquitetura de autorização **parcialmente implementada**: RLS está ativo na maioria das tabelas, há funções de controle de nível de acesso e o token do e-Contador foi restringido a `admin`/`rh`. No entanto, existem **falhas críticas de controle de acesso e exposição de segredos**: novos usuários são promovidos automaticamente a `admin`, a rota do e-Contador é pública para qualquer autenticado, o token da API Alterdata é trafegado e armazenado no cliente, e as novas tabelas `extras`/`recibos_extras` estão com RLS aberto. Storage e auditoria também estão abaixo do esperado para dados de RH.

---

## Achados críticos

| # | Problema | Severidade | Arquivo(s) / trecho |
|---|----------|------------|---------------------|
| 1 | **Novo usuário vira `admin` automaticamente.** `useAuth` cria um perfil com `nivel_acesso: 'admin'` quando o usuário logado não possui perfil. Se o Supabase Auth estiver com sign-up público (padrão), qualquer pessoa que crie conta ganha administração total. | CRÍTICO | `src/hooks/useAuth.ts:24-43` |
| 2 | **Rota `/importar/econtador` não possui `ProtectedRoute`.** Qualquer usuário autenticado (inclusive `visualizador`) acessa a página, vê o token do e-Contador e pode disparar chamadas à API Alterdata. | CRÍTICO | `src/App.tsx:195` |
| 3 | **Token JWT do e-Contador é usado diretamente no frontend.** `econtadorApi.ts` faz `fetch` do navegador para `dp.pack.alterdata.com.br`, expondo o token no cliente e na rede. | CRÍTICO | `src/services/econtadorApi.ts:5, 12-39` |
| 4 | **Token do e-Contador armazenado em texto plano.** A chave `econtador_token` é salva na tabela `configuracoes` sem criptografia. Acesso em massa a dados sensíveis de RH. | CRÍTICO | `supabase/migrations/015_rls_token_econtador_e_departamentos.sql`, `src/services/econtadorApi.ts:21-30` |
| 5 | **Tabelas `extras`, `categorias_extras` e `recibos_extras` com RLS aberto.** Políticas `FOR ALL ... USING (true)` permitem leitura/escrita/exclusão a qualquer usuário autenticado. | CRÍTICO | `supabase/migrations/018_extras.sql:67-92`, `supabase/migrations/026_recibos_extras.sql:28-39` |
| 6 | **Storage buckets sem isolamento por usuário/empresa.** Qualquer autenticado pode ler, inserir e atualizar objetos em `ocorrencia-anexos` e `vr-arquivos`, independentemente de qual ocorrência/projeto pertencem. | CRÍTICO | `supabase/migrations/011_storage_buckets_rls.sql:29-51, 73-87` |
| 7 | **SELECT irrestrito em dados sensíveis de RH.** A migration 014 mantém `SELECT ... USING (true)` para todas as tabelas de negócio, permitindo que `visualizador` leia CPF, RG, PIS, endereço, ocorrências disciplinares, testemunhas e o campo `dados_completos` dos colaboradores. | CRÍTICO | `supabase/migrations/014_rls_restrito_por_nivel_acesso.sql:51-54` |

---

## Achados altos

| # | Problema | Severidade | Arquivo(s) / trecho |
|---|----------|------------|---------------------|
| 8 | **Sem auditoria automática no banco.** Não há triggers Postgres para registrar INSERT/UPDATE/DELETE. O hook `useAuditoria` é manual e só carrega logs; não há inserção automática em operações críticas. | ALTO | `src/hooks/useAuditoria.ts`, `src/pages/rh/OcorrenciaDetailPage.tsx:84,745-756` |
| 9 | **Tela de primeiro acesso vaza estado do sistema.** App.tsx consulta `count` de `perfis` sem usuário logado, revelando quando o banco está vazio e permitindo que qualquer visitante crie a primeira conta. | ALTO | `src/App.tsx:76-89` |
| 10 | **Exportações de dados sensíveis sem máscara/anomimização.** CSV/Excel de funcionários exportam CPF em texto plano. PDFs de ocorrências e recibos de extras também exibem CPF. | ALTO | `src/pages/ImportarEContadorPage.tsx:83-116`, `src/lib/pdf.ts`, `src/lib/extrasRecibos.ts` |
| 11 | **Login sem proteções contra força bruta.** Não há rate limiting, captcha, MFA/2FA nem notificação de novo login. | ALTO | `src/pages/LoginPage.tsx`, `src/lib/auth.ts` |
| 12 | **Schema inicial das tabelas principais não versionado.** Não há migrations criando `colaboradores`, `ocorrencias`, `empresas`, `perfis`, `configuracoes`, etc. Isso impede auditoria e reprodutibilidade do schema. | ALTO | `supabase/migrations/` |

---

## Achados médios

| # | Problema | Severidade | Arquivo(s) / trecho |
|---|----------|------------|---------------------|
| 13 | **Histórico de importações permite UPDATE/DELETE pelo próprio usuário.** Embora razoável em alguns cenários, permite que o usuário apague seu rastro. | MÉDIO | `supabase/migrations/010_rls_tabelas_negocio.sql:125-135` |
| 14 | **`ConfiguracoesPage` não valida formato do token nem confirma sucesso.** O input aceita qualquer string e redireciona imediatamente, sem validar se o token funciona. | MÉDIO | `src/pages/ConfiguracoesPage.tsx:16-22` |
| 15 | **Sidebar expõe menu do e-Contador a todos os níveis**, enquanto `App.tsx` não protege a rota, criando inconsistência de autorização. | MÉDIO | `src/components/layout/Sidebar.tsx:42` |
| 16 | **Funções `is_admin`, `is_editor`, `is_rh_ou_admin` são `SECURITY DEFINER`.** Embora corretamente limitadas a `auth.uid()`, funções `SECURITY DEFINER` exigem revisão periódica de `GRANT EXECUTE`. | MÉDIO | `supabase/migrations/010_rls_tabelas_negocio.sql:10-24`, `014_rls_restrito_por_nivel_acesso.sql:12-24`, `015_rls_token_econtador_e_departamentos.sql:18-32` |
| 17 | **Importação de departamentos via CSV no frontend** confia apenas no RLS; não há checagem de nível de acesso no código. | MÉDIO | `src/pages/DepartamentosPage.tsx:227-262` |

---

## Achados baixos

| # | Problema | Severidade | Arquivo(s) / trecho |
|---|----------|------------|---------------------|
| 18 | **Variáveis de ambiente:** `.env` não está versionado (bom sinal), mas `.env.example` documenta `SUPABASE_SERVICE_ROLE_KEY` — deve haver controle para que nunca seja usada no frontend. | BAIXO | `.env.example:13`, `.gitignore:11` |
| 19 | **Scripts de manutenção usam `VITE_SUPABASE_ANON_KEY`** em vez de `service_role`, o que é adequado, mas carregam `.env` manualmente com parser simples. | BAIXO | `scripts/testar-supabase.ts`, `scripts/listar-empresas.ts` |
| 20 | **Falta mensagem de erro amigável quando `supabaseUrl`/`supabaseKey` estão vazios.** O cliente é criado com strings vazias, falhando silenciosamente. | BAIXO | `src/lib/supabase.ts:4-15` |

---

## Recomendações práticas de correção

### Imediatas (críticas)

1. **Corrigir criação automática de admin.**  
   Remova a criação automática de perfil `admin` em `useAuth.ts`. O primeiro acesso deve ser um fluxo controlado (ex.: seed manual, Edge Function ou convite) e nunca inferido pela ausência de perfil.

2. **Proteger a rota `/importar/econtador`.**  
   Em `App.tsx:195`, envolva `ImportarEContadorPage` em `<ProtectedRoute user={user} nivelMinimo={['admin','rh']}>`.

3. **Mover chamadas do e-Contador para Edge Function.**  
   Crie uma Edge Function no Supabase (`/functions/econtador`) que consulta o token e faz as requisições à Alterdata. O frontend nunca deve ter acesso ao token JWT nem à URL da API.  
   - Criptografe o token no banco (ex.: `pgcrypto` + chave armazenada em Edge Function/env).  
   - Revogue a policy de SELECT do token do frontend.

4. **Restringir RLS de `extras`, `categorias_extras` e `recibos_extras`.**  
   Substitua as policies `USING (true)` por níveis de acesso (`visualizador` SELECT; `gestor`/`rh` INSERT/UPDATE; `admin` DELETE).

5. **Isolar storage por contexto.**  
   Adicione `owner` ou `usuario_id` nos metadados dos objetos e ajuste as policies para:  
   - SELECT/UPDATE apenas no próprio objeto ou quando relacionado a registro que o usuário pode acessar;  
   - INSERT limitado a editores;  
   - DELETE apenas admin ou owner.

### Altas prioridades

6. **Implementar auditoria automática no banco.**  
   Crie triggers Postgres (`BEFORE INSERT/UPDATE/DELETE`) nas tabelas críticas (`ocorrencias`, `colaboradores`, `ocorrencia_anexos`, `extras`, `recibos_extras`) inserindo em `log_auditoria` com `auth.uid()` e diferenças de dados.

7. **Proteger primeiro acesso.**  
   Não exponha `count = 0` publicamente. Use um token/seed de setup ou desative o sign-up público no Supabase Auth e gerencie usuários por convite/admin.

8. **Adicionar proteções de login.**  
   Considere habilitar captcha, limitar tentativas (rate limiting via Edge Function) e notificações de login suspeito.

9. **Versionar o schema inicial.**  
   Crie migrations `000_*.sql` com `CREATE TABLE` das tabelas principais (`colaboradores`, `ocorrencias`, `empresas`, `perfis`, `configuracoes`, etc.) para garantir reprodutibilidade.

10. **Mascarar/anomimizar dados em exportações.**  
    Em CSV/Excel/PDF, evite exportar CPF completo em texto plano; use máscara ou omita quando não essencial.

---

## Nota geral de segurança

**Nota: 3.5 / 10**

A aplicação possui fundamentos de autenticação/RLS, mas falhas críticas de controle de acesso, exposição de token de terceiro e ausência de auditoria automática colocam dados pessoais e operacionais do RH em risco elevado. A correção das recomendações "Imediatas" é necessária antes de qualquer deploy em produção com dados reais.
