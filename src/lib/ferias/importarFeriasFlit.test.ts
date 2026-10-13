import { describe, it, expect } from 'vitest'
import type { Colaborador } from '@/types/database'
import {
  parsePeriodo,
  parsePlanilhaFerias,
  casarColaboradores,
  type LinhaPlanilhaFerias,
} from './importarFeriasFlit'

function colaboradorFake(id: string, nome: string, status: 'Ativo' | 'Inativo' = 'Ativo', cpf: string | null = null): Colaborador {
  return { id, nome_completo: nome, status, matricula: id, cpf } as Colaborador
}

function linhaFake(parcial: Partial<LinhaPlanilhaFerias>): LinhaPlanilhaFerias {
  return {
    nome: 'COLABORADOR TESTE',
    departamento: '',
    cpf: null,
    matricula: null,
    ultimoPeriodoTexto: '',
    ultimaDescricao: null,
    proximoPeriodoTexto: '',
    proximaDescricao: null,
    ...parcial,
  }
}

describe('parsePeriodo', () => {
  it('interpreta período no formato DD/MM/AAAA - DD/MM/AAAA', () => {
    expect(parsePeriodo('02/07/2026 - 31/07/2026')).toEqual({ inicio: '2026-07-02', fim: '2026-07-31' })
  })

  it('tolera espaços irregulares e travessão', () => {
    expect(parsePeriodo('08/05/2026-06/06/2026')).toEqual({ inicio: '2026-05-08', fim: '2026-06-06' })
    expect(parsePeriodo('08/05/2026 – 06/06/2026')).toEqual({ inicio: '2026-05-08', fim: '2026-06-06' })
  })

  it('retorna null para vazio, texto livre ou data invertida', () => {
    expect(parsePeriodo('')).toBeNull()
    expect(parsePeriodo(null)).toBeNull()
    expect(parsePeriodo('férias')).toBeNull()
    expect(parsePeriodo('31/07/2026 - 02/07/2026')).toBeNull()
    expect(parsePeriodo('32/01/2026 - 31/01/2026')).toBeNull()
  })
})

describe('parsePlanilhaFerias', () => {
  it('lê as colunas da planilha do Flit', () => {
    const linhas = parsePlanilhaFerias([
      {
        Colaborador: 'ADALTO ROSA PORTO',
        Empresa: 'Plena EA',
        Departamento: 'EXCLUSIVE CHARITAS',
        'Último período': '08/05/2026 - 06/06/2026',
        'Últ. descrição': 'Férias',
        'Próximo período': '',
        'Próx. descrição': '',
      },
    ])
    expect(linhas).toHaveLength(1)
    expect(linhas[0].nome).toBe('ADALTO ROSA PORTO')
    expect(linhas[0].departamento).toBe('EXCLUSIVE CHARITAS')
    expect(linhas[0].ultimoPeriodoTexto).toBe('08/05/2026 - 06/06/2026')
    expect(linhas[0].ultimaDescricao).toBe('Férias')
  })

  it('ignora linhas sem nome e lança erro sem coluna de colaborador', () => {
    expect(parsePlanilhaFerias([{ Colaborador: '' }])).toHaveLength(0)
    expect(() => parsePlanilhaFerias([{ Planeta: 'X' }])).toThrow()
  })
})

