# Relatório de Robustez — Integração Alterdata e-Contador

## Resumo Executivo

A integração com o Alterdata e-Contador é funcional para volumes pequenos, mas **frágil para operação crítica**. O token JWT está protegido por RLS (admin/rh), a paginação da API funciona e há histórico de importações, porém **faltam timeouts, retries, controle de concorrência, constraints de unicidade e processamento em lote**. Em volumes próximos a 5.000 registros, a importação sequencial de um-a-um pode levar dezenas de minutos e falhar silenciosamente em parte dos registros. A rota da página não possui guarda de permissão, criando inconsistência com as políticas de segurança do token.

---

## Achados por Severidade

### 🔴 Críticos

| # | Problema | Arquivo / Função | Impacto |
|---|----------|------------------|---------|
| 1 | **Ausência de constraints UNIQUE em `colaboradores`** (`matricula`, `cpf`) | Banco de dados — nenhuma migration define unique | Permite duplicatas no banco; `upsertPorMatricula` usa `.maybeSingle()` e atualiza **apenas um** registro arbitrário em caso de duplicidade. |
| 2 | **Importação sequencial um-a-um** | `useEContador.ts` → `importarFuncionarios` (loop `for...of` com `upsertPorMatricula`) | 5.000 registros = 5.000 requisições HTTP ao Supabase. Tempo estimado: **8–40 min**; alta chance de timeout do browser/aba. |
| 3 | **Sem timeout, retry ou AbortController nas chamadas à API Alterdata** | `econtadorApi.ts` → `listarEmpresas`, `listarFuncionarios` | Requisições presas podem travar a UI indefinidamente; falhas transitórias não são recuperadas. |
| 4 | **Rota `/importar/econtador` sem `ProtectedRoute`** | `App.tsx:195` | Qualquer usuário autenticado (incluindo `visualizador`) acessa a página. Embora o token seja bloqueado por RLS, a experiência quebra e vaza a funcionalidade. |
| 5 | **Filtro de empresas hardcoded e local** | `econtadorApi.ts:53-57` | Busca apenas 25 empresas e filtra por `['plena ea', 'plena tech']`. Se a API paginar ou o nome tiver variação (acento, maiúscula, "Plena E.A."), empresas são perdidas. |

### 🟠 Altos

| # | Problema | Arquivo / Função | Impacto |
|---|----------|------------------|---------|
| 6 | **Sem verificação de duplicatas entre CPF e matrícula distintos** | `useColaboradores.ts` → `upsertPorMatricula` | Se um registro existe por CPF A + matrícula X e a API manda CPF A + matrícula Y, a lógica atualiza por CPF (ignora matrícula). Isso pode ser correto, mas não é explicitamente tratado. |
| 7 | **Criação automática de empresa sem validação** | `useEContador.ts:211-228` | Empresa é criada apenas com nome e `codigo_alterdata`; sem CNPJ, sem checar duplicidade de nome/código. Risco de empresas fantasmas. |
| 8 | **Matching de departamentos sem normalização de acentos/ espaços** | `useEContador.ts` → `sincronizarDepartamentos` | "Tecnologia" ≠ "Tecnologia" com acento; a migration 025 já teve que corrigir isso no banco, mas o código ainda não normaliza. |
| 9 | **Modo "demitidos até 15 dias" carrega todos os funcionários** | `ImportarEContadorPage.tsx:56-63` e `handleCarregarFuncionarios` | Para 5.000 funcionários, baixa todos só para filtrar ~10–50 demitidos recentes. Deveria filtrar via API quando possível. |
| 10 | **Limite arbitrário de 5.000 registros sem aviso** | `econtadorApi.ts:98` | `if (offset > 5000) hasMore = false` silencia dados além desse limite. |
| 11 | **Progresso é zerado no `finally`** | `useEContador.ts:63` | O usuário não vê o progresso final quando a carga termina; durante a importação também não há progresso por registro. |

### 🟡 Médios

| # | Problema | Arquivo / Função | Impacto |
|---|----------|------------------|---------|
| 12 | **Mapeamento de férias não gera status específico** | `useEContador.ts:239-257` | Quando `afastamentodescricao === 'Férias'`, o funcionário cai como `Ativo`. Faltou status `Férias` no enum `StatusColaborador`. |
| 13 | **Afastamento vencido usa comparação de data sem timezone segura** | `useEContador.ts:245-246` | `new Date(afastamentoDataFim + 'T00:00:00')` assume timezone local; em horário de verão/fronteiras pode haver off-by-one. |
| 14 | **Não há auditoria de quem alterou cada colaborador** | `useEContador.ts` → loop de importação | Não grava `atualizado_por`, `origem` ou diff de campos. Dificulta rastreabilidade. |
| 15 | **Histórico salvo mesmo que a importação tenha erros** | `useEContador.ts:320-327` | Comportamento aceitável, mas `quantidade = lista.length` enquanto `erros` pode esconder que parte dos dados não persistiu. |
| 16 | **`data.links?.next` avança `offset` em vez de usar URL da próxima página** | `econtadorApi.ts:96` | Se a API usar cursor ou parâmetros diferentes, a paginação quebra. |
| 17 | **Token não é cacheado entre chamadas** | `econtadorApi.ts` → `getHeaders` | Cada página de funcionários busca o token novamente no Supabase (2 requisições por página). |

