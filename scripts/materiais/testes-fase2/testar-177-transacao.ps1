# Executa a migration 177 + testes em transacao SEMPRE desfeita (nada persiste).

$migrationPath = Join-Path $PSScriptRoot '..\..\..\supabase\migrations\177_ceu_atender_lanca_entrega.sql'
$testesPath = Join-Path $PSScriptRoot '177_testes.sql'
$runnerPath = Join-Path $PSScriptRoot '..\..\lib\executar-arquivo-sql-management-api.ps1'

$corpo = [IO.File]::ReadAllText($migrationPath, [Text.Encoding]::UTF8)
$testes = [IO.File]::ReadAllText($testesPath, [Text.Encoding]::UTF8)
$consulta = "begin;`n" + $corpo + "`n" + $testes + "`nrollback;`n"
$temp = [IO.Path]::GetTempFileName()

try {
    [IO.File]::WriteAllText($temp, $consulta, [Text.Encoding]::UTF8)
    & $runnerPath -Arquivo $temp
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "A validacao da migration 177 falhou com codigo $LASTEXITCODE."
    }
} finally {
    Remove-Item $temp -ErrorAction SilentlyContinue
}
