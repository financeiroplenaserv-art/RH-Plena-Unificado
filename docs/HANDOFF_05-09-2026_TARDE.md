# Handoff — 05/09/2026 (tarde): correção do bug de fuso horário em datas `date`

> Passagem para o próximo agente. Continuação da sessão de 05/09/2026 (ver `HANDOFF_05-09-2026.md` para o lote de EPIs e a importação em lote).
> Commit `8223063` na main, **deploy em produção feito e verificado** (hash do bundle confere com `dist/`). Testes: **388 passando**. Lint limpo, build ok. Sem migrations.

## 1. O problema relatado

As 172 entregas de EPI lançadas em 01/09/2026 (operação da manhã) apareciam com data **31/08** para a usuária no Brasil, mas corretas (01/09) na máquina da usuária remota (fuso ≥ UTC). O filtro por 01/09 encontrava os registros — ou seja, o **banco estava certo** (`data_entrega = '2026-09-01'`, coluna `date`); o erro era de exibição/cálculo no frontend.

**Causa raiz:** `new Date('2026-09-01')` interpreta string `YYYY-MM-DD` como **meia-noite UTC**. No Brasil (UTC-3) isso é 31/08 às 21h, e `toLocaleDateString` mostrava o dia anterior. Em fusos ≥ UTC o dia não muda — por isso o bug só aparecia para quem estava no Brasil.

## 2. A correção

Novo helper central em `src/lib/utils.ts`:

- **`parseDataLocal(data: string): Date`** — faz `new Date(data.slice(0,10) + 'T00:00:00')` (meia-noite **local**). Aceita também ISO completo (usa só a parte da data).
- **`formatarData()`** passou a usar `parseDataLocal` (antes fazia `data + 'T00:00:00'` direto — quebrava com ISO completo, caindo no fallback que devolvia a string crua).

**Arquivos corrigidos:**

| Arquivo | O que era |
|---|---|
| `src/lib/ceuRecibos.ts` | data nos **recibos** de entrega (EPI/uniforme) |
| `src/pages/ceu/relatorios/relatorios.utils.ts` | `formatarData` dos relatórios + `diasAte`/`diasAteTroca` (prazo de troca errava 1 dia no Brasil) |
| `src/pages/ceu/CeuEntregaFormPage.tsx` | histórico de entregas, validade do item, e data padrão do formulário (era `new Date().toISOString().split('T')[0]` — **data UTC**, virava o dia seguinte após 21h no Brasil; agora `formatarDataInput(new Date())`) |
| `src/pages/ceu/CeuItensPage.tsx` | validade e última compra do item |
| `src/pages/ceu/CeuMovimentacoesPage.tsx` | data padrão de devolução (mesmo problema do UTC acima) |
| `src/lib/escalas/importarFlit.ts` | **o mais grave depois do CEU**: datas `YYYY-MM-DD` da escala andavam **1 dia para trás ao importar** no Brasil (não era só exibição — gravava errado) |
| `src/lib/pdf.ts` | `data_admissao` e `data_ocorrencia` nos PDFs |
| `src/components/ocorrencias/ocorrencia-detail/DetailHeader.tsx` e `DadosOcorrenciaCard.tsx` | `data_ocorrencia` e `prazo_acompanhamento` |
| `src/pages/rh/ColaboradorDetailPage.tsx` | admissão, demissão, afastamento, ocorrências na ficha |
| `src/pages/rh/AlertasPage.tsx` | `data_vencimento` dos alertas |
| `src/pages/DashboardPage.tsx` | `diasAte` (validade CEU) e `diasDesde` (admissão) |

**Testes:** 6 novos em `src/lib/utils.test.ts` (determinísticos em qualquer fuso: verificam `getFullYear/getMonth/getDate` locais e a saída `01/09/2026`).

**Documentação:** regra registrada no `AGENTS.md` §11 — colunas `date` sempre via `parseDataLocal`/`formatarData`; "hoje" sempre via `formatarDataInput(new Date())`, nunca `toISOString().split('T')[0]`.

## 3. O que foi verificado e NÃO mexido (está correto)

- **Timestamps (`created_at`, `updated_at`)** com `new Date()` normal — a conversão UTC→local é o comportamento desejado. Ex.: `AnexosTab`, `AuditoriaTab`, histórico de importações.
- Parsers que já ancoravam com `'T00:00:00'`/`'T12:00:00'` (adicionais, férias, escalas-diário, VR, Departamentos).
- `src/lib/importar.ts` (`getDate`): faz parse e saída ambos em UTC (`toISOString().split('T')[0]`) — consistente para entradas ISO, sem off-by-one.
- `CeuMovimentacoesPage` ordenação por `new Date(a.data)` — comparador simétrico, ordem idêntica; mantido.
- O sorteio de `data_entrega` no banco segue como string `YYYY-MM-DD` — filtros `.gte/.lte/.eq` do PostgREST não foram afetados.

