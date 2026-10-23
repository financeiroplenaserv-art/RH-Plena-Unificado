import { describe, expect, it } from 'vitest'
import {
  casarColaboradores,
  coberturaDoMesNoRelatorio,
  parseGestaoEscalas,
  periodosDeFerias,
} from '@/lib/vt/gestaoEscalasFlit'

// Formato real do relatório "Gestão de escalas" do Flit (validado com o
// arquivo da gestora, 21/10/2026).

const CABECALHO = [
  'Colaborador',
  'Empresa',
  'Departamento',
  'Cargo',
  'Horário',
  '29/10/2026 - Qui.',
  '30/10/2026 - Sex.',
  '31/10/2026 - Sáb.',
  '01/11/2026 - Dom.',
]

const JOAO = [
  'João da Silva',
  'PLENA',
  'CONDOMINIO DO EDIFICIO BACK ART RESIDENTE',
  'Vigia',
  '7:00 às 19:00hs BACK ART - 12X36 - (ÍMPAR)',
  '[T] 07:00 - 12:00 - 13:00 - 19:00',
  '[F]',
  '[FR]',
  '[FR]',
]

describe('parseGestaoEscalas', () => {
  it('parseia cabeçalho de dias para ISO e marcas das células', () => {
    const [joao] = parseGestaoEscalas([CABECALHO, JOAO])
    expect(joao.nome).toBe('João da Silva')
    expect(joao.departamentoTexto).toBe('CONDOMINIO DO EDIFICIO BACK ART RESIDENTE')
    expect(joao.cargo).toBe('Vigia')
    expect(joao.horario).toContain('BACK ART')
    expect(joao.dias).toEqual([
      { data: '2026-10-29', marca: 'trabalha', texto: '[T] 07:00 - 12:00 - 13:00 - 19:00' },
      { data: '2026-10-30', marca: 'folga', texto: '[F]' },
      { data: '2026-10-31', marca: 'ferias', texto: '[FR]' },
      { data: '2026-11-01', marca: 'ferias', texto: '[FR]' },
    ])
  })

  it('[AF] afastado, [AT] atestado, vazio e marca desconhecida não são trabalho', () => {
    const [p] = parseGestaoEscalas([CABECALHO, ['Maria', 'PLENA', 'CBO', 'ASG', '', '[AF]', '[AT]', '', '[X] algo']])
    expect(p.dias.map((d) => d.marca)).toEqual(['afastado', 'atestado', 'vazio', 'vazio'])
  })

  it('linha sem nome é ignorada', () => {
    const pessoas = parseGestaoEscalas([CABECALHO, ['', 'PLENA', 'CBO', '', '', '[T]', '', '', ''], JOAO])
    expect(pessoas).toHaveLength(1)
  })

  it('rodapé de legenda do Flit (sem empresa e sem departamento) não vira pessoa', () => {
    const pessoas = parseGestaoEscalas([
      CABECALHO,
      JOAO,
      ['', '', '', '', '', '', '', '', ''],
      ['Legenda das escalas:', '', '', '', '', '', '', '', ''],
      ['[AF] - Afastado', '[AT] - Atestado', '[FR] - Férias', '[F] - Folga', '[T] - Trabalho', '', '', '', ''],
    ])
    expect(pessoas.map((p) => p.nome)).toEqual(['João da Silva'])
  })
})

