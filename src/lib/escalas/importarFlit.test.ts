import { describe, it, expect } from 'vitest'
import XLSX from '@e965/xlsx'
import { parseWorkbookBinary, agruparBatidasPorDia, encontrarColaborador } from './importarFlit'
import type { Colaborador } from '@/types/database'

function criarWorkbook(dados: unknown[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(dados)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Marcações')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

describe('importarFlit', () => {
  it('detecta colunas obrigatórias e parseia batidas', async () => {
    const dados = [
      ['Colaborador', 'Matricula', 'Data', 'Hora', 'Dispositivo', 'Nome do dispositivo', 'Perímetro', 'Departamento', 'Escala'],
      ['JOAO SILVA', '123', '05/06/2026', '22:01', 'flit multi', 'ENSEADA PARK MULT', '', 'ENSEADA PARK', '13:40 às 22:00h'],
    ]
    const buffer = criarWorkbook(dados)
    const batidas = await parseWorkbookBinary(buffer)

    expect(batidas).toHaveLength(1)
    expect(batidas[0].nomeColaborador).toBe('JOAO SILVA')
    expect(batidas[0].matricula).toBe('123')
    expect(batidas[0].data).toBe('2026-06-05')
    expect(batidas[0].hora).toBe('22:01')
    expect(batidas[0].tipoDispositivo).toBe('flit multi')
    expect(batidas[0].nomeDispositivo).toBe('ENSEADA PARK MULT')
  })

  it('detecta colunas mesmo quando a primeira linha de dados tem células vazias', async () => {
    const dados = [
      ['Colaborador', 'Matricula', 'Data', 'Hora', 'Dispositivo', 'Nome do dispositivo', 'Perímetro', 'Departamento', 'Escala'],
      ['JOAO SILVA', '123', '05/06/2026', '22:01', 'flit multi', 'ENSEADA PARK MULT', '', 'ENSEADA PARK', '13:40 às 22:00h'],
      ['MARIA SOUZA', '456', '05/06/2026', '21:57', 'flit', '', 'LA RESERVE', 'PLENA TECH', '8:00 às 17:00h'],
    ]
    const buffer = criarWorkbook(dados)
    const batidas = await parseWorkbookBinary(buffer)

    expect(batidas).toHaveLength(2)
    expect(batidas[1].perimetro).toBe('LA RESERVE')
  })

  it('agrupa batidas por dia e mantém dispositivo multi como prioridade', () => {
    const batidas = [
      {
        nomeColaborador: 'JOAO',
        matricula: '1',
        dataHora: new Date(2026, 5, 5, 8, 0),
        data: '2026-06-05',
        hora: '08:00',
        tipoDispositivo: 'flit',
        nomeDispositivo: '',
        perimetro: '',
        departamento: 'DEPT',
        turno: 'TURNO',
      },
      {
        nomeColaborador: 'JOAO',
        matricula: '1',
        dataHora: new Date(2026, 5, 5, 22, 0),
        data: '2026-06-05',
        hora: '22:00',
        tipoDispositivo: 'flit multi',
        nomeDispositivo: 'ENSEADA PARK MULT',
        perimetro: '',
        departamento: 'DEPT',
        turno: 'TURNO',
      },
    ] as const

    const dias = agruparBatidasPorDia(batidas as unknown as import('./importarFlit').BatidaFlit[])
    expect(dias).toHaveLength(1)
    expect(dias[0].tipoDispositivo).toBe('flit multi')
    expect(dias[0].nomeDispositivo).toBe('ENSEADA PARK MULT')
    expect(dias[0].batidas).toHaveLength(2)
  })

  it('encontra colaborador por matrícula', () => {
    const colaboradores: Colaborador[] = [
      { id: '1', matricula: '123', nome_completo: 'JOAO SILVA' } as Colaborador,
    ]
    const encontrado = encontrarColaborador('NOME DIFERENTE', '123', colaboradores)
    expect(encontrado?.id).toBe('1')
  })

  it('encontra colaborador por nome', () => {
    const colaboradores: Colaborador[] = [
      { id: '1', matricula: '999', nome_completo: 'JOAO SILVA' } as Colaborador,
    ]
    const encontrado = encontrarColaborador('JOAO SILVA', '', colaboradores)
    expect(encontrado?.id).toBe('1')
  })
})
