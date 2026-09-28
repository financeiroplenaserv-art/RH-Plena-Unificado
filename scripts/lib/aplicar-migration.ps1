# Aplica uma migration via Management API (CLI bloqueado por Device Guard).
# Uso: powershell -File aplicar-migration.ps1 -Arquivo 113_ferias_funcoes_cobre_funcoes.sql
# Le o SQL como UTF-8 (obrigatorio no PS 5.1 por causa dos acentos).
# ATENCAO: manter este script em ASCII puro.
param(
    [Parameter(Mandatory = $true)]
    [string]$Arquivo
)

. "$PSScriptRoot\cred-supabase.ps1"
$token = Get-SupabaseCliToken

$caminho = "$PSScriptRoot\..\..\supabase\migrations\$Arquivo"
$sql = [System.IO.File]::ReadAllText($caminho, (New-Object System.Text.UTF8Encoding($false)))
$body = @{ query = $sql } | ConvertTo-Json
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

try {
    $resp = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/jmdjdogskvybsdjtmpmb/database/query" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $token" } `
        -ContentType "application/json; charset=utf-8" `
        -Body $bytes
    Write-Output "OK - migration aplicada sem erro: $Arquivo"
    $resp | ConvertTo-Json -Depth 4
} catch {
    Write-Output "ERRO ao aplicar migration: $Arquivo"
    Write-Output $_.Exception.Message
    if ($_.ErrorDetails.Message) { Write-Output $_.ErrorDetails.Message }
    exit 1
}