describe('periodosDeFerias', () => {
  it('blocos contíguos de férias viram períodos; folga no meio quebra o bloco', () => {
    const [joao] = parseGestaoEscalas([CABECALHO, JOAO])
    expect(periodosDeFerias(joao.dias)).toEqual([{ inicio: '2026-10-31', fim: '2026-11-01', diasIntercalados: 0 }])
  })

  it('buraco de 1 dia de trabalho mescla os blocos em um período só', () => {
    const [p] = parseGestaoEscalas([
      CABECALHO,
      ['Ana', 'PLENA', 'CBO', '', '', '[FR]', '[T]', '[FR]', '[FR]'],
    ])
    // buraco de 1 dia (30/10): mescla 29/10–01/11 com 1 dia intercalado
    expect(periodosDeFerias(p.dias)).toEqual([
      { inicio: '2026-10-29', fim: '2026-11-01', diasIntercalados: 1 },
    ])
  })

  // Casos reais do relatório gestao_escalas_2210.xlsx (22/10/2026).

  it('caso LEANDRO: [FR] 10–11, [F] 12, [FR] 13–14, [T] 15, [FR] 16–30 → 1 período 10–30 com 2 intercalados', () => {
    const marcas = ['[FR]', '[FR]', '[F]', '[FR]', '[FR]', '[T]', ...Array(15).fill('[FR]')]
    const cabecalho = ['Colaborador', 'Empresa', 'Departamento', 'Cargo', 'Horário',
      ...Array.from({ length: 21 }, (_, i) => `${String(10 + i).padStart(2, '0')}/11/2026 - .`)]
    const [p] = parseGestaoEscalas([cabecalho, ['Leandro', 'PLENA', 'CBO', '', '', ...marcas]])
    expect(periodosDeFerias(p.dias)).toEqual([
      { inicio: '2026-11-10', fim: '2026-11-30', diasIntercalados: 2 },
    ])
  })

  it('caso LOURENE: [FR] 1–11, [T] 12, [FR] 13–23, [T] 24, [F] 25, [T] 26–30 → 1 período 1–23 com 1 intercalado', () => {
    const marcas = [...Array(11).fill('[FR]'), '[T]', ...Array(11).fill('[FR]'), '[T]', '[F]', '[T]', '[T]', '[T]', '[T]', '[T]']
    const cabecalho = ['Colaborador', 'Empresa', 'Departamento', 'Cargo', 'Horário',
      ...Array.from({ length: 30 }, (_, i) => `${String(1 + i).padStart(2, '0')}/11/2026 - .`)]
    const [p] = parseGestaoEscalas([cabecalho, ['Lourene', 'PLENA', 'CBO', '', '', ...marcas]])
    expect(periodosDeFerias(p.dias)).toEqual([
      { inicio: '2026-11-01', fim: '2026-11-23', diasIntercalados: 1 },
    ])
  })

  it('buraco de 3+ dias NÃO mescla (é outra férias ou volta real)', () => {
    const marcas = ['[FR]', '[F]', '[F]', '[F]', '[FR]', '[FR]']
    const cabecalho = ['Colaborador', 'Empresa', 'Departamento', 'Cargo', 'Horário',
      ...Array.from({ length: 6 }, (_, i) => `${String(1 + i).padStart(2, '0')}/11/2026 - .`)]
    const [p] = parseGestaoEscalas([cabecalho, ['Ana', 'PLENA', 'CBO', '', '', ...marcas]])
    expect(periodosDeFerias(p.dias)).toEqual([
      { inicio: '2026-11-01', fim: '2026-11-01', diasIntercalados: 0 },
      { inicio: '2026-11-05', fim: '2026-11-06', diasIntercalados: 0 },
    ])
  })
})

describe('casarColaboradores (nunca palpite)', () => {
  const colaboradores = [
    { id: 'c1', nome_completo: 'JOÃO  DA   SILVA', status: 'Ativo' }, // espaços duplos
    { id: 'c2', nome_completo: 'Maria Souza', status: 'Ativo' },
    { id: 'c3', nome_completo: 'João da Silva', status: 'Inativo' }, // inativo não casa
    { id: 'c4', nome_completo: 'ANA MARIA', status: 'Ativo' },
    { id: 'c5', nome_completo: 'Ana Maria', status: 'Ativo' }, // homônima: 2 ativos
  ]

  it('casa ignorando acento, caixa e espaços duplos', () => {
    const m = casarColaboradores(['João da Silva', 'MARIA souza'], colaboradores)
    expect(m.get('João da Silva')).toEqual({ id: 'c1' })
    expect(m.get('MARIA souza')).toEqual({ id: 'c2' })
  })

  it('sem match ou duplicidade entre ativos vira pendente', () => {
    const m = casarColaboradores(['Fulano Ausente', 'Ana Maria'], colaboradores)
    expect(m.get('Fulano Ausente')).toEqual({ id: null })
    expect(m.get('Ana Maria')).toEqual({ id: null }) // 2 ativas → pendente, nunca palpite
  })
})

describe('coberturaDoMesNoRelatorio (aviso de relatório incompleto)', () => {
  const pessoa = (datas: string[]) => ({
    nome: 'X',
    departamentoTexto: 'D',
    cargo: '',
    horario: '',
    dias: datas.map((data) => ({ data, marca: 'trabalha' as const, texto: '[T]' })),
  })
  const outubro = (ate: number) =>
    Array.from({ length: ate }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)

  it('mês inteiro: completo', () => {
    const c = coberturaDoMesNoRelatorio([pessoa(outubro(31))], '2026-10')
    expect(c).toEqual({ primeiro: '2026-10-01', ultimo: '2026-10-31', diasFaltando: [], completo: true })
  })

  it('caso real: outubro só até 30/10 → falta o 31 (só aviso)', () => {
    const c = coberturaDoMesNoRelatorio([pessoa(outubro(30))], '2026-10')
    expect(c.completo).toBe(false)
    expect(c.diasFaltando).toEqual(['2026-10-31'])
    expect(c.ultimo).toBe('2026-10-30')
  })

  it('ignora colunas de outro mês', () => {
    const c = coberturaDoMesNoRelatorio([pessoa(['2026-09-30', ...outubro(31), '2026-11-01'])], '2026-10')
    expect(c.completo).toBe(true)
  })
})
