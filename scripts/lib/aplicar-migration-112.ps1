# Aplica a migration 112 via Management API (CLI bloqueado por Device Guard).
# Le o SQL como UTF-8 (obrigatorio no PowerShell 5.1 por causa dos acentos).
# ATENCAO: manter este script em ASCII puro (PS 5.1 quebra com acentos).
. "$PSScriptRoot\cred-supabase.ps1"
$token = Get-SupabaseCliToken

$sql = [System.IO.File]::ReadAllText("$PSScriptRoot\..\..\supabase\migrations\112_ferias_modulo_completo.sql", (New-Object System.Text.UTF8Encoding($false)))
$body = @{ query = $sql } | ConvertTo-Json
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

try {
    $resp = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/jmdjdogskvybsdjtmpmb/database/query" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $token" } `
        -ContentType "application/json; charset=utf-8" `
        -Body $bytes
    Write-Output "OK - migration aplicada sem erro"
    $resp | ConvertTo-Json -Depth 4
} catch {
    Write-Output "ERRO ao aplicar migration:"
    Write-Output $_.Exception.Message
    if ($_.ErrorDetails.Message) { Write-Output $_.ErrorDetails.Message }
    exit 1
}
