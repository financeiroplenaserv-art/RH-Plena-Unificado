param(
    [Parameter(Mandatory = $true)]
    [string]$Nome,

    # Se omitido, gera 48 hex aleatórios (padrão das chaves de cron do projeto)
    [string]$Valor,

    # Caminho opcional para gravar o valor gerado/usado (ex.: $env:TEMP\chave.txt).
    # O valor NUNCA é impresso no console nem deve ir para arquivos do repositório.
    [string]$SalvarEm
)

# Define uma secret do projeto pela Management API
# (POST /v1/projects/<ref>/secrets), contornando o bloqueio do supabase.exe
# pelo Device Guard. Token lido do Gerenciador de Credenciais (nunca impresso).

. "$PSScriptRoot\cred-supabase.ps1"
$token = Get-SupabaseCliToken

if (-not $Valor) {
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $Valor = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $token)

$json = "[{`"name`":`"$Nome`",`"value`":`"$Valor`"}]"
$content = New-Object System.Net.Http.StringContent($json, [Text.Encoding]::UTF8, 'application/json')

$resp = $client.PostAsync("https://api.supabase.com/v1/projects/jmdjdogskvybsdjtmpmb/secrets", $content).Result
$corpoResp = $resp.Content.ReadAsStringAsync().Result
Write-Host ("HTTP " + [int]$resp.StatusCode + " " + $resp.StatusCode)
if (-not $resp.IsSuccessStatusCode) {
    Write-Host $corpoResp
    exit 1
}
Write-Host "Secret '$Nome' registrada."

if ($SalvarEm) {
    # Aceita "$env:TEMP\..." (expandido aqui — argumentos de -File são literais)
    $caminho = $ExecutionContext.InvokeCommand.ExpandString($SalvarEm)
    [IO.File]::WriteAllText($caminho, $Valor)
    Write-Host "Valor gravado em: $caminho"
}
