import XLSX from '@e965/xlsx'
import fs from 'fs'
import path from 'path'

const arquivo = 'public/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx'
const caminho = path.resolve(arquivo)

const buffer = fs.readFileSync(caminho)
const workbook = XLSX.read(buffer, { type: 'buffer' })
const worksheet = workbook.Sheets[workbook.SheetNames[0]]
const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)

function valoresUnicos(coluna: string) {
  const valores = new Set<string>()
  dados.forEach((row) => {
    const v = row[coluna]
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      valores.add(String(v).trim())
    }
  })
  return Array.from(valores).sort((a, b) => a.localeCompare(b))
}

console.log('=== NOMES DE DISPOSITIVO ===')
valoresUnicos('Nome do dispositivo').forEach((v) => console.log(`- ${v}`))

console.log('\n=== DEPARTAMENTOS ===')
valoresUnicos('Departamento').forEach((v) => console.log(`- ${v}`))

console.log('\n=== EXEMPLOS FLIT (sem dispositivo fixo) ===')
const flits = dados.filter((row) => String(row['Dispositivo']).toLowerCase().trim() === 'flit')
flits.slice(0, 20).forEach((row) => {
  console.log(`- ${row['Colaborador']} | Depto: ${row['Departamento']} | Escala: ${row['Escala']}`)
})
