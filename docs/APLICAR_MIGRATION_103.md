# Aplicar Migration 103 — BI: log de sync e limpeza

A migration `103_bi_sync_log_e_limpeza.sql` cria a tabela `bi_sync_log`
(um registro por execução do sync, lido pela página PerformanceLab para
mostrar "Sincronizado em ..." e alertar quando o sync falha ou atrasa) e a
função `bi_limpar_dados_antigos()` (retém 90 dias de histórico; o sync cobre
os últimos 35). Aplicada via `db query --linked` em 20/08/2026.

Na mesma sessão (20/08/2026), a Edge Function `sync-performancelab` recebeu
três mudanças e foi re-deployada:

```bash
mv .env .env.bak
npx supabase functions deploy sync-performancelab --no-verify-jwt --project-ref jmdjdogskvybsdjtmpmb
mv .env.bak .env
```

1. **Correção de fuso horário**: a API do PerformanceLab devolve data/hora no
   fuso de Brasília, sem indicador de fuso. O helper `dt()` gravava com `Z`
   (UTC), deixando tudo 3h adiantado — uma visita das 22:21 aparecia como
   19:21. Agora grava com `-03:00`. Confirmado com dados reais: os dois
   inspetores cobrem turnos complementares 06:00–17:00 e 14:00–23:00 (locais);
   gravados como UTC, pareciam turnos das 03:00 e das 11:00. O upsert do
   primeiro sync após o deploy corrigiu retroativamente todas as linhas da
   janela de 35 dias. No frontend, `diaDe()` (`src/lib/bi/agregacoes.ts`)
   passou a derivar o dia civil do fuso local (antes recortava a string ISO,
   ou seja, o dia UTC — com o fuso correto, visitas após 21h cairiam no dia
   seguinte).
2. **Log de execução**: sucesso e falha gravam uma linha em `bi_sync_log`.
   A página alerta em amarelo quando a última execução falhou ou quando o
   último sucesso tem mais de 26h (`statusSync` em `src/lib/bi/agregacoes.ts`).
3. **Limpeza automática**: ao fim do sync, `bi_limpar_dados_antigos()` apaga
   registros com mais de 90 dias das tabelas `bi_*` e do próprio log
   (na primeira execução, removeu 11 eventos antigos).

## Teste manual

```bash
curl -X POST "https://jmdjdogskvybsdjtmpmb.supabase.co/functions/v1/sync-performancelab" \
  -H "Authorization: Bearer <SYNC_CRON_KEY>" \
  -H "Content-Type: application/json" -d '{}'
```

Verificar o log: `select ok, executado_em, coletas, eventos from bi_sync_log order by id desc limit 5;`

O agendamento pg_cron (`sync-performancelab-diario`, 06h30 BRT) não muda —
ver `docs/APLICAR_MIGRATION_102.md`.
