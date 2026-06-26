# Relatório Consolidado de Auditoria Manual — 26/06/2026

**Projeto:** RH Plena Unificado  
**Data:** 2026-06-26  
**Executores:** Agentes especializados (segurança, cálculos financeiros, integração e-Contador, compliance LGPD/CLT, arquitetura de código)  

## 1. Ações Realizadas nesta Sessão

Após validação manual dos itens apontados pelos agentes especializados, as seguintes correções foram implementadas e testadas:

| # | Problema | Ação | Arquivo(s) alterado(s) |
|---|----------|------|------------------------|
| 1 | VR: total do recibo em lote duplicava o valor extra na capa | Corrigido cálculo do `totalGeral` para usar `valorBruto` (que já inclui o extra quando editado). Adicionado teste unitário. | `src/lib/vr/comprovanteVR.ts`, `src/lib/vr/comprovanteVR.test.ts` |
| 2 | Migration 037 deixou policies `SELECT` abertas em tabelas sensíveis | Criada migration `040` que remove a policy aberta e recria a policy restrita em `perfis`, `configuracoes`, `auditoria` e `log_auditoria`. | `supabase/migrations/040_corrigir_select_aberto_037.sql` |
| 3 | Modo direto legado do e-Contador ainda existia no frontend | Removido modo direto, `validarToken` frontend e variável `VITE_USAR_EDGE_FUNCTION_ECONTADOR`. A página agora envia o token direto para a Edge Function. | `src/services/econtadorApi.ts`, `src/pages/ImportarEContadorPage.tsx` |
| 4 | Página `/auditoria` apontava para tabela inexistente | Hook ajustado para ler/inserir em `log_auditoria`. | `src/hooks/useAuditoria.ts` |
| 5 | RLS de `configuracoes` permitia editores escreverem em `econtador_token` | Criada migration `041` que restringe INSERT/UPDATE do token a `admin/adm/dp1/dp2` e limpa policies antigas com nome errado. | `supabase/migrations/041_rls_configuracoes_token_restrito.sql` |
| 6 | Edge Function e-Contador sem CORS restrito, timeout curto e limite arbitrário | Adicionado CORS configurável via `ALLOWED_ORIGINS`, rate limiting simples por usuário, timeout de 60s e removido limite de 5.000 funcionários. | `supabase/functions/econtador/index.ts` |
| 7 | Recibo de extras não amarrava os extras pagos | Ao marcar como pago, o sistema agora exige que todos os extras estejam no `extras_ids` do recibo assinado e que o valor total bata. | `src/pages/extras/ExtrasRecibosPage.tsx` |

**Validação:** `npm run lint` ✅, `npm test -- --run` ✅ (42/42), `npm run build` ✅

---

## 2. Resumo Executivo

Foram reavaliadas as 5 auditorias anteriores do projeto. O estado atual já melhorou significativamente (migrations 038/039/040/041 de RLS, Edge Function do e-Contador com criptografia, consentimento LGPD, página `/auditoria`, 42/42 testes passando, build estável).

Os riscos mais graves identificados na auditoria já foram endereçados nesta sessão. Itens que permanecem pendentes (fora de escopo por decisão de negócio ou de complexidade maior):

1. **Cálculos financeiros**: amarração entre recibo de extras e extras pagos, inconsistências no VR e pagamento de adicionais fora do vínculo real.
2. **Segurança**: policies SELECT abertas na migration 037, modo direto legado do e-Contador e RLS de escrita desalinhada com a regra de negócio.
3. **Compliance LGPD**: página `/auditoria` apontando para tabela inexistente, ausência de consentimento do colaborador e direitos do titular.

A arquitetura possui débito técnico considerável, mas os riscos operacionais imediatos são menores do que os de cálculo e segurança.

---

## 3. Priorização Geral (Crítico + Alto)

