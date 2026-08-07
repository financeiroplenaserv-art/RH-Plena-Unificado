import XLSX from '@e965/xlsx'
import fs from 'fs'
const wb = XLSX.read(fs.readFileSync('dados-locais/Marcacoes 01_06_2026 - 01_08_2026.xlsx'))
console.log('Abas:', wb.SheetNames)
for (const nome of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[nome], { defval: '' })
  console.log(`\n=== Aba "${nome}" — ${rows.length} linhas ===`)
  for (const r of rows) console.log(JSON.stringify(r))
}
