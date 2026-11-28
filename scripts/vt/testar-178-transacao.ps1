# Executa 178 + testes em transacao SEMPRE desfeita.

$migrationPath = Join-Path $PSScriptRoot '..\..\supabase\migrations\178_vt_escala_dias.sql'
$testesPath = Join-Path $PSScriptRoot 'testes\178_testes.sql'
$runnerPath = Join-Path $PSScriptRoot '..\lib\executar-arquivo-sql-management-api.ps1'

$corpo = [IO.File]::ReadAllText($migrationPath, [Text.Encoding]::UTF8)
$testes = [IO.File]::ReadAllText($testesPath, [Text.Encoding]::UTF8)
# Migration 2x (idempotencia) + testes, tudo desfeito no fim.
$consulta = "begin;`n" + $corpo + "`n" + $testes + "`n" + $corpo + "`nrollback;`n"
$temp = [IO.Path]::GetTempFileName()

try {
    [IO.File]::WriteAllText($temp, $consulta, [Text.Encoding]::UTF8)
    & $runnerPath -Arquivo $temp
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "A validacao da migration 178 falhou com codigo $LASTEXITCODE."
    }
} finally {
    Remove-Item $temp -ErrorAction SilentlyContinue
}
