import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as XLSX from '@e965/xlsx'
import {
  competenciaDoNomeArquivo,
  conciliarLinhasLifecard,
  gerarTxtLifecard,
  parseDemonstrativoLifecard,
  referenciasAlterdataLifecard,
  type LinhaLifecard,
  type LinhaLifecardConferida,
} from './lifecard'

const CABECALHO = ['FL', 'SET', 'MAT', 'CPF', 'TIPO', 'NOME', 'CARTAO', 'TOTAL', 'SUBSIDIO', 'TAXA', '2VIA', 'COMP', 'PREMIO', 'BENEF', 'DESC']

function linha(overrides: Partial<LinhaLifecard> = {}): LinhaLifecard {
  return {
    linha: 2,
    matriculaLifecard: '384',
    cpf: '19903466773',
    nome: 'ADRIANO GONCALVES',
    valorCentavos: 23574,
    compCentavos: 23574,
    segundaViaCentavos: 0,
    ...overrides,
  }
}

function conferida(overrides: Partial<LinhaLifecardConferida> = {}): LinhaLifecardConferida {
  return {
    ...linha(),
    colaboradorId: 'c1',
    nomeCorh: 'ADRIANO GONCALVES',
    matricula: '001022',
    empresaCodigo: '32',
    empresaNome: 'Plena EA',
    statusCorh: 'Ativo',
    pendencia: null,
    ...overrides,
  }
}

describe('parser do demonstrativo Lifecard', () => {
  it('lê DESC, normaliza CPF e identifica a segunda via', () => {
    const resultado = parseDemonstrativoLifecard([
      CABECALHO,
      ['34', '0', '384', '19903466773', 'T', 'ADRIANO GONCALVES', 'cartao', '235.74', '0', '0', '0', '235.74', '0', '0', '235.74'],
      ['34', '0', '407', '13677533767', 'T', 'MARCELO ANTONIO CONCEICAO', 'cartao', '270', '0', '0', '20', '250', '0', '0', '270'],
      ['0', '0', '118', '9396091774', 'T', 'AGOSTINHO DOS SANTOS GUEDES', 'cartao', '250', '0', '0', '0', '250', '0', '0', '250'],
    ])

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas).toHaveLength(3)
    expect(resultado.linhas[0].valorCentavos).toBe(23574)
    expect(resultado.linhas[1].valorCentavos).toBe(27000)
    expect(resultado.linhas[1].segundaViaCentavos).toBe(2000)
    expect(resultado.linhas[2].cpf).toBe('09396091774')
  })

  it('informa linhas inválidas sem interromper as demais', () => {
    const resultado = parseDemonstrativoLifecard([
      CABECALHO,
      ['0', '0', '1', '', 'T', 'SEM CPF', '', '10', '0', '0', '0', '10', '0', '0', '10'],
      ['0', '0', '2', '19903466773', 'T', 'ADRIANO GONCALVES', '', '0', '0', '0', '0', '0', '0', '0', '0'],
    ])
    expect(resultado.linhas).toEqual([])
    expect(resultado.erros.map(erro => erro.motivo)).toEqual([
      'CPF ausente ou com mais de 11 dígitos',
      'Valor DESC ausente ou inválido',
    ])
  })
})

describe('competência do TXT', () => {
  it('usa o mês final do período informado no nome do arquivo', () => {
    expect(competenciaDoNomeArquivo('Demonstrativo 16.10.2026  15.11.2026.xls')).toBe('2026-11')
    expect(competenciaDoNomeArquivo('arquivo-sem-periodo.xls')).toBeNull()
  })

  it('gera referências do primeiro ao último dia do mês', () => {
    expect(referenciasAlterdataLifecard('2026-11')).toEqual({ ref1: '011126', ref2: '301126' })
    expect(referenciasAlterdataLifecard('2028-02')).toEqual({ ref1: '010228', ref2: '290228' })
  })
})

describe('conciliação com o cadastro do CORH', () => {
  it('usa matrícula e empresa do CORH e marca CPF não encontrado', () => {
    const linhas = conciliarLinhasLifecard(
      [linha(), linha({ linha: 3, cpf: '00000000001', nome: 'NAO CADASTRADO' })],
      [{ id: 'c1', nome_completo: 'ADRIANO GONCALVES', cpf: '199.034.667-73', matricula: '001022', empresa_id: 'e1', status: 'Ativo' }],
      [{ id: 'e1', nome: 'Plena EA', codigo_alterdata: '32' }]
    )
    expect(linhas[0]).toMatchObject({ matricula: '001022', empresaCodigo: '32', pendencia: null })
    expect(linhas[1].pendencia).toContain('CPF não encontrado')
  })

  it('escolhe o único ativo em caso de duplicidade cadastral e recusa CPF repetido no arquivo', () => {
    const colaboradores = [
      { id: 'inativo', nome_completo: 'ADRIANO ANTIGO', cpf: '19903466773', matricula: '009999', empresa_id: 'e1', status: 'Inativo' as const },
      { id: 'ativo', nome_completo: 'ADRIANO GONCALVES', cpf: '19903466773', matricula: '001022', empresa_id: 'e1', status: 'Ativo' as const },
    ]
    const empresas = [{ id: 'e1', nome: 'Plena EA', codigo_alterdata: '32' }]
    const [duplicado] = conciliarLinhasLifecard([linha(), linha({ linha: 3 })], colaboradores, empresas)
    const [unico] = conciliarLinhasLifecard([linha()], colaboradores, empresas)

    expect(unico.colaboradorId).toBe('ativo')
    expect(unico.pendencia).toBeNull()
    expect(duplicado.pendencia).toContain('CPF aparece mais de uma vez')
  })
})

describe('TXT Alterdata evento 664', () => {
  it('gera 61 posições com competência, valor DESC e matrícula do CORH', () => {
    const resultado = gerarTxtLifecard([
      conferida(),
      conferida({ nome: 'PENDENTE', pendencia: 'CPF não encontrado' }),
    ], '2026-11')

    expect(resultado.gerados).toBe(1)
    expect(resultado.pulados).toHaveLength(1)
    const registro = resultado.conteudo
    expect(registro).toHaveLength(61)
    expect(registro.slice(0, 6)).toBe('000001')
    expect(registro.slice(6, 11)).toBe('00032')
    expect(registro.slice(11, 17)).toBe('011126')
    expect(registro.slice(17, 23)).toBe('301126')
    expect(registro.slice(37, 40)).toBe('664')
    expect(registro.slice(40, 54)).toBe('00000000023574')
    expect(registro.slice(54, 60)).toBe('001022')
    expect(registro.slice(60)).toBe('F')
  })
})

const arquivoReal = resolve(process.cwd(), 'dados-locais/Demonstrativo 16.10.2026  15.11.2026.xls')

describe('arquivo real fornecido pela operação', () => {
  it.skipIf(!existsSync(arquivoReal))('lê os 69 descontos e confere o total de DESC', () => {
    const workbook = XLSX.read(readFileSync(arquivoReal), { type: 'buffer' })
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    }) as unknown[][]
    const resultado = parseDemonstrativoLifecard(rows)

    expect(resultado.erros).toEqual([])
    expect(resultado.linhas).toHaveLength(69)
    expect(resultado.linhas.reduce((total, item) => total + item.valorCentavos, 0)).toBe(1648762)
    expect(resultado.linhas.find(item => item.nome === 'MARCELO ANTONIO CONCEICAO')?.valorCentavos).toBe(27000)
    expect(competenciaDoNomeArquivo('Demonstrativo 16.10.2026  15.11.2026.xls')).toBe('2026-11')
  })
})
