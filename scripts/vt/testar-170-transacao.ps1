# Executa 169 + 170 + testes em transacao SEMPRE desfeita.
# Antes de rodar: fazer backup e obter autorizacao da gestora.

$migration169Path = Join-Path $PSScriptRoot '..\..\supabase\migrations\169_vt_identidade_temporalidade.sql'
$migration170Path = Join-Path $PSScriptRoot '..\..\supabase\migrations\170_vt_lotes_carga_transacionais.sql'
$testesPath = Join-Path $PSScriptRoot 'testes\170_testes.sql'
$runnerPath = Join-Path $PSScriptRoot '..\lib\executar-arquivo-sql-management-api.ps1'

function Get-Corpo([string]$path) {
    $sql = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
    $inicio = $sql.IndexOf('begin;')
    $fim = $sql.LastIndexOf('commit;')
    if ($inicio -lt 0 -or $fim -le $inicio) {
        throw "Nao foi possivel localizar begin/commit em $path."
    }
    return $sql.Substring($inicio + 6, $fim - $inicio - 6)
}

$corpo169 = Get-Corpo $migration169Path
$corpo170 = Get-Corpo $migration170Path
$testes = [IO.File]::ReadAllText($testesPath, [Text.Encoding]::UTF8)
$consulta = "begin;`n" + $corpo169 + "`n" + $corpo170 + "`n" + $testes + "`nrollback;`n"
$temp = [IO.Path]::GetTempFileName()

try {
    [IO.File]::WriteAllText($temp, $consulta, [Text.Encoding]::UTF8)
    & $runnerPath -Arquivo $temp
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        throw "A validacao da migration 170 falhou com codigo $LASTEXITCODE."
    }
} finally {
    Remove-Item $temp -ErrorAction SilentlyContinue
}
