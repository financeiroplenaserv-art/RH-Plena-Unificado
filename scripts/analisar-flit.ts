import XLSX from '@e965/xlsx'
import fs from 'fs'
import path from 'path'

const arquivo = 'dados-locais/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx'
const caminho = path.resolve(arquivo)

console.log('Analisando:', caminho)

const buffer = fs.readFileSync(caminho)
const workbook = XLSX.read(buffer, { type: 'buffer' })
const sheetName = workbook.SheetNames[0]
const worksheet = workbook.Sheets[sheetName]
const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

console.log('\nTotal de linhas:', dados.length)
console.log('\nColunas encontradas:')
if (dados.length > 0) {
  console.log(Object.keys(dados[0]))
}

console.log('\n=== 5 primeiras linhas ===')
dados.slice(0, 5).forEach((row, i) => {
  console.log(`\nLinha ${i + 1}:`)
  Object.entries(row).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`)
  })
})

function valoresUnicos(coluna: string) {
  const valores = new Set<string>()
  dados.forEach((row) => {
    const v = row[coluna]
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      valores.add(String(v).trim())
    }
  })
  return Array.from(valores).sort()
}

console.log('\n=== Valores únicos por coluna ===')
if (dados.length > 0) {
  Object.keys(dados[0]).forEach((col) => {
    const valores = valoresUnicos(col)
    console.log(`\n${col} (${valores.length} valores):`)
    valores.slice(0, 30).forEach((v) => console.log(`  - ${v}`))
    if (valores.length > 30) console.log(`  ... e mais ${valores.length - 30} valores`)
  })
}
