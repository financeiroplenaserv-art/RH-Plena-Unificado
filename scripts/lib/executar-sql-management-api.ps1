param(
    [Parameter(Mandatory = $true)]
    [string]$Query
)

# Lê o access token do Supabase CLI no Gerenciador de Credenciais do Windows
# (target "Supabase CLI:supabase") e executa a query via Management API.
# O token nunca é impresso.

. "$PSScriptRoot\cred-supabase.ps1"
$token = Get-SupabaseCliToken

$body = @{ query = $Query } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/jmdjdogskvybsdjtmpmb/database/query" `
    -Method Post `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $body
$resp | ConvertTo-Json -Depth 6
