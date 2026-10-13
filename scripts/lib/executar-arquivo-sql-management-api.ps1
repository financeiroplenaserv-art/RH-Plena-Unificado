param(
    [Parameter(Mandatory = $true)]
    [string]$Arquivo
)

# Variante do executar-sql-management-api.ps1 que lê o SQL de um ARQUIVO UTF-8
# e envia o corpo codificado em UTF-8 — passar SQL com acentos inline no -Query
# corrompe os caracteres (PowerShell 5.1). Mesma base do executar-sql-arquivo.ps1.
# O token nunca é impresso.

. "$PSScriptRoot\cred-supabase.ps1"
$token = Get-SupabaseCliToken

$sql = [IO.File]::ReadAllText((Resolve-Path $Arquivo), [Text.Encoding]::UTF8)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$req = [Net.HttpWebRequest]::Create("https://api.supabase.com/v1/projects/jmdjdogskvybsdjtmpmb/database/query")
$req.Method = 'POST'
$req.Headers.Add('Authorization', "Bearer $token")
$req.ContentType = 'application/json; charset=utf-8'
$reqBody = [Text.Encoding]::UTF8.GetBytes((@{ query = $sql } | ConvertTo-Json))
$req.ContentLength = $reqBody.Length
$stream = $req.GetRequestStream()
$stream.Write($reqBody, 0, $reqBody.Length)
$stream.Close()
try {
    $resp = $req.GetResponse()
    $leitor = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
    $json = $leitor.ReadToEnd()
    $leitor.Close()
    $resp.Close()
    Write-Output "ok: $json"
} catch [Net.WebException] {
    $erroResp = $_.Exception.Response
    $leitor = New-Object IO.StreamReader($erroResp.GetResponseStream(), [Text.Encoding]::UTF8)
    Write-Output "erro: $($leitor.ReadToEnd())"
    exit 1
}