## 4. Deploy e validação

- Deploy prod em `plena-corh.netlify.app` (15 créditos); hash `assets/index-D_cPz9QU.js` confere entre produção e `dist/`.
- **Validar com as usuárias (Ctrl+Shift+R por causa do PWA):** Movimentações/Relatórios/Nova Entrega devem mostrar **01/09/2026** nas 172 entregas de setembro tanto no Brasil quanto fora. Recibos emitidos a partir de agora também saem com a data certa.
- Ressalva honesta: não foi possível testar em máquina com fuso UTC-3 aqui; a correção é estrutural (parse local) e os testes travam o caso. Se sobrar alguma tela com data trocada, procurar `new Date(<string de data>)` restante e trocar por `parseDataLocal`.

## 5. Estado

- Working tree limpa, main = `8223063`, push feito. Sem migrations, sem edge functions alteradas, sem operações de dados.

---

# Parte 2 (noite) — decisão da gestão: o CORH fala o horário de BRASÍLIA em tudo

> Commit `e3ff767` na main, deploy em produção verificado (hash `assets/index-BPtk4hsU.js` confere). Testes: **392 passando** (4 novos). Lint limpo, build ok. Sem migrations.

## Contexto e decisão

A usuária perguntou se a correção da tarde garantia que "tudo acontece no horário do Brasil". Resposta honesta: as datas de negócio sim, mas (a) a data padrão "hoje" dos formulários seguia o relógio da máquina da operadora e (b) carimbos de hora (`created_at`) eram exibidos no fuso de quem olha. Como o CORH só opera no Brasil e há operadora remota 5h à frente, a decisão foi **fixar o sistema inteiro em `America/Sao_Paulo`**.

## O que foi feito

**Novos helpers em `src/lib/utils.ts`:**
- `FUSO_BRASIL = 'America/Sao_Paulo'` (IANA — se o horário de verão voltar, ajusta sozinho);
- `hojeBrasil(): string` — "hoje" `YYYY-MM-DD` em Brasília (Intl `en-CA` com timeZone);
- `agoraBrasil(): Date` — Date cujos componentes **locais** refletem Brasília (usar só com getters locais);
- `formatarDataHora()` / `formatarDataDeTimestamp()` — exibição de timestamps fixada em Brasília.

**Regra dos 3 lados (documentada no AGENTS.md §11):**
1. "Hoje"/períodos padrão/datas default de formulários → `hojeBrasil()`/`agoraBrasil()`. Nunca `new Date().toISOString().split('T')[0]` (é UTC) nem o "hoje" do dispositivo.
2. Carimbos exibidos → `formatarDataHora()`/`formatarDataDeTimestamp()`.
3. **Gravação** de timestamps segue em UTC ISO (`new Date().toISOString()`) — o banco guarda o instante; a conversão é só na exibição. Não mexer.

**Arquivos tocados (41):** defaults de data/hora em CEU (entrega, devolução, lançamento rápido, importar), Extras (form, plantão, falta mobile, balanço — o default de `data_ocorrencia` do extra era UTC e virava o dia seguinte após 21h no Brasil), Ocorrencias (`useOcorrenciaForm`), Escalas (importar + diário), Adicionais (calendário, vínculos, relatório, importação de ponto), Férias (visão geral, notificação, `calculoFerias`), e-Contador (`diferencaDias`), BI (`periodoPadrao`/`verCriticosAntigos` usavam o dia **UTC** apesar do comentário dizer Brasília — bug latente), Dashboard (saudação, "dias até", aniversários), nomes de arquivos exportados e datas de emissão de PDFs/recibos. Exibição de `created_at` em: Auditoria (página — antes mostrava a **data UTC** via `formatarData`, outro bug latente — agora data+hora de Brasília), aba Auditoria da ocorrência, Anexos, históricos de importação (e-Contador, ponto, escala), listagem de extras.

**Não mexido de propósito:** timestamps gravados (`created_at`, `updated_at`, `confirmado_em`, `gerado_em`, `data_assinatura`) seguem UTC; comparações de instante (BI `statusSync`) são agnósticas de fuso; `importar.ts`/`importacaoPonto.ts` fazem parse e saída ambos em UTC (consistentes); ano do rodapé do login (cosmético).

## Validação

- 392 testes, lint, build. Testes novos determinísticos (`formatarDataHora('2026-09-01T02:30:00.000Z')` → `31/08/2026 23:30` em qualquer fuso da máquina).
- Ressalva: não testado em máquina fora do Brasil; a correção é estrutural (fuso pinado em `America/Sao_Paulo`, não depende do dispositivo).
- Validar com as usuárias (Ctrl+Shift+R): entregas de 01/09 corretas para ambas; "importado em"/auditoria com horário de Brasília nas duas máquinas.

