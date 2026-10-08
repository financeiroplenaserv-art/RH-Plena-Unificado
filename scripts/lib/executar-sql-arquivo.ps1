param(
    [Parameter(Mandatory = $true)]
    [string]$Query,
    [Parameter(Mandatory = $true)]
    [string]$Saida
)

# Variante do executar-sql-management-api.ps1 que grava o JSON CRU da resposta
# em arquivo UTF-8 — o Invoke-RestMethod do PowerShell 5.1 decodifica a resposta
# como Latin-1 e corrompe acentos (mojibake). Aqui os bytes são decodificados
# como UTF-8 manualmente via HttpWebRequest. O token nunca é impresso.

. "$PSScriptRoot\cred-supabase.ps1"
$token = Get-SupabaseCliToken

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$req = [Net.HttpWebRequest]::Create("https://api.supabase.com/v1/projects/jmdjdogskvybsdjtmpmb/database/query")
$req.Method = 'POST'
$req.Headers.Add('Authorization', "Bearer $token")
$req.ContentType = 'application/json; charset=utf-8'
$reqBody = [Text.Encoding]::UTF8.GetBytes((@{ query = $Query } | ConvertTo-Json))
$req.ContentLength = $reqBody.Length
$stream = $req.GetRequestStream()
$stream.Write($reqBody, 0, $reqBody.Length)
$stream.Close()
$resp = $req.GetResponse()
$leitor = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
$json = $leitor.ReadToEnd()
$leitor.Close()
$resp.Close()
$destino = Join-Path (Get-Location) $Saida
[IO.File]::WriteAllText($destino, $json, (New-Object Text.UTF8Encoding($false)))
Write-Output "ok: $Saida ($($json.Length) chars)"
