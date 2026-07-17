import { describe, it, expect } from 'vitest'
import XLSX from '@e965/xlsx'
import { parseWorkbookBinary, agruparBatidasPorDia, encontrarColaborador } from './importarFlit'
import { normalizarMatricula } from './normalizarTexto'
import type { Colaborador } from '@/types/database'

function criarWorkbook(dados: unknown[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(dados)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Marcações')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}

describe('importarFlit', () => {
  it('detecta colunas obrigatórias e parseia batidas do Flit', async () => {
    const dados = [
      ['Colaborador', 'Matricula', 'Data', 'Hora', 'Dispositivo', 'Nome do dispositivo', 'Perímetro', 'Departamento', 'Escala'],
      ['JOAO SILVA', '123', '05/06/2026', '22:01', 'flit multi', 'ENSEADA PARK MULT', '', 'ENSEADA PARK', '13:40 às 22:00h'],
    ]
    const buffer = criarWorkbook(dados)
    const dias = await parseWorkbookBinary(buffer)

    expect(dias).toHaveLength(1)
    expect(dias[0].nomeColaborador).toBe('JOAO SILVA')
    expect(dias[0].matricula).toBe('123')
    expect(dias[0].data).toBe('2026-06-05')
    expect(dias[0].batidas).toHaveLength(1)
    expect(dias[0].batidas[0].hora).toBe('22:01')
    expect(dias[0].tipoDispositivo).toBe('flit multi')
    expect(dias[0].nomeDispositivo).toBe('ENSEADA PARK MULT')
  })

  it('detecta colunas mesmo quando a primeira linha de dados tem células vazias', async () => {
    const dados = [
      ['Colaborador', 'Matricula', 'Data', 'Hora', 'Dispositivo', 'Nome do dispositivo', 'Perímetro', 'Departamento', 'Escala'],
      ['JOAO SILVA', '123', '05/06/2026', '22:01', 'flit multi', 'ENSEADA PARK MULT', '', 'ENSEADA PARK', '13:40 às 22:00h'],
      ['MARIA SOUZA', '456', '05/06/2026', '21:57', 'flit', '', 'LA RESERVE', 'PLENA TECH', '8:00 às 17:00h'],
    ]
    const buffer = criarWorkbook(dados)
    const dias = await parseWorkbookBinary(buffer)

    expect(dias).toHaveLength(2)
    expect(dias[1].perimetro).toBe('LA RESERVE')
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

  it('normaliza matrícula ignorando zeros à esquerda e caracteres não numéricos', () => {
    expect(normalizarMatricula('000772')).toBe('772')
    expect(normalizarMatricula('772')).toBe('772')
    expect(normalizarMatricula(' 772 ')).toBe('772')
    expect(normalizarMatricula('00077-2')).toBe('772')
    expect(normalizarMatricula('')).toBe('')
    expect(normalizarMatricula(null)).toBe('')
  })

  it('encontra colaborador mesmo com matrícula em formatos diferentes', () => {
    const colaboradores: Colaborador[] = [
      { id: 'acacio', matricula: '000772', nome_completo: 'ACACIO COUTINHO' } as Colaborador,
    ]
    expect(encontrarColaborador('ACACIO COUTINHO', '772', colaboradores)?.id).toBe('acacio')
    expect(encontrarColaborador('ACACIO COUTINHO', '000772', colaboradores)?.id).toBe('acacio')
    expect(encontrarColaborador('ACACIO COUTINHO', ' 000772 ', colaboradores)?.id).toBe('acacio')
  })

  it('parseia exportação do CORH com colunas Dia, Colaborador, Local de Trabalho', async () => {
    const dados = [
      ['Dia', 'Colaborador', 'Local de Trabalho', 'Fonte', 'Observacao'],
      ['20/06/2026', 'JORGE RODRIGUES DE ARAUJO (000917)', 'NOVAS CORES', 'Dispositivo fixo', ''],
      ['25/06/2026', 'GRACIANE NEVES DA SILVA MELO (000007)', 'CENTRAL PORTARIA REMOTA', 'Dispositivo fixo', ''],
    ]
    const buffer = criarWorkbook(dados)
    const dias = await parseWorkbookBinary(buffer)

    expect(dias).toHaveLength(2)
    expect(dias[0].nomeColaborador).toBe('JORGE RODRIGUES DE ARAUJO')
    expect(dias[0].matricula).toBe('000917')
    expect(dias[0].data).toBe('2026-06-20')
    expect(dias[0].localTrabalhoNome).toBe('NOVAS CORES')
    expect(dias[1].nomeColaborador).toBe('GRACIANE NEVES DA SILVA MELO')
    expect(dias[1].matricula).toBe('000007')
    expect(dias[1].data).toBe('2026-06-25')
    expect(dias[1].localTrabalhoNome).toBe('CENTRAL PORTARIA REMOTA')
  })

  it('rejeita arquivo com colunas desconhecidas', async () => {
    const dados = [
      ['Campo1', 'Campo2'],
      ['Valor1', 'Valor2'],
    ]
    const buffer = criarWorkbook(dados)
    await expect(parseWorkbookBinary(buffer)).rejects.toThrow('Colunas obrigatórias não encontradas')
  })
})
