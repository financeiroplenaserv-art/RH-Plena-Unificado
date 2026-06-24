import * as XLSX from '@e965/xlsx'
import type { VRColaboradorEscala, VREscalaDia } from '@/types'

export function parseExcelEscala(arrayBuffer: ArrayBuffer): VRColaboradorEscala[] {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

  if (jsonData.length < 2) return []

  // Encontrar a linha do cabecalho (contem "Colaborador")
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    if (jsonData[i] && jsonData[i][0] && String(jsonData[i][0]).toLowerCase().includes('colaborador')) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return []

  const headerRow = jsonData[headerRowIndex]

  // Encontrar coluna "Colaborador"
  const nomeIndex = headerRow.findIndex((h: unknown) => String(h).toLowerCase().includes('colaborador'))
  const empresaIndex = headerRow.findIndex((h: unknown) => String(h).toLowerCase().includes('empresa'))
  const departamentoIndex = headerRow.findIndex((h: unknown) => String(h).toLowerCase().includes('departamento'))
  const cargoIndex = headerRow.findIndex((h: unknown) => String(h).toLowerCase().includes('cargo'))
  const horarioIndex = headerRow.findIndex((h: unknown) => String(h).toLowerCase().includes('horario'))
  const firstDateIndex = Math.max(nomeIndex, empresaIndex, departamentoIndex, cargoIndex, horarioIndex) + 1

  // Buscar coluna de matricula (aceita variações)
  const matriculaIndex = headerRow.findIndex((h: unknown) => {
    if (!h) return false
    const s = String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return s.includes('matricula') || s.includes('codigo') || s === 'id' || s.includes('numero') || s.includes('registro') || s.includes('nº')
  })

  // Extrair datas dos cabecalhos
  const datasColunas: { index: number; data: string }[] = []
  for (let col = firstDateIndex; col < headerRow.length; col++) {
    const cellValue = headerRow[col]
    if (cellValue) {
      const strValue = String(cellValue).trim()
      const dateMatch = strValue.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (dateMatch) {
        datasColunas.push({
          index: col,
          data: dateMatch[0]
        })
      }
    }
  }

  const colaboradores: VRColaboradorEscala[] = []

  for (let row = headerRowIndex + 1; row < jsonData.length; row++) {
    const rowData = jsonData[row]
    if (!rowData || !rowData[nomeIndex]) continue

    const nomeRaw = String(rowData[nomeIndex])
    const nome = nomeRaw.replace(/\s*-\s*\d{3}\.\d{3}\.\d{3}-\d{2}$/, '').trim()
    const cpf = extrairCPF(nomeRaw)
    const cargo = cargoIndex >= 0 && rowData[cargoIndex] ? String(rowData[cargoIndex]) : ''
    const matricula = matriculaIndex >= 0 && rowData[matriculaIndex] ? String(rowData[matriculaIndex]).trim() : ''

    const dias: VREscalaDia[] = []

    for (const { index: colIndex, data } of datasColunas) {
      if (colIndex >= rowData.length) continue
      const cellValue = rowData[colIndex]
      if (!cellValue) continue

      const valor = String(cellValue).trim()
      let tipo: VREscalaDia['tipo'] = ''
      let minutosTrabalhados = 0

      if (valor.includes('[T]')) {
        tipo = 'T'
        const horariosMatch = valor.match(/\d{2}:\d{2}/g)
        if (horariosMatch && horariosMatch.length >= 2) {
          if (horariosMatch.length >= 4) {
            // Com descanso: 07:00 - 12:00 - 13:00 - 15:20
            const m1 = calcularMinutos(horariosMatch[0], horariosMatch[1])
            const m2 = calcularMinutos(horariosMatch[2], horariosMatch[3])
            minutosTrabalhados = m1 + m2
          } else {
            // Sem descanso: 07:00 - 12:00
            minutosTrabalhados = calcularMinutos(horariosMatch[0], horariosMatch[horariosMatch.length - 1])
          }
        }
      } else if (valor.includes('[F]') && !valor.includes('[FR]')) {
        tipo = 'F'
      } else if (valor.includes('[FR]')) {
        tipo = 'FR'
      } else if (valor.includes('[AF]')) {
        tipo = 'AF'
      } else if (valor.includes('[AT]')) {
        tipo = 'AT'
      }

      dias.push({ data, tipo, minutosTrabalhados })
    }

    if (dias.length > 0) {
      colaboradores.push({
        colaborador: { nome, cpf, cargo, matricula },
        dias
      })
    }
  }

  return colaboradores
}

function calcularMinutos(inicio: string, fim: string): number {
  const [h1, m1] = inicio.split(':').map(Number)
  const [h2, m2] = fim.split(':').map(Number)
  let min = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (min < 0) min += 24 * 60
  return min
}

function extrairCPF(nomeRaw: string): string {
  const match = nomeRaw.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})$/)
  return match ? match[1].replace(/[.-]/g, '') : ''
}

export function normalizarNomeVR(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}