describe('casarColaboradores', () => {
  it('casa por nome normalizado (ignora acentos e caixa)', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'ACACIO DA SILVA COUTINHO', ultimoPeriodoTexto: '02/07/2026 - 31/07/2026' })],
      [colaboradorFake('1', 'Acácio da Silva Coutinho')]
    )
    expect(resultado.colaboradoresEncontrados).toBe(1)
    expect(resultado.periodos).toHaveLength(1)
    expect(resultado.periodos[0]).toMatchObject({
      colaborador_id: '1',
      tipo: 'gozo',
      origem: 'flit',
      data_inicio: '2026-07-02',
      data_fim: '2026-07-31',
    })
  })

  it('gera período agendado a partir do próximo período', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'FULANO', proximoPeriodoTexto: '12/08/2026 - 10/09/2026', proximaDescricao: 'Férias 30 dias' })],
      [colaboradorFake('1', 'Fulano')]
    )
    expect(resultado.periodos[0]).toMatchObject({
      tipo: 'agendado',
      descricao: 'Férias 30 dias',
    })
  })

  it('lista nomes não encontrados', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'DESCONHECIDO' })],
      [colaboradorFake('1', 'Fulano')]
    )
    expect(resultado.naoEncontrados).toEqual(['DESCONHECIDO'])
    expect(resultado.periodos).toHaveLength(0)
  })

  it('em duplicidade, prefere o colaborador ativo', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'FULANO', ultimoPeriodoTexto: '02/07/2026 - 31/07/2026' })],
      [colaboradorFake('1', 'Fulano', 'Inativo'), colaboradorFake('2', 'FULANO', 'Ativo')]
    )
    expect(resultado.periodos[0].colaborador_id).toBe('2')
  })

  it('duplicidade sem desempate vai para ambíguos e não importa', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'FULANO', ultimoPeriodoTexto: '02/07/2026 - 31/07/2026' })],
      [colaboradorFake('1', 'Fulano'), colaboradorFake('2', 'FULANO')]
    )
    expect(resultado.ambiguos).toEqual(['FULANO'])
    expect(resultado.periodos).toHaveLength(0)
  })

  it('sinaliza texto de período não interpretado', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'FULANO', ultimoPeriodoTexto: 'a combinar' })],
      [colaboradorFake('1', 'Fulano')]
    )
    expect(resultado.periodosInvalidos).toEqual(['FULANO'])
    expect(resultado.periodos).toHaveLength(0)
  })

  it('casa por CPF com prioridade sobre o nome', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'NOME TOTALMENTE DIFERENTE', cpf: '123.456.789-00', ultimoPeriodoTexto: '02/07/2026 - 31/07/2026' })],
      [colaboradorFake('1', 'Fulano', 'Ativo', '12345678900')]
    )
    expect(resultado.periodos).toHaveLength(1)
    expect(resultado.periodos[0].colaborador_id).toBe('1')
  })

  it('casa CPF com 10 dígitos (zero à esquerda faltando na planilha)', () => {
    const resultado = casarColaboradores(
      [linhaFake({ cpf: '2345678901', ultimoPeriodoTexto: '02/07/2026 - 31/07/2026' })],
      [colaboradorFake('1', 'Fulano', 'Ativo', '023.456.789-01')]
    )
    expect(resultado.periodos).toHaveLength(1)
    expect(resultado.periodos[0].colaborador_id).toBe('1')
  })

  it('casa por matrícula com zeros à esquerda normalizados', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'OUTRO NOME', matricula: '16', ultimoPeriodoTexto: '02/07/2026 - 31/07/2026' })],
      [{ ...colaboradorFake('1', 'Fulano'), matricula: '000016' }]
    )
    expect(resultado.periodos).toHaveLength(1)
    expect(resultado.periodos[0].colaborador_id).toBe('1')
  })

  it('sem coluna de CPF/matrícula, mantém o match por nome', () => {
    const resultado = casarColaboradores(
      [linhaFake({ nome: 'FULANO', ultimoPeriodoTexto: '02/07/2026 - 31/07/2026' })],
      [colaboradorFake('1', 'Fulano', 'Ativo', '12345678900')]
    )
    expect(resultado.periodos).toHaveLength(1)
    expect(resultado.periodos[0].colaborador_id).toBe('1')
  })
})

describe('parsePlanilhaFerias — colunas opcionais de CPF/matrícula', () => {
  it('detecta colunas de CPF e matrícula (com variações de nome)', () => {
    const linhas = parsePlanilhaFerias([
      { Colaborador: 'FULANO', CPF: '123.456.789-00', 'Matrícula': '000016', 'Último período': '' },
    ])
    expect(linhas[0].cpf).toBe('123.456.789-00')
    expect(linhas[0].matricula).toBe('000016')
    const porCodigo = parsePlanilhaFerias([{ Colaborador: 'FULANO', 'Código': '000016' }])
    expect(porCodigo[0].matricula).toBe('000016')
  })

  it('sem as colunas, os campos ficam null', () => {
    const linhas = parsePlanilhaFerias([{ Colaborador: 'FULANO' }])
    expect(linhas[0].cpf).toBeNull()
    expect(linhas[0].matricula).toBeNull()
  })
})
