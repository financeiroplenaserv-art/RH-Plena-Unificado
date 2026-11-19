# Executa 174 (2x, idempotencia) + testes em transacao SEMPRE desfeita.

$migrationPath = Join-Path $PSScriptRoot '..\..\supabase\migrations\174_vt_excecao_tarifa_cheia.sql'
$testesPath = Join-Path $PSScriptRoot 'testes\174_testes.sql'
$runnerPath = Join-Path $PSScriptRoot '..\lib\executar-arquivo-sql-management-api.ps1'

$corpo = [IO.File]::ReadAllText($migrationPath, [Text.Encoding]::UTF8)
$testes = [IO.File]::ReadAllText($testesPath, [Text.Encoding]::UTF8)
$consulta = "begin;`n" + $corpo + "`n" + $corpo + "`n" + $testes + "`nrollback;`n"
$temp = [IO.Path]::GetTempFileName()

try {
    [IO.File]::WriteAllText($temp, $consulta, [Text.Encoding]::UTF8)
    & $runnerPath -Arquivo $temp
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "A validacao da migration 174 falhou com codigo $LASTEXITCODE."
    }
} finally {
    Remove-Item $temp -ErrorAction SilentlyContinue
}