---

# Parte 3 (noite) — filtro de departamento por nome_curto (caso CBO/Aliança)

> Commit `5f5cdb0` na main, deploy verificado (hash `index-etqg5oql.js`). Testes: **398 passando** (6 novos em `departamentos.test.ts`). Sem migrations.

## Problema

Relatórios CEU: filtrar por "CBO" não retornava ninguém, embora a Lourene (e outros 16) sejam da Aliança (= CBO). Verificado contra produção:

- A "CBO" é o departamento `6863ec8e` (`ALIANÇA S/A - INDÚSTRIA NAVAL...`, nome_curto `CBO`);
- existe uma **linha duplicada** `6e2e9d11` (`ALIANCA S A INDUSTRIA...` sem acentos, **nome_curto NULL**) — a Lourene aponta para ela;
- o ILIKE do filtro antigo não casava texto sem acento com cadastro acentuado, e o `departamento_id` dela não era o da linha "CBO".

## Solução

- **`idsColaboradoresDoDepartamento()`** em `src/lib/departamentos.ts`: resolve o departamento de cada colaborador no cliente com `encontrarDepartamentoFuzzy` (id > nome exato > nome_curto > tokens > substring > similaridade) e **expande o alvo para linhas duplicadas** (mesmo nome ou nome_curto normalizado — novo export `normalizarDepartamento`). Fallback por texto livre se nenhum departamento corresponde.
- Aplicado em: `useFiltrosRelatorio` (relatórios CEU), `useCEUEntregas` (Movimentações), `useColaboradores` (listagem + contagem paginada, filtro por id e por nome_curto) e `AutocompleteColaborador` (`buscarPorDepartamento` e ordenação por grupo; `buscarIdsDoGrupo` agora agrupa também por nome normalizado).
- Relatório CEU "Por colaborador" exibe o **nome_curto resolvido** ("CBO") em vez do texto legado ("ALIANCA S A INDUSTRIA...") — `AbaColaborador` ganhou prop `nomeDepartamento`; `COLUNAS_COLABORADOR_CEU` passou a incluir `departamento_id`.
- Regra no AGENTS.md §11: **nunca filtrar departamento com ILIKE no banco**; usar o helper.

## Validação

- Script temporário (removido após uso) rodou o helper real contra produção: filtro "CBO" → **17 colaboradores**, Lourene incluída; "CBO Macaé" fica de fora (posto distinto — distinção preservada de propósito).
- Validar na tela (Ctrl+Shift+R): CEU → Relatórios → Departamento = CBO → deve listar a turma da Aliança.

## Pendência de dados (decisão da gestão)

Fundir as linhas duplicadas de `departamentos` (ex.: as duas Aliança/CBO). O código agora convive com elas, mas a limpeza simplificaria cadastros futuros. Precedente: fusão de locais do Escalas em 07/08/2026 (`dados-locais/backup_fusao_locais_2026-08-07.json`).

---

# Parte 4 (noite) — nomes curtos em todas as telas + estanca-duplicadas (3 subagentes)

> Commit `d72fbee` na main, deploy verificado (hash `index-C6lxU9vm.js`). Testes: **400 passando** (2 novos do fallback de irmã). Sem migrations.

## Decisão da gestão

Nenhuma tela/documento mostra o texto legado de `colaboradores.departamento` — só o **nome_curto resolvido**. A usuária achou que "CBO" e "CBO Macaé" tinham sido juntados: **não foram** (verificado contra produção — filtro "CBO" = 17 da Aliança, "CBO Macaé" = 0, separados). A confusão era visual: Departamentos mostrava os nomes curtos, mas Colaboradores mostrava o texto longo legado.

## Execução (2 agentes explore de auditoria + 3 coder em paralelo, consolidado aqui)

