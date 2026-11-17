# Executa a migration 169 e os testes em transacao SEMPRE desfeita.
# Antes de rodar: fazer backup e obter autorizacao da gestora.
# Nao altera o banco ao final: o ultimo comando e ROLLBACK.

$migrationPath = Join-Path $PSScriptRoot '..\..\supabase\migrations\169_vt_identidade_temporalidade.sql'
$testesPath = Join-Path $PSScriptRoot 'testes\169_testes.sql'
$runnerPath = Join-Path $PSScriptRoot '..\lib\executar-arquivo-sql-management-api.ps1'

$migration = [IO.File]::ReadAllText($migrationPath, [Text.Encoding]::UTF8)
$testes = [IO.File]::ReadAllText($testesPath, [Text.Encoding]::UTF8)

$inicio = $migration.IndexOf('begin;')
$fim = $migration.LastIndexOf('commit;')
if ($inicio -lt 0 -or $fim -le $inicio) {
    throw 'Nao foi possivel localizar begin/commit na migration 169.'
}

$corpo = $migration.Substring($inicio + 6, $fim - $inicio - 6)
$consulta = "begin;`n" + $corpo + "`n" + $testes + "`nrollback;`n"
$temp = [IO.Path]::GetTempFileName()

try {
    [IO.File]::WriteAllText($temp, $consulta, [Text.Encoding]::UTF8)
    & $runnerPath -Arquivo $temp
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "A validacao da migration 169 falhou com codigo $LASTEXITCODE."
    }
} finally {
    Remove-Item $temp -ErrorAction SilentlyContinue
}
