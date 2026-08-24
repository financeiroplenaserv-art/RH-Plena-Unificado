# Handoff — PerformanceLab (24/08/2026)

## Objetivo

Fazer a aba PerformanceLab refletir os dados atuais do PerformanceLab (PL),
corrigir o fuso horário exibido e manter o filtro inicial curto para uso diário.

## O que foi feito

- `src/lib/bi/agregacoes.ts`
  - Datas, horas e agrupamentos usam `America/Sao_Paulo`, independentemente do
    fuso configurado no computador.
  - `diaDe()` considera o dia civil de Brasília.
  - `horaDe()` e `fmtDT()` exibem horários brasileiros.
- `src/pages/bi/BiPerformanceLabPage.tsx`
  - Filtro padrão: últimos 5 dias, incluindo hoje.
  - Consultas manuais continuam podendo usar os 90 dias retidos no banco.
- `supabase/functions/sync-performancelab/index.ts`
  - Continua tratando o 404 de “Não foram encontrados ...” da API como lista
    vazia; outros 404 continuam sendo erro.
  - Consulta e reconcilia os últimos 90 dias.
  - Faz upsert dos registros retornados pelo PL.
  - Remove do CORH os registros que estão na janela de 90 dias, mas não foram
    mais retornados pelo PL: checklists, coletas, eventos e análises.
  - Remove também QAs de checklist quando o checklist correspondente é removido
    pela rotina de limpeza/reconciliação.
  - A exclusão ocorre em lotes de 500 IDs e falhas interrompem a execução para
    evitar uma conciliação silenciosamente incompleta.
- `supabase/migrations/104_reset_permissoes_bi.sql`
  - Recria `reset_permissoes_perfil()` incluindo `menu.bi` e `rota.bi`, para o
    botão “Restaurar padrão” não apagar a permissão do PerformanceLab.
- `AGENTS.md`
  - Documenta a reconciliação de 90 dias.

## Banco e produção

- Migration 104 aplicada no projeto Supabase `jmdjdogskvybsdjtmpmb`.
- Edge Function publicada com:

  ```bash
  npx supabase functions deploy sync-performancelab --no-verify-jwt --project-ref jmdjdogskvybsdjtmpmb
  ```

- Frontend publicado no site correto `plena-corh`.
- O job `sync-performancelab-diario` continua agendado para `30 9 * * *`, que
  corresponde a 06:30 no horário de Brasília.
- A conciliação manual foi forçada em 24/08/2026 usando o comando protegido do
  próprio job. A execução terminou com `ok = true` às 09:39 BRT e registrou:
  73 locais, 1 checklist, 267 coletas, 83 eventos e 72 análises.

## Validações

- `npx vitest run src/lib/bi`: 40 testes passaram.
- `npm run build`: passou.
- `git diff --check`: passou.
- Diagnósticos VS Code: sem erros nos arquivos alterados.
- Hash do bundle local conferido com o bundle servido pelo Netlify.

## Próximo agente

1. Conferir o próximo `bi_sync_log` após a execução diária.
2. Se houver divergência, comparar os IDs retornados pelo endpoint do PL com as
   tabelas `bi_eventos`, `bi_coletas` e `bi_checklists` dentro dos 90 dias.
3. Não colocar credenciais ou a chave do cron em commits, documentação ou saída
   de terminal. A chave do cron apareceu em histórico de diagnóstico anterior;
   recomenda-se rotacioná-la e recriar o job se esse histórico tiver sido
   compartilhado fora do ambiente seguro.