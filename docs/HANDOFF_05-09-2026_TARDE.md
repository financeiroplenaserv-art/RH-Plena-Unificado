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