### 🟢 Baixos

| # | Problema | Arquivo / Função | Impacto |
|---|----------|------------------|---------|
| 18 | **Nomes de função inconsistentes** | `useColaboradores.ts:248` → `upsertPorMatricula` também busca por CPF | Confusão de manutenção; renomear para `upsertPorCpfOuMatricula`. |
| 19 | **Exportação Excel/CSV não sanitiza totalmente** | `ImportarEContadorPage.tsx:83-116` | Para uso interno o risco é baixo, mas fórmulas iniciadas com `=`, `+`, `-` em campos livres podem abrir vetor CSV injection. |
| 20 | **`dados_completos` armazena todos os campos brutos sem schema** | `useEContador.ts:263-274` | Útil para fallback, mas dificulta evolução e auditoria. |

---

## Riscos Específicos

### Risco 1 — Duplicatas e divergência de dados mestres
- Não há `UNIQUE(matricula)` nem `UNIQUE(cpf)` na tabela `colaboradores`.
- O upsert usa `.maybeSingle()`: se houver 2 registros com a mesma matrícula, um ficará desatualizado.
- Se dois usuários importarem simultaneamente, podem criar registros duplicados.

### Risco 2 — Dados desatualizados por importação manual
- A importação é **manual** (clicar no botão).
- Não há job agendado, webhook nem comparação por `dataAtualizacao`.
- Demissões/afastamentos só refletem no sistema no próximo clique de importação.

### Risco 3 — Falhas silenciosas
- `listarEmpresas` e `listarFuncionarios` retornam `[]` em caso de erro, exibindo apenas toast.
- Erros individuais no loop de importação são contabilizados em `erros` e logados no console, mas **não há lista de falhas** para o usuário corrigir.
- `salvarHistorico` falha silenciosamente (apenas `console.error`).

### Risco 4 — Performance inviável em escala
- 5.000 funcionários × ~150–300 ms por upsert = **12,5 a 25 minutos** em condições normais; em picos de rede, pode ultrapassar 1h.
- Browser pode matar a aba ou o usuário pode fechar, perdendo o estado.

### Risco 5 — Segurança e permissões inconsistentes
- A rota da página não protege por nível de acesso, mas a API do Supabase (token) sim.
- Isso permite que um `visualizador` veja a interface, clique em importar e receba erros de permissão — má experiência e potencial vazamento de IDs/nomes.

---

## Recomendações Práticas (por prioridade)

### Imediatas (P0)
1. **Adicionar constraints no banco**:
   ```sql
   ALTER TABLE public.colaboradores
     ADD CONSTRAINT colaboradores_matricula_unica UNIQUE (matricula),
     ADD CONSTRAINT colaboradores_cpf_unico UNIQUE (cpf);
   ```
   — isso sozinho elimina o risco de duplicatas silenciosas.

2. **Proteger a rota** em `App.tsx`:
   ```tsx
   <Route path="/importar/econtador" element={
     <ProtectedRoute user={user} nivelMinimo={['admin', 'rh']}>
       <ImportarEContadorPage />
     </ProtectedRoute>
   } />
   ```

3. **Implementar timeout nas requisições**:
   ```ts
   const controller = new AbortController()
   const timeout = setTimeout(() => controller.abort(), 30000)
   const response = await fetch(url, { headers, signal: controller.signal })
   clearTimeout(timeout)
   ```

### Curtas (P1)
4. **Trocar importação um-a-um por batch/upsert em lote**:
   - Usar `.upsert(lista, { onConflict: 'matricula' })` (depois de garantir unique) ou
   - Processar em chunks de 100 registros com `Promise.all` para reduzir tempo de 5.000 chamadas para ~50 chamadas paralelas.
   - Adicionar progresso real por chunk.

5. **Normalizar matching de departamentos** usando a função `public.normalizar_match()` já existente no banco (migration 025) ou equivalente no frontend.

6. **Adicionar retry com backoff** para erros 5xx/network na API Alterdata (máx. 3 tentativas).

7. **Implementar busca/filtro de empresas de forma paginada** e tornar os termos `"plena ea"` / `"plena tech"` configuráveis (tabela `configuracoes`).

### Médias (P2)
8. **Adicionar status `Férias`** ao enum `StatusColaborador` e mapear corretamente.

9. **Criar log de auditoria** de importações (quem, quando, quantos, quais IDs afetados).

10. **Exibir lista de erros** ao final da importação, não apenas contador.

11. **Considerar Edge Function do Supabase** para fazer as chamadas à API Alterdata: o token nunca transititaria no frontend e a lógica pesada rodaria no servidor.

### Longas (P3)
12. **Sincronização agendada** (cron no Supabase ou Edge Function) para manter dados mestres atualizados sem intervenção manual.

13. **Circuit breaker** para a API externa e fila de retry para falhas parciais.

---

## Nota Geral de Robustez

**Nota: 4,5 / 10**

A integração atende ao caminho feliz, tem proteção básica do token e histórico de importações, mas **carece de qualidade operacional** para ser considerada base confiável do sistema:
- Sem constraints de unicidade → duplicatas prováveis.
- Sem timeout/retry → falhas silenciosas e travamentos.
- Sem batching → impraticável para 5.000 registros.
- Sem guarda de rota → permissão inconsistente.