| # | Área | Problema | Severidade | Arquivo(s) |
|---|------|----------|------------|------------|
| 1 | Segurança | Migration 037 duplica policies `SELECT` abertas, anulando proteção de `perfis`, `configuracoes`, `auditoria`, `log_auditoria` | **CRÍTICO** | `supabase/migrations/037_rbac_granular.sql` |
| 2 | Integração e-Contador | Código legado “modo direto” ainda pode expor o token JWT no frontend | **CRÍTICO** | `src/services/econtadorApi.ts` |
| 3 | Cálculos | Extras: recibo assinado não amarra os extras pagos — é possível pagar novos extras com recibo antigo | **CRÍTICO** | `src/pages/extras/ExtrasRecibosPage.tsx` |
| 4 | Compliance | Página `/auditoria` lê tabela `auditoria` inexistente; a tabela real é `log_auditoria` | **ALTO** | `src/hooks/useAuditoria.ts`, `src/pages/AuditoriaPage.tsx` |
| 5 | Segurança | RLS de escrita de `extras`, `categorias_extras`, `recibos_extras` e `ocorrencias` permite mais que o frontend/modelo de negócio | **ALTO** | `supabase/migrations/032_`, `038`, `037` |
| 6 | Cálculos | VR: total dos recibos em lote inconsistente quando há valor extra editado | **ALTO** | `src/lib/vr/comprovanteVR.ts` |
| 7 | Cálculos | VR: arquivo Alterdata trunca matrícula sem aviso | **ALTO** | `src/lib/vr/calculoVR.ts` |
| 8 | Cálculos | VR: matching por nome pode trocar colaboradores homônimos | **ALTO** | `src/lib/vr/calculoVR.ts` |
| 9 | Cálculos | Adicionais: substituto herda adicionais do contrato original | **ALTO** | `src/pages/adicionais/AdicionaisRelatorioPage.tsx` |
| 10 | Cálculos | Adicionais: período fixo conta dias fora do vínculo | **ALTO** | `src/pages/adicionais/AdicionaisRelatorioPage.tsx` |
| 11 | Segurança | Storage não isolado por contexto/owner — quem tem role pode acessar qualquer arquivo | **ALTO** | `supabase/migrations/039_`, `src/hooks/useAnexos.ts` |
| 12 | Segurança | Tela de primeiro acesso permite criar admin via variável de ambiente | **ALTO** | `src/App.tsx`, `src/hooks/useAuth.ts` |
| 13 | Compliance | Dados pessoais sensíveis não estão criptografados em repouso | **ALTO** | Schema `colaboradores` |
| 14 | Compliance | Direitos do titular não implementados | **ALTO** | Todo o sistema |
| 15 | Integração e-Contador | Token JWT é exposto no frontend durante validação prévia | **ALTO** | `src/pages/ImportarEContadorPage.tsx`, `src/services/econtadorApi.ts` |
| 16 | Integração e-Contador | RLS de `configuracoes` permite que `rh`/`gestor` escrevam na chave `econtador_token` | **ALTO** | `supabase/migrations/030_` |

---

## 4. Detalhamento por Área

### 4.1 Segurança e RLS

