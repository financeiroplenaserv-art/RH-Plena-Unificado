# Atualiza o secret PLAB_SENHA no Supabase e dispara um sync de teste do
# PerformanceLab. A senha e digitada na tela (nao passa pelo chat, nao fica
# em arquivo e nunca e impressa).
# ATENCAO: manter este arquivo SOMENTE com caracteres ASCII (sem acentos),
# senao o Windows PowerShell 5.1 le o arquivo com a codificacao errada e
# quebra o parser.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\atualizar-senha-plab.ps1
#
# Pre-requisito: token do Supabase CLI no Gerenciador de Credenciais do
# Windows (mesmo usado pelos scripts lib/cred-supabase.ps1).

$ErrorActionPreference = "Stop"
$projeto = "jmdjdogskvybsdjtmpmb"

. "$PSScriptRoot\lib\cred-supabase.ps1"

# 1) Pede a senha nova na tela
$senhaSegura = Read-Host "Digite a NOVA senha da conta plena.powerbi do PerformanceLab" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senhaSegura)
$senhaTexto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ([string]::IsNullOrEmpty($senhaTexto)) { throw "Senha vazia - nada foi alterado." }

$token = Get-SupabaseCliToken

# 2) Atualiza o secret PLAB_SENHA (JSON montado a mao para garantir array
#    de um elemento e escapar caracteres especiais da senha)
$valorJson = $senhaTexto | ConvertTo-Json
$senhaTexto = $null
$body = "[{`"name`":`"PLAB_SENHA`",`"value`":$valorJson}]"
Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projeto/secrets" `
    -Method Post `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $body | Out-Null
Write-Host "Secret PLAB_SENHA atualizado no Supabase."

# 3) Busca a chave do cron (SYNC_CRON_KEY) no comando do job agendado
$query = "select command from cron.job where jobname like 'sync-performancelab%' limit 1"
$bodySql = @{ query = $query } | ConvertTo-Json
$respSql = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projeto/database/query" `
    -Method Post `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $bodySql
$comando = $respSql[0].command
if ($comando -match 'Bearer ([^"'']+)') {
    $cronKey = $Matches[1]
} else {
    throw "Nao encontrei o Bearer do cron no comando do job."
}

# 4) Dispara o sync de teste (com retentativa: instancias quentes da Edge
#    Function podem demorar alguns segundos para enxergar o secret novo)
$url = "https://$projeto.supabase.co/functions/v1/sync-performancelab"
$tentativas = 3
for ($i = 1; $i -le $tentativas; $i++) {
    Write-Host "Disparando sync de teste (tentativa $i de $tentativas)..."
    try {
        $r = Invoke-RestMethod -Uri $url -Method Post `
            -Headers @{ Authorization = "Bearer $cronKey" } `
            -ContentType "application/json" `
            -Body '{}' -TimeoutSec 240
        Write-Host "SUCESSO - sync concluido:"
        $r | ConvertTo-Json -Depth 6
        Write-Host "Confira o selo 'Sincronizado em...' na pagina PerformanceLab."
        exit 0
    } catch {
        $corpo = ""
        if ($_.Exception.Response) {
            $leitor = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $corpo = $leitor.ReadToEnd()
            $leitor.Close()
        }
        Write-Host "Falhou: $corpo"
        if ($corpo -match 'Unauthorized' -and $i -lt $tentativas) {
            Write-Host "Aguardando 30s para o secret propagar e tentando de novo..."
            Start-Sleep -Seconds 30
        } elseif ($i -lt $tentativas) {
            Start-Sleep -Seconds 10
        }
    }
}

Write-Host ""
Write-Host "O sync continua falhando apos $tentativas tentativas."
Write-Host "Se o erro for 401/Unauthorized, a senha informada tambem esta sendo"
Write-Host "recusada pelo PerformanceLab - nesse caso o problema pode ser o"
Write-Host "PLAB_TOKEN (pedir token novo ao suporte do PL) ou a conta bloqueada."
exit 1
