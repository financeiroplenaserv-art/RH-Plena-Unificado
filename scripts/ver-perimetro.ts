import XLSX from '@e965/xlsx'
import fs from 'fs'
import path from 'path'

const arquivo = 'dados-locais/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx'
const caminho = path.resolve(arquivo)

const buffer = fs.readFileSync(caminho)
const workbook = XLSX.read(buffer, { type: 'buffer' })
const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])

const valores = new Set<string>()
let vazios = 0
let preenchidos = 0

dados.forEach((row) => {
  const v = row['Perímetro']
  if (v === undefined || v === null || String(v).trim() === '') {
    vazios++
  } else {
    preenchidos++
    valores.add(String(v).trim())
  }
})

console.log('Total de linhas:', dados.length)
console.log('Perímetros vazios:', vazios)
console.log('Perímetros preenchidos:', preenchidos)
console.log('\nValores únicos de Perímetro:')
Array.from(valores).sort().forEach((v) => console.log(`- ${v}`))

console.log('\n=== Exemplos com perímetro preenchido ===')
dados
  .filter((row) => {
    const v = row['Perímetro']
    return v !== undefined && v !== null && String(v).trim() !== ''
  })
  .slice(0, 20)
  .forEach((row) => {
    console.log(`- ${row['Colaborador']} | Dispositivo: ${row['Dispositivo']} | Perímetro: ${row['Perímetro']} | Depto: ${row['Departamento']}`)
  })