| # | Problema | Recomendação |
|---|----------|--------------|
| 1 | **Migration 037 duplica policies SELECT abertas.** Cria `Permitir select para autenticados USING (true)` em `perfis`, `configuracoes`, `auditoria`, `log_auditoria`. Como coexistem com policies restritas anteriores, qualquer autenticado passa a ler esses dados. | Criar migration corretiva `040_corrigir_policies_select_administrativas.sql` removendo as policies abertas e preservando apenas as restritas. |
| 5 | **RLS de escrita desalinhada.** `extras` permite `is_editor()`/`is_admin()`, mas o frontend só permite `mesa`/`inspetoria`; `recibos_extras` permite editores quando deveria ser `financeiro`/`mesa`/`dp1`; `ocorrencias` permite editores quando a criação deveria ser `gestor`/`rh`/`dp`/`mesa`. | Alinhar policies de INSERT/UPDATE/DELETE com `src/lib/permissoes.ts` e `docs/PERFIL_ACOES_MODELO.md`. |
| 11 | ~~Storage sem isolamento por contexto.~~ ✅ Corrigido: policies 044/045 restringem INSERT/SELECT/UPDATE/DELETE pelo path (`ocorrencia_id` / `projeto_id`), verificando existência do registro no banco. | `supabase/migrations/044_isolar_storage_contexto.sql`, `supabase/migrations/045_restringir_insert_storage_contexto.sql`. |
| 12 | **Primeiro acesso via variável de ambiente.** Se `VITE_PERMITIR_PRIMEIRO_ACESSO=true` em produção, qualquer visitante vira admin. | Eliminar fluxo automático; usar seed SQL/Edge Function de setup ou convite manual. |
| 7 | ~~Storage privado usa `getPublicUrl()`.~~ ✅ Corrigido: buckets `ocorrencia-anexos` e `vr-arquivos` agora usam `createSignedUrl()` com 15 min de expiração. | `src/lib/storage.ts`, `src/hooks/useAnexos.ts`, `src/lib/vr/storageVR.ts`, `src/pages/rh/OcorrenciaDetailPage.tsx`. Isolamento por `owner`/contexto ainda pendente. |
| 6 | Login sem proteção contra força bruta/captcha. | Implementar rate limiting na Edge Function de login ou captcha/hCaptcha. |
| 9 | PDFs de ocorrências e recibos podem exibir CPF completo. | Revisar templates e aplicar `mascararCPF()` onde não for estritamente necessário. |
| 8 | Schema inicial das tabelas principais não versionado. | Criar migration `000_schema_inicial.sql` idempotente com `CREATE TABLE IF NOT EXISTS`. |
| 10 | `.env.example` documenta `SUPABASE_SERVICE_ROLE_KEY`. | Remover do frontend; manter apenas em documentação de backend. |

### 4.2 Cálculos Financeiros

| # | Problema | Recomendação |
|---|----------|--------------|
| 3 | **Recibo assinado não amarra extras pagos.** Novos extras podem ser criados e marcados como “Pago” usando recibo antigo. | Ao marcar como pago, verificar se todos os `extras_ids` e valores batem com o recibo assinado; senão, exigir novo recibo. |
| 6 | **Total dos recibos em lote inconsistente.** `gerarRecibosLoteHTML` soma `valorBruto + extra`, mas `valorBruto` já inclui o extra após edição. | Padronizar cálculo: usar `diasElegíveis × valorVR + extra` sem somar `extra` sobre `valorBruto`. |
| 7 | **Arquivo Alterdata trunca matrícula.** `campoNum` pega os últimos 6 dígitos; matrículas maiores correm risco. | Validar matrícula limpa com exatamente 6 dígitos; se não, incluir em “puladosSemMatricula”. |
| 8 | **Matching por nome pode trocar homônimos.** Substring de 15 caracteres e match por primeiro nome aceita falsos positivos. | Exigir match por CPF da base; se não houver, exigir revisão manual. Se usar nome, exigir duas palavras ≥3 caracteres nos dois lados. |
| 9 | **Substituto herda adicionais do contrato original.** | Buscar vínculo/contrato ativo do substituto na data e aplicar os adicionais dele. |
| 10 | **Período fixo conta dias fora do vínculo.** Relatório sempre gera 20 anterior a 19 atual. | Limitar geração de dias ao intervalo efetivo do vínculo (`data_inicio` a `data_fim`). |
| 5 | Arquivo PAT gera beneficiário sem validar matrícula. | Adicionar validação mínima no Tipo 30 e listar exceções. |
| 4 | Matching por nome aceita quando um lado tem só um nome. | Exigir pelo menos duas palavras ≥3 caracteres nos dois lados ou exigir CPF. |
| 2 | VR: comprovante geral não exibe coluna “Extra”. | Incluir coluna Extra no comprovante geral. |
| 10 (outro) | Importação de ponto pode marcar folga como “trabalhou”. | Bloquear importação final enquanto houver dias de revisão, ou assumir `folga` como padrão seguro para `00:00` sem histórico. |

