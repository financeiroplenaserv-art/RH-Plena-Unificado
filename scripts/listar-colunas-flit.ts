import XLSX from '@e965/xlsx'
import fs from 'fs'
import path from 'path'

const arquivo = 'dados-locais/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx'
const caminho = path.resolve(arquivo)

const buffer = fs.readFileSync(caminho)
const workbook = XLSX.read(buffer, { type: 'buffer' })
const worksheet = workbook.Sheets[workbook.SheetNames[0]]

// Pega o range da planilha
const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')

console.log('Range da planilha:', worksheet['!ref'])
console.log('Última coluna:', range.e.c + 1)
console.log('Última linha:', range.e.r + 1)

// Lê a primeira linha com cabeçalhos
const headers: Record<string, string> = {}
for (let c = 0; c <= range.e.c; c++) {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c })
  const cell = worksheet[cellAddress]
  if (cell) {
    headers[cellAddress] = String(cell.v || '')
  }
}

console.log('\nTodas as colunas (com endereço da célula):')
Object.entries(headers).forEach(([cell, value]) => {
  console.log(`${cell}: ${value}`)
})

// Lê as primeiras 3 linhas completas
console.log('\n=== Primeiras 3 linhas completas ===')
for (let r = 1; r <= Math.min(3, range.e.r); r++) {
  console.log(`\nLinha ${r}:`)
  for (let c = 0; c <= range.e.c; c++) {
    const cellAddress = XLSX.utils.encode_cell({ r, c })
    const headerAddress = XLSX.utils.encode_cell({ r: 0, c })
    const cell = worksheet[cellAddress]
    const header = worksheet[headerAddress]
    if (header) {
      console.log(`  ${header.v}: ${cell ? cell.v : ''}`)
    }
  }
}
