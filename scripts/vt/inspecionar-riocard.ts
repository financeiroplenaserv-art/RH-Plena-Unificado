import { readFileSync } from 'node:fs'
import * as XLSX from '@e965/xlsx'
const buf = readFileSync('dados-locais/Bilhete_Unico_Riocard.xlsx')
const wb = XLSX.read(buf)
console.log('Abas:', wb.SheetNames)
for (const nome of wb.SheetNames) {
  const ws = wb.Sheets[nome]
  const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  console.log('---', nome, '| linhas:', linhas.length)
  for (const l of linhas.slice(0, 8)) console.log(JSON.stringify(l))
}