### 4.3 Integração e-Contador

| # | Problema | Recomendação |
|---|----------|--------------|
| 2 | **Modo direto legado ainda presente.** `salvarTokenDireto`, `listarEmpresasDireto`, etc. podem ser reativados se a variável de ambiente mudar. | Remover todo o modo direto legado e forçar uso da Edge Function. |
| 15 | **Validação prévia no frontend expõe token.** Página chama `validarToken(token.trim())` antes de enviar à Edge Function. | Remover validação direta; enviar token diretamente para `/salvar-token` na Edge Function. |
| 16 | **RLS de `configuracoes` permite `rh`/`gestor` escreverem em `econtador_token`.** | Restringir INSERT/UPDATE dessa chave a `admin`/`adm`/`dp1`/`dp2`. |
| 3 | **Policy antiga de SELECT do token não é removida.** Nome do `DROP POLICY` está errado na migration 030. | Corrigir o `DROP POLICY IF EXISTS` para o nome exato da migration 015. |
| 4 | **Sem rate limiting na Edge Function.** | Adicionar rate limiting por usuário nos endpoints de escrita e listagens pesadas. |
| 5 | **Limite arbitrário de 5.000 funcionários com truncamento silencioso.** | Remover/tornar configurável o limite ou retornar erro explícito. |
| 6 | **Falta logging/auditoria estruturado na Edge Function.** | Criar tabela `auditoria_econtador` registrando ações, usuário, empresa, status e timestamp. |
| 7 | **Lista de empresas permitidas hardcoded.** | Mover para tabela/configuração no banco. |
| 8 | **CORS permite origem `*`.** | Restringir CORS às origens do aplicativo. |
| 9 | **Importação não é transacional.** | Agrupar criação de empresa/departamentos/colaboradores em uma Edge Function/RPC ou implementar rollback manual. |
| 10 | **Timeout fixo de 15s pode ser curto.** | Aumentar timeout, implementar retry com backoff e considerar paginação. |

### 4.4 Compliance LGPD/CLT

| # | Problema | Recomendação |
|---|----------|--------------|
| 4 | **Página `/auditoria` aponta para tabela inexistente.** Hook `useAuditoria` usa `auditoria`, mas a real é `log_auditoria`. | Alterar hook para `public.log_auditoria` ou criar view unificadora. |
| 1 | **Consentimento LGPD apenas para usuários do sistema.** Colaboradores importados do e-Contador não têm registro de consentimento próprio. | Criar fluxo de consentimento do colaborador no primeiro cadastro/importação. |
| 13 | **Dados pessoais sensíveis em texto plano.** CPF, RG, CTPS, PIS, endereço, telefone. | Criptografar colunas sensíveis com `pgcrypto` ou application-level. |
| 14 | **Direitos do titular não implementados.** Acesso, retificação, exclusão, portabilidade, revogação. | Implementar seção “Meus dados / Direitos LGPD”. |
| 5 | **Política de retenção documentada, mas não automatizada.** | Criar Edge Function/job periódico que anonimize/exclua dados fora do prazo legal. |
| 6 | **Assinatura digital dos recibos sem valor jurídico robusto.** Canvas base64 sem hash, timestamp ou certificado ICP-Brasil. | Adicionar hash + timestamp; integrar com certificado ICP-Brasil ou plataforma externa. |
| 7 | **WhatsApp sem registro de consentimento.** | Registrar consentimento para comunicação; oferecer anonimização de nomes. |
| 8 | **Anexos de ocorrências sem criptografia em repouso.** | Criptografar arquivos antes do upload ou ativar criptografia server-side. |
| 9 | **Ausência de DPO/canal visível no sistema.** | Adicionar e-mail/telefone do DPO no termo, menu e footer. |
| 10 | **Registro de Operações (RoPA) não implementado.** | Criar tabela/documento `ropa` mantido pelo administrador. |

