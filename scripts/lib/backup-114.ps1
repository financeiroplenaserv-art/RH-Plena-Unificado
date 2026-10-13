# Backup pre-migration 114: ferias_solicitacoes em JSON UTF-8.
# ASCII puro (PS 5.1).
. "$PSScriptRoot\cred-supabase.ps1"
$token = Get-SupabaseCliToken

$body = @{ query = "select string_agg(encode(convert_to(row_to_json(t)::text, 'UTF8'), 'base64'), ';') as linhas from (select * from ferias_solicitacoes order by created_at) t;" } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/jmdjdogskvybsdjtmpmb/database/query" `
    -Method Post -Headers @{ Authorization = "Bearer $token" } -ContentType "application/json" -Body $body

$linhas = @()
if ($resp[0].linhas) { $linhas = $resp[0].linhas -split ';' | Where-Object { $_ } }
$objs = $linhas | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
$json = "[" + ($objs -join ",`n") + "]"
[System.IO.File]::WriteAllText("$PSScriptRoot\..\..\dados-locais\backup_ferias_solicitacoes_114_2026-09-25.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("backup linhas: " + $linhas.Count)
