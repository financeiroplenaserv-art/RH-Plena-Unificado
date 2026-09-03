param(
    [Parameter(Mandatory = $true)]
    [string]$Slug,

    [Parameter(Mandatory = $true)]
    [string]$Arquivo,

    # A sync-performancelab é job de máquina com chave própria (SYNC_CRON_KEY),
    # então o gateway NÃO pode exigir JWT (equivalente ao --no-verify-jwt do CLI)
    [bool]$VerifyJwt = $false
)

# Deploy de Edge Function pela Management API (POST .../functions/deploy),
# contornando o bloqueio do supabase.exe pelo Device Guard/Smart App Control.
# Token lido do Gerenciador de Credenciais (nunca impresso).

. "$PSScriptRoot\cred-supabase.ps1"
$token = Get-SupabaseCliToken

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

$nome = Split-Path $Arquivo -Leaf
$meta = @{ entrypoint_path = $nome; verify_jwt = $VerifyJwt; name = $Slug } | ConvertTo-Json -Compress

$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $token)

$content = New-Object System.Net.Http.MultipartFormDataContent
$metaContent = New-Object System.Net.Http.StringContent($meta, [Text.Encoding]::UTF8, 'application/json')
$content.Add($metaContent, 'metadata')
$bytes = [IO.File]::ReadAllBytes((Resolve-Path $Arquivo).Path)
$fileContent = [System.Net.Http.ByteArrayContent]::new($bytes)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/typescript')
$content.Add($fileContent, 'file', $nome)

$resp = $client.PostAsync("https://api.supabase.com/v1/projects/jmdjdogskvybsdjtmpmb/functions/deploy?slug=$Slug", $content).Result
$corpo = $resp.Content.ReadAsStringAsync().Result
Write-Host ("HTTP " + [int]$resp.StatusCode + " " + $resp.StatusCode)
Write-Host $corpo
if (-not $resp.IsSuccessStatusCode) { exit 1 }