### 4.5 Arquitetura de Código

| # | Problema | Recomendação |
|---|----------|--------------|
| 1 | **Páginas gigantes.** `OcorrenciaFormPage.tsx` (962 linhas), `OcorrenciaDetailPage.tsx` (851), etc. | Extrair subcomponentes, custom hooks e funções puras para `src/lib/`. |
| 2 | **Design system fragmentado.** `CeuButton`, `VrButton`, `CeuCard`, `VrCard`, etc. | Unificar em tokens no `src/index.css` e estender `@/components/ui/*`. |
| 3 | **Cobertura de testes muito baixa.** Apenas 4 arquivos de teste para ~135 arquivos `.ts`/`.tsx`. | Priorizar testes de integração para hooks críticos e smoke tests de formulários. |
| 4 | **Mock ainda presente no bundle.** `useAdicionaisContratuais.ts` tem ~70% de lógica de mock. | Isolar mocks em arquivos separados importados condicionalmente via `import.meta.env.DEV`. |
| 5 | **Type assertions (`as`) em massa.** ~155 ocorrências no `src/`. | Reforçar tipo `Database` do Supabase e adicionar validação runtime (zod). |
| 6 | **DashboardPage acoplada ao Supabase.** 12 queries e 14 estados locais. | Criar serviço/hook `useDashboardKPIs`. |
| 7 | **Duplicação entre `ExtrasFormPage` e `ExtrasPlantaoPage`.** | Extrair hook `useExtrasForm()` e componentes compartilhados. |
| 8 | **Regras hardcoded na UI.** 46 tipos de ocorrência em `OcorrenciaFormPage.tsx`. | Mover para `src/lib/ocorrencias/tiposOcorrencia.ts` ou tabela no banco. |
| 9 | **Hooks disparam toast.** Dificulta reutilização. | Criar camada de serviço que lance erros e deixar toast nas páginas. |
| 10 | **App.tsx monolítico.** 590 linhas com rotas e permissões inline. | Extrair configuração de rotas para `src/routes/routes.config.ts`. |

---

## 5. Próximos Passos Recomendados

### Imediatos (bloqueantes para produção)
1. Corrigir migration 037 (policies SELECT abertas) com migration `040`.
2. Remover modo direto do e-Contador no frontend.
3. Corrigir página `/auditoria` para usar `log_auditoria`.
4. Implementar amarração recibo ↔ extras pagos.
5. Corrigir inconsistência de totalização no VR (`comprovanteVR.ts`).

### Curtíssimo prazo (1–2 semanas)
6. Alinhar RLS de escrita de extras/recibos/ocorrências com `PERFIL_ACOES_MODELO.md`.
7. Corrigir matching por nome e validação de matrícula no VR.
8. Corrigir adicionais: substituto deve usar seu próprio vínculo; período deve respeitar `data_inicio`/`data_fim`.
9. Restringir escrita da chave `econtador_token` e corrigir DROP POLICY na migration 030.
10. Isolar storage por `owner`/contexto (substituir `getPublicUrl` por `createSignedUrl` ✅).

### Médio prazo
11. Criptografia de dados sensíveis em repouso (colaboradores) e anexos.
12. Implementar direitos do titular LGPD e consentimento do colaborador.
13. Refatorar páginas gigantes e consolidar design system.
14. Aumentar cobertura de testes nos hooks críticos.
15. Implementar rate limiting, timeout e auditoria na Edge Function do e-Contador.

---

## 6. Observações

- **Regras de negócio validadas não devem ser alteradas sem consulta à usuária:** cálculo de insalubridade/periculosidade (30 dias para 12×36) e elegibilidade VR (`docs/REGRAS_NEGOCIO.md`).
- **Prazo de defesa em ocorrências:** mantido fora de escopo por decisão de negócio.
- **Build/testes:** ao final dos ajustes imediatos, executar `npm run lint`, `npm test -- --run` e `npm run build` para garantir estabilidade.