- **Helper canônico**: `nomeCurtoDepartamentoFuzzy` ganhou fallback de **linha irmã** (linha resolvida sem nome_curto → usa o da irmã com mesmo nome normalizado, preferindo Ativa); `DepartamentoFuzzy` ganhou `status`. Lista de resolução: `select('id, nome, nome_curto, empresa_id, status')` SEM filtro de nome_curto — `useDepartamentos.listar()` filtra e não serve para isso.
- **Exibição migrada** (22 arquivos): CEU (recibos via `emissaoRecibos` — novo parâmetro `departamentos`, nova entrega, lançamento rápido, exportações, movimentações), RH (ficha, card da ocorrência, dialog da listagem), Dashboard, PDFs (`pdf.ts` também consertou a resolução de empresa por ILIKE, que nunca casava), `AutocompleteColaborador` (sugestão + selo "deste dept." por grupo), Falta Mobile (card + filtro por departamento reescrito com fuzzy + expansão), notificações de férias (embed do `useFerias` ganhou `departamento_id`/`empresa_id`), balanço de extras (fallback fuzzy cobre quem só tem texto).
- **Estancada a origem das duplicadas**: `useEContador.sincronizarDepartamentos` faz match fuzzy (`encontrarDepartamentoFuzzy`) antes de criar departamento — o e-Contador manda sem acento e o cadastro tem, então criava linha nova. `useExtras.verificarDuplicado` expande o grupo de duplicadas. `useColaboradores`: caminho morto `filtros.departamento` (ILIKE) unificado no mecanismo canônico.
- **Fora de escopo de propósito**: `testemunhas.departamento` (texto livre) e prévia do e-Contador (texto cru da API).

## Ressalva registrada pelo subagente

No matching fuzzy, um texto inédito "CBO MACAE..." sem linha própria no cadastro poderia cair no estágio de substring e casar com "CBO" — mesmo comportamento do regex antigo (`\bcbo\b`), não é regressão; existindo a linha "CBO Macaé", o match exato por nome_curto vence antes.

## Pendência de dados (decisão da gestão)

Fundir as duplicadas de `departamentos`: 3 linhas Aliança (manter `6863ec8e` = "CBO"; inativar `6e2e9d11` e `8643771f`, reapontando colaboradores) e "CBO SERVICOS MARITIMOS" (`5e42bb43`, inativa) → fundir em `7503715c` ("CBO Macaé") — os 11 colaboradores com texto "CBO SERVICOS MARITIMOS" e `departamento_id` NULL hoje não aparecem no filtro "CBO Macaé" (resolvem para a linha inativa). Com backup em `dados-locais/` antes, como sempre.

---

# Parte 5 (noite) — fusão das duplicadas de departamentos (aplicada)

> Decisão da gestão em 05/09/2026 (a usuária confirmou: os 11 "CBO SERVICOS MARITIMOS" são de **CBO Macaé**; os demais da Aliança/CBO). Executado via `scripts/fusao-departamentos-duplicados.mjs` (dry-run por padrão). Backup em `dados-locais/backup_fusao_departamentos_2026-09-05.json`.

## O que mudou no banco

- **Aliança/CBO (Niterói)**: linha oficial `6863ec8e` (nome_curto "CBO"). Os 17 colaboradores que apontavam para a duplicada `6e2e9d11` foram reapontados; `6e2e9d11` e `8643771f` inativadas.
- **CBO Serviços Marítimos (Macaé)**: linha oficial `7503715c` (nome_curto "CBO MACAÉ"). Os 11 colaboradores que só tinham o texto legado (`departamento_id` NULL) foram ligados a ela; `5e42bb43` inativada.
- `contratos_adicionais` e `extras` não referenciavam nenhuma linha absorvida (verificado antes).

## Verificação pós-fusão

- CBO: 17 colaboradores na linha oficial; CBO MACAÉ: 11. Zero colaboradores órfãos com texto "ALIANCA..."/"CBO SERVICOS..." sem `departamento_id`.
- Linhas absorvidas ficam Inativas (nunca excluídas — histórico).
- Com a fusão + `sincronizarDepartamentos` com match fuzzy (Parte 4), novas duplicadas não devem mais nascer nas importações do e-Contador.

---

# Parte 6 (noite) — reversão da emissão acidental dos recibos de 01/09/2026

> A usuária emitiu sem querer os recibos das entregas de 01/09/2026 (provavelmente via "Relatório em Lote" nos Relatórios CEU). Pedido: todas as entregas do dia voltam para "recibo a emitir".
> Executado via `scripts/reverter-recibos-2026-09-01.mjs` (dry-run por padrão). Backup em `dados-locais/backup_reversao_recibos_2026-09-01.json` (guards `numero_recibo` de cada uma, para eventual restauração).

## O que foi feito

- 175 entregas de 01/09/2026 estavam com `recibo_emitido = true` + `numero_recibo` — todas revertidas para `recibo_emitido = false`, `numero_recibo = NULL`. Verificado pós-execução: 175 com `recibo_emitido = false`, 0 com número.
- **Os números queimados na `ceu_recibo_seq` NÃO foram reaproveitados** (sequencial fiscal, migration 073) — a próxima emissão pega números novos, então haverá "salto" de numeração. Esperado e aceitável.
- Observação de UX possível para o futuro: o botão "Relatório em Lote" nos Relatórios CEU emite recibo de verdade (marca `recibo_emitido`) — se a emissão acidental se repetir, avaliar um ConfirmDialog explicando que a ação marca os recibos como emitidos.
- Mudança só de dados: sem deploy necessário.
