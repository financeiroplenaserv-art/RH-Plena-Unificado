# Aplicar sync agendado do e-Contador

A Edge Function `sync-econtador` importa automaticamente colaboradores das
empresas Plena EA e Plena Tech. Ela reaproveita as regras da importação manual,
mas grava com `service_role` e registra cada execução no histórico com
`usuario_id = null`, exibido como **Automático (agendado)**.

**Status em 08/09/2026:** deploy aplicado, secret configurada e job
`sync-econtador-diario` ativo no pg_cron (jobid `6`).

## 1. Secrets

`ENCRYPTION_KEY` já precisa existir para a function `econtador`. A nova chave
`ECONTADOR_CRON_KEY` deve ser dedicada ao job e nunca deve ser commitada:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/lib/definir-secret.ps1 `
  -Nome ECONTADOR_CRON_KEY `
  -SalvarEm "$env:TEMP\econtador-cron-key.txt"
```

O arquivo temporário guarda a chave para o teste e para montar o SQL do cron.
Não o copie para o repositório nem o coloque no frontend.

## 2. Deploy

O gateway precisa aceitar a chave de máquina, portanto `verify_jwt` deve ficar
desativado:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/lib/implantar-edge-function.ps1 `
  -Slug sync-econtador `
  -Arquivo supabase/functions/sync-econtador/index.ts
```

## 3. Teste manual

Primeiro teste uma empresa específica. Substitua `<ID_ALTERDATA>` e leia a
chave do arquivo temporário sem exibi-la no terminal:

```powershell
$chave = Get-Content "$env:TEMP\econtador-cron-key.txt"
Invoke-RestMethod `
  -Method Post `
  -Uri "https://jmdjdogskvybsdjtmpmb.supabase.co/functions/v1/sync-econtador?empresa=<ID_ALTERDATA>" `
  -Headers @{ Authorization = "Bearer $chave"; "Content-Type" = "application/json" } `
  -Body '{}'
```

Resposta esperada: `ok: true`, com os totais por empresa. A chamada sem a chave
correta deve retornar HTTP 401.

## 4. Agendamento

03h30 em Brasília corresponde a `30 6 * * *` em UTC. O timeout de 150 segundos
é obrigatório porque a importação busca e grava muitos colaboradores:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-econtador-diario',
  '30 6 * * *',
  $$
  select net.http_post(
    url := 'https://jmdjdogskvybsdjtmpmb.supabase.co/functions/v1/sync-econtador',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <ECONTADOR_CRON_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
```

O placeholder `<ECONTADOR_CRON_KEY>` deve ser substituído pela chave real
somente no SQL enviado à Management API ou ao SQL Editor. Nunca grave a chave
real neste arquivo.

Verificação:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'sync-econtador-diario';

select *
from cron.job_run_details
where jobname = 'sync-econtador-diario'
order by start_time desc
limit 5;
```

Para remover o job: `select cron.unschedule('sync-econtador-diario');`.

Se a execução das duas empresas ultrapassar o limite, use dois jobs com o
parâmetro `?empresa=<ID_ALTERDATA>`, mantendo o mesmo timeout.