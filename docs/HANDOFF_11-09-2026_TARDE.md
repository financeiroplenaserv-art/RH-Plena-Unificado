# Handoff — 11/09/2026 (tarde)

> Sessão: Adicionais — tornar visível a diferença entre "ponto importado" e
> "previsão da escala" no Calendário (opções A + B aprovadas pela gestão após
> análise de viabilidade). Migration 109 aplicada em produção.
> **Nada foi deployado no Netlify nesta sessão** — entra no próximo deploy
> agrupado (o deploy da manhã já levou os ajustes de ocorrências).

## 1) Problema analisado (sem mudança de regra de negócio)

- O espelho do Flit ("CORH - Adicionais e Ocorrências") tem o período
  completo no cabeçalho (ex.: 01/09 a 20/09), mas as linhas de dias param na
  data em que o PDF foi gerado (ex.: dia 15).
- A importação grava em `calendario_adicionais` **só os dias parseados**; o
  período do cabeçalho serve apenas para apagar o período antes de regravar.
- O Calendário (`AdicionaisCalendarioPage`) e o Relatório geram TODOS os dias
  do período e, para dia sem registro, inferem o status pela escala
  (`calcularStatusPorRegime`) — renderizado com a mesma cara de dado real
  (`__fallback: false`, decisão do projeto base para o calendário não parecer
  vazio antes da 1ª importação). Risco: fechar pagamento sobre importação
  parcial sem aviso.

## 2) O que foi implementado

**A. Dia inferido com estilo próprio** (`AdicionaisCalendarioPage.tsx`):
- `getDia` ganhou o flag `__inferido`: dia sem registro no banco, marcado
  **somente quando o vínculo já tem dados no período** (importação parcial).
  Vínculo sem nenhuma importação mantém o visual cheio (preserva o motivo do
  design original — planejar antes de importar).
- Render: borda tracejada, fundo branco, emoji esmaecido (opacity 0.4),
  tooltip "… (previsto pela escala — ponto ainda não importado)".
- Legenda ganhou chip não-clicável "⬜ Previsto pela escala (aguardando
  ponto)".

**B. Banner "Ponto importado até dd/mm"** (migration 109):
- `ponto_espelho_arquivos` ganhou `periodo_inicio`, `periodo_fim` e
  `ponto_ate` (date, null nos arquivos antigos) + policy de UPDATE com
  `is_editor()` (UPDATE não tinha policy — necessária para o app gravar os
  metadados).
- `ImportarPontoPage`: após o parse, grava os metadados via
  `atualizarMetadadosPeriodo(file, ...)` (best-effort, `console.error` sem
  bloquear). `ponto_ate` = `ultimoDiaPonto(espelhos)` (maior data com linha
  no PDF), helper novo em `importarEspelho.ts` com testes. Cobre todos os
  caminhos (upload novo, reenvio e "Usar este arquivo" — que até backfilla
  metadados de arquivo antigo ao ser reprocessado).
- Calendário: `buscarUltimoArquivoDoPeriodo(periodoInicio, periodoFim)`
  (arquivo mais recente cujo período do cabeçalho cobre o período da tela);
  se `ponto_ate < periodoFim`, banner âmbar com data, nome do arquivo,
  enviado em/por quem, e orientação de reimportar. Sem arquivo com metadados
  no período → sem banner (comportamento anterior intacto).

## 3) Banco (migration 109 — APLICADA em produção)

- Backup prévio: `dados-locais/backup_ponto_espelho_arquivos_109_2026-09-11.json`.
- Aplicada via `scripts/lib/executar-sql-management-api.ps1` (CLI bloqueado
  pelo Device Guard). **Pegadinha resolvida:** o `Get-Content -Raw` do
  PowerShell 5.1 precisa de `-Encoding UTF8` para SQL com acentos, senão o
  JSON do corpo quebra ("Expected ',' or '}'..."). Verificado:
  `information_schema` mostra as 3 colunas novas.

## 4) Verificações

- `tsc` ok, `npm run lint` ok, `npm test` ok (**402 testes, 34 arquivos**),
  `npm run build` ok.
- `AGENTS.md` atualizado (migration 109 na lista + regra "Importação parcial
  visível" no bullet de importação de ponto).

## Pendências

- **Deploy no Netlify NÃO foi feito** — agrupar com a próxima leva. O
  banner/dias tracejados só funcionam em produção depois do deploy (a
  migration já está aplicada; sem o frontend novo, as colunas ficam null e
  nada muda na tela — comportamento fail-safe).
- Comportamento começa a valer para espelhos importados **a partir desta
  versão**; arquivos antigos ganham metadados se forem reprocessados via
  "Usar este arquivo".
- `func-deployada.txt` (untracked, artefato local) segue fora de propósito.
