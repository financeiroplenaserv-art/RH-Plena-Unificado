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
