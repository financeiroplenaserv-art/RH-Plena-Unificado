import fs from 'fs'
import path from 'path'
import XLSX from '@e965/xlsx'

async function buscar() {
  const arquivoPath = path.resolve('dados-locais/Marcacoes 01_06_2026 - 05_06_2026 (2).xlsx')
  const buffer = fs.readFileSync(arquivoPath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  const nomeBuscado = process.argv[2]?.toLowerCase() || 'cleonice'

  const encontrados = rows.filter((row) =>
    String(row['Colaborador'] || '').toLowerCase().includes(nomeBuscado)
  )

  console.log(`Encontradas ${encontrados.length} batidas para "${nomeBuscado}"`)
  encontrados.forEach((row) => {
    console.log('\n---')
    console.log('Colaborador:', row['Colaborador'])
    console.log('Matricula:', row['Matricula'])
    console.log('Data:', row['Data'])
    console.log('Hora:', row['Hora'])
    console.log('Dispositivo:', row['Dispositivo'])
    console.log('Nome do dispositivo:', row['Nome do dispositivo'])
    console.log('Departamento:', row['Departamento'])
    console.log('Escala:', row['Escala'])
    console.log('Perímetro:', row['Perímetro'])
  })
}

buscar().catch(console.error)
