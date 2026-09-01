# Aplicar Migration 102 — BI PerformanceLab

A migration `102_bi_performancelab.sql` cria as tabelas `bi_*`, a função
`pode_ver_bi_performancelab()`, as policies de RLS e os seeds de permissão
(`menu.bi` / `rota.bi`). Aplicada via `db query --linked` em 19/08/2026.

## 1. Secrets da Edge Function (já configurados em 19/08/2026)

```bash
mv .env .env.bak
npx supabase secrets set PLAB_LOGIN=<login> PLAB_SENHA=<senha> PLAB_TOKEN=<token> --project-ref jmdjdogskvybsdjtmpmb
npx supabase secrets set SYNC_CRON_KEY=<chave-aleatoria> --project-ref jmdjdogskvybsdjtmpmb
mv .env.bak .env
```

- `PLAB_*`: credenciais da conta `plena.powerbi` do PerformanceLab (valores com a Elaine; nunca no código).
- `SYNC_CRON_KEY`: chave aleatória (48 hex) que autoriza a chamada da function.
  O projeto usa as novas API keys do Supabase (`sb_secret_`/`sb_publishable_`),
  então o agendador **não** usa a service role — usa esta chave dedicada.

## 2. Teste manual do sync

```bash
curl -X POST "https://jmdjdogskvybsdjtmpmb.supabase.co/functions/v1/sync-performancelab" \
  -H "Authorization: Bearer <SYNC_CRON_KEY>" \
  -H "Content-Type: application/json" -d '{}'
```

Resposta esperada: `{"ok":true,"locais":N,"checklists":N,"coletas":N,"eventos":N,"analises":N}`.
Sem a chave correta retorna 401 (por desenho — é um job de máquina).

## 3. Agendamento diário (06h30, horário de Brasília) — já aplicado em 19/08/2026

Job `sync-performancelab-diario` (id 1, `30 9 * * *` UTC = 06h30 BRT) criado via
pg_cron. **Nota:** `alter database ... set app.sync_cron_key` foi negado por
permissão no Supabase hospedado — a `SYNC_CRON_KEY` vai **embutida no comando do
job** (tabela `cron.job`, só visível no banco), não como setting. SQL usado:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-performancelab-diario',
  '30 9 * * *',   -- UTC: 06h30 em Brasília
  $$
  select net.http_post(
    url := 'https://jmdjdogskvybsdjtmpmb.supabase.co/functions/v1/sync-performancelab',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SYNC_CRON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    -- OBRIGATÓRIO (correção de 01/09/2026): o sync leva ~35-40s (janela de 90
    -- dias) e o timeout padrão do pg_net é 5s — sem este parâmetro o cron
    -- aborta a requisição antes da function rodar e o sync para em silêncio
    -- (o job aparece "succeeded" em cron.job_run_details, mas nada é gravado).
    timeout_milliseconds := 150000
  );
  $$
);
```

**Correção aplicada em 01/09/2026:** o job foi atualizado com
`select cron.alter_job(job_id := 1, command := '...')` incluindo
`timeout_milliseconds := 150000`. Sempre que recriar/alterar o job, manter o
timeout. Diagnóstico completo: `net._http_response` mostrava
"Timeout of 5000 ms reached" em todas as execuções desde 25/08/2026 e
`bi_sync_log` não recebia linhas (a function nem era alcançada).

Verificar se agendou: `select jobid, jobname, schedule, active from cron.job;`
Ver execuções: `select * from cron.job_run_details order by start_time desc limit 10;`
Desagendar: `select cron.unschedule('sync-performancelab-diario');`

Se trocar a `SYNC_CRON_KEY` algum dia, é preciso recriar o job com a chave nova
(unschedule + schedule).

Fallback sem pg_cron: Agendador de Tarefas do Windows / GitHub Actions chamando
a URL do passo 2 todo dia 06h30.
