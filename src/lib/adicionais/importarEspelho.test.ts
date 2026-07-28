import { describe, it, expect } from 'vitest'
import {
  statusAdicionalDoDia,
  espelhoParaPonto,
  periodoDosEspelhos,
  resumoPontoEspelho,
} from './importarEspelho'
import type { DiaPonto, EspelhoColaborador } from '@/lib/ocorrencias/importacaoPonto'

function dia(parcial: Partial<DiaPonto>): DiaPonto {
  return {
    data: '2026-07-10',
    realizado: '',
    justificativa: '',
    categoria: null,
    classificacao: 'outro',
    ...parcial,
  }
}

function espelho(parcial: Partial<EspelhoColaborador>): EspelhoColaborador {
  return {
    pagina: 1,
    nomePdf: 'FULANO DE TAL',
    cpfPdf: '123.456.789-00',
    periodoInicio: null,
    periodoFim: null,
    dias: [],
    ...parcial,
  }
}

describe('statusAdicionalDoDia', () => {
  it('mapeia dia trabalhado (horários) para trabalhou', () => {
    const r = statusAdicionalDoDia(dia({ realizado: '06:51 12:00 13:00 19:05', classificacao: 'trabalhado' }))
    expect(r).toEqual({ status: 'trabalhou', revisao: false })
  })

  it('mapeia Falta para falta', () => {
    expect(statusAdicionalDoDia(dia({ categoria: 'Falta', classificacao: 'falta' })).status).toBe('falta')
  })

  it('mapeia Folga e Feriado para folga', () => {
    expect(statusAdicionalDoDia(dia({ categoria: 'Folga', classificacao: 'nao_trabalhado' })).status).toBe('folga')
    expect(statusAdicionalDoDia(dia({ categoria: 'Feriado', classificacao: 'nao_trabalhado' })).status).toBe('folga')
  })

  it('mapeia Férias para ferias', () => {
    expect(statusAdicionalDoDia(dia({ categoria: 'Férias', classificacao: 'nao_trabalhado' })).status).toBe('ferias')
  })

  it('mapeia Atestado e Afastado para afastado', () => {
    expect(statusAdicionalDoDia(dia({ categoria: 'Atestado', classificacao: 'atestado' })).status).toBe('afastado')
    expect(statusAdicionalDoDia(dia({ categoria: 'Afastado', classificacao: 'outro' })).status).toBe('afastado')
  })

  it('mapeia Suspensão para falta (default documentado)', () => {
    expect(statusAdicionalDoDia(dia({ categoria: 'Suspensão', classificacao: 'outro' })).status).toBe('falta')
  })

  it('mapeia Falta BH para folga (default documentado)', () => {
    expect(statusAdicionalDoDia(dia({ categoria: 'Falta BH', classificacao: 'outro' })).status).toBe('folga')
  })

  it('caso desconhecido vira folga marcada para revisão', () => {
    const r = statusAdicionalDoDia(dia({ categoria: null, classificacao: 'outro', realizado: '???' }))
    expect(r).toEqual({ status: 'folga', revisao: true })
  })
})

describe('espelhoParaPonto', () => {
  it('usa nome e matrícula do cadastro e extrai horários/observação', () => {
    const e = espelho({
      periodoInicio: '01/07/2026',
      periodoFim: '31/07/2026',
      dias: [
        dia({ data: '2026-07-01', realizado: '06:51 19:05', classificacao: 'trabalhado' }),
        dia({ data: '2026-07-02', categoria: 'Atestado', classificacao: 'atestado', justificativa: 'Atestado 2 dias' }),
      ],
    })
    const ponto = espelhoParaPonto(e, {
      id: 'abc',
      nome_completo: 'Fulano de Tal Silva',
      cpf: '123.456.789-00',
      empresa_id: 'e1',
      status: 'Ativo',
      matricula: '1042',
    })
    expect(ponto.nome).toBe('Fulano de Tal Silva')
    expect(ponto.matricula).toBe('1042')
    expect(ponto.periodoInicio).toBe('2026-07-01')
    expect(ponto.periodoFim).toBe('2026-07-31')
    expect(ponto.dias[0]).toMatchObject({
      data: '2026-07-01',
      dataOriginal: '01/07/2026',
      status: 'trabalhou',
      horarios: ['06:51', '19:05'],
      revisao: false,
    })
    expect(ponto.dias[1]).toMatchObject({ status: 'afastado', observacao: 'Atestado 2 dias' })
  })

  it('sem match, usa o nome do PDF e matrícula vazia', () => {
    const ponto = espelhoParaPonto(espelho({ nomePdf: 'BELTRANO', dias: [] }), null)
    expect(ponto.nome).toBe('BELTRANO')
    expect(ponto.matricula).toBe('')
  })
})

describe('periodoDosEspelhos', () => {
  it('converte o cabeçalho dd/mm/aaaa para ISO e pega o menor início e maior fim', () => {
    const periodo = periodoDosEspelhos([
      espelho({ periodoInicio: '16/06/2026', periodoFim: '15/07/2026' }),
      espelho({ periodoInicio: '01/07/2026', periodoFim: '31/07/2026' }),
    ])
    expect(periodo).toEqual({ inicio: '2026-06-16', fim: '2026-07-31' })
  })

  it('sem cabeçalho, usa a menor e a maior data dos dias', () => {
    const periodo = periodoDosEspelhos([
      espelho({ dias: [dia({ data: '2026-07-20' }), dia({ data: '2026-07-03' })] }),
    ])
    expect(periodo).toEqual({ inicio: '2026-07-03', fim: '2026-07-20' })
  })

  it('retorna null quando não há período nem dias', () => {
    expect(periodoDosEspelhos([espelho({})])).toBeNull()
    expect(periodoDosEspelhos([])).toBeNull()
  })
})

describe('resumoPontoEspelho', () => {
  it('conta os dias por status e as revisões', () => {
    const ponto = espelhoParaPonto(
      espelho({
        dias: [
          dia({ data: '2026-07-01', realizado: '06:51 19:05', classificacao: 'trabalhado' }),
          dia({ data: '2026-07-02', categoria: 'Falta', classificacao: 'falta' }),
          dia({ data: '2026-07-03', categoria: 'Folga', classificacao: 'nao_trabalhado' }),
          dia({ data: '2026-07-04', categoria: 'Férias', classificacao: 'nao_trabalhado' }),
          dia({ data: '2026-07-05', categoria: 'Atestado', classificacao: 'atestado' }),
          dia({ data: '2026-07-06' }), // desconhecido → folga + revisão
        ],
      }),
      null
    )
    expect(resumoPontoEspelho(ponto)).toEqual({
      trabalhou: 1,
      folga: 2,
      falta: 1,
      ferias: 1,
      afastado: 1,
      revisao: 1,
    })
  })
})
