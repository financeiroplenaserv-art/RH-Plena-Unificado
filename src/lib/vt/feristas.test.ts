import { describe, expect, it } from 'vitest'
import { classificarFeristas, mesesAtras, sobreposicoesDeCobertura } from '@/lib/vt/feristas'
import type { VtCobertura } from '@/types/vt'

describe('mesesAtras', () => {
  it('subtrai meses no mesmo ano e entre anos', () => {
    expect(mesesAtras('2026-10-23', 6)).toBe('2026-04-23')
    expect(mesesAtras('2026-02-10', 6)).toBe('2025-08-10')
    expect(mesesAtras('2026-01-15', 1)).toBe('2025-12-15')
  })
})

describe('classificarFeristas (decisão da gestora, 23/10/2026)', () => {
  const HOJE = '2026-10-23'
  const cob = (id: string, fim: string) => ({ colaborador_id: id, data_fim: fim })

  it('carteira ativa é ferista e vem primeiro, mesmo sem cobertura', () => {
    const c = classificarFeristas({ carteiraIds: ['c1'], coberturas: [], hoje: HOJE })
    expect(c.ehFerista('c1')).toBe(true)
    expect(c.prioridade('c1')).toBe(0)
  })

  it('cobertura em andamento ou agendada (fim >= hoje) dá selo de ferista', () => {
    const c = classificarFeristas({
      carteiraIds: [],
      coberturas: [cob('c2', HOJE), cob('c3', '2026-12-31')],
      hoje: HOJE,
    })
    expect(c.ehFerista('c2')).toBe(true) // termina hoje: ainda cobre
    expect(c.ehFerista('c3')).toBe(true) // futura: agendada
    expect(c.prioridade('c2')).toBe(1)
  })

  it('cobriu na janela (6 meses) NÃO ganha selo — só prioridade 2 no seletor', () => {
    const c = classificarFeristas({
      carteiraIds: [],
      coberturas: [cob('c4', '2026-10-22')], // terminou ontem: dentro da janela
      hoje: HOJE,
    })
    expect(c.ehFerista('c4')).toBe(false)
    expect(c.prioridade('c4')).toBe(2)
  })

  it('cobertura mais velha que a janela não conta para nada', () => {
    const c = classificarFeristas({
      carteiraIds: [],
      coberturas: [cob('c5', '2026-04-22')], // 1 dia antes do limite (23/04)
      hoje: HOJE,
    })
    expect(c.ehFerista('c5')).toBe(false)
    expect(c.prioridade('c5')).toBe(3)
  })

  it('fim exatamente no limite da janela conta como recente', () => {
    const c = classificarFeristas({
      carteiraIds: [],
      coberturas: [cob('c6', '2026-04-23')], // = mesesAtras(hoje, 6)
      hoje: HOJE,
    })
    expect(c.prioridade('c6')).toBe(2)
  })

  it('linha "sem cobertura" (ferista NULL) nunca classifica ninguém', () => {
    const c = classificarFeristas({
      carteiraIds: [],
      coberturas: [{ colaborador_id: null, data_fim: '2026-12-31' }],
      hoje: HOJE,
    })
    expect(c.ehFerista('c1')).toBe(false)
    expect(c.prioridade('c1')).toBe(3)
  })

  it('treinamento NÃO gera selo nem prioridade (migration 160 — treinamento não é ferista)', () => {
    const c = classificarFeristas({
      carteiraIds: [],
      coberturas: [
        { colaborador_id: 'c8', data_fim: '2026-12-31', tipo: 'treinamento' },
        { colaborador_id: 'c9', data_fim: HOJE, tipo: 'treinamento' },
      ],
      hoje: HOJE,
    })
    expect(c.ehFerista('c8')).toBe(false)
    expect(c.prioridade('c8')).toBe(3)
    expect(c.ehFerista('c9')).toBe(false)
    expect(c.prioridade('c9')).toBe(3)
  })

  it('linha antiga sem tipo (NULL = ferias) conta normalmente; treinamento do MESMO ferista não interfere', () => {
    const c = classificarFeristas({
      carteiraIds: [],
      coberturas: [
        { colaborador_id: 'c10', data_fim: '2026-12-31' }, // tipo ausente = ferias
        { colaborador_id: 'c10', data_fim: '2026-12-30', tipo: 'treinamento' },
        { colaborador_id: 'c11', data_fim: '2026-12-31', tipo: 'ferias' },
      ],
      hoje: HOJE,
    })
    expect(c.ehFerista('c10')).toBe(true)
    expect(c.prioridade('c10')).toBe(1)
    expect(c.ehFerista('c11')).toBe(true)
  })

  it('quem está na carteira E cobrindo fica no grupo da carteira (0)', () => {
    const c = classificarFeristas({
      carteiraIds: ['c7'],
      coberturas: [cob('c7', '2026-12-31')],
      hoje: HOJE,
    })
    expect(c.prioridade('c7')).toBe(0)
  })

  it('sem id não quebra', () => {
    const c = classificarFeristas({ carteiraIds: [], coberturas: [], hoje: HOJE })
    expect(c.ehFerista(null)).toBe(false)
    expect(c.ehFerista(undefined)).toBe(false)
    expect(c.prioridade(null)).toBe(3)
  })
})

describe('sobreposicoesDeCobertura (decisão da gestora, 27/10/2026)', () => {
  function cobertura(parcial: Partial<VtCobertura>): VtCobertura {
    return {
      id: Math.random().toString(36).slice(2),
      colaborador_id: 'c1',
      departamento_id: 'd1',
      data_inicio: '2026-11-01',
      data_fim: '2026-11-30',
      observacao: null,
      registrado_por: null,
      ...parcial,
    }
  }

  it('sem sobreposição: lista vazia', () => {
    expect(
      sobreposicoesDeCobertura([
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-10' }),
        cobertura({ data_inicio: '2026-11-15', data_fim: '2026-11-30' }),
      ])
    ).toEqual([])
  })

  it('caso real (Everaldo): Mérito Barreto 01–27/11 × Itaguaí 01–04/11 → interseção 01–04/11', () => {
    expect(
      sobreposicoesDeCobertura([
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-27', departamento_id: 'merito' }),
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-04', departamento_id: 'itaguai' }),
      ])
    ).toEqual([{ colaborador_id: 'c1', inicio: '2026-11-01', fim: '2026-11-04', quantas: 2 }])
  })

  it('períodos encostados (fim = início da outra no dia seguinte) NÃO se sobrepõem', () => {
    expect(
      sobreposicoesDeCobertura([
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-10' }),
        cobertura({ data_inicio: '2026-11-11', data_fim: '2026-11-30' }),
      ])
    ).toEqual([])
  })

  it('fim = início da outra NO MESMO dia conta como sobreposição de 1 dia', () => {
    expect(
      sobreposicoesDeCobertura([
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-10' }),
        cobertura({ data_inicio: '2026-11-10', data_fim: '2026-11-30' }),
      ])
    ).toEqual([{ colaborador_id: 'c1', inicio: '2026-11-10', fim: '2026-11-10', quantas: 2 }])
  })

  it('treinamento e "sem cobertura" (ferista null) ficam de fora', () => {
    expect(
      sobreposicoesDeCobertura([
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-27' }),
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-04', tipo: 'treinamento' }),
        cobertura({ colaborador_id: null, data_inicio: '2026-11-01', data_fim: '2026-11-04' }),
      ])
    ).toEqual([])
  })

  it('cobertura sem tipo (leitura antiga) conta como ferias', () => {
    expect(
      sobreposicoesDeCobertura([
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-27' }),
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-04' }),
      ])
    ).toHaveLength(1)
  })

  it('3 coberturas com interseção comum: quantas = 3 e período = interseção das 3', () => {
    expect(
      sobreposicoesDeCobertura([
        cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-27' }),
        cobertura({ data_inicio: '2026-11-03', data_fim: '2026-11-10' }),
        cobertura({ data_inicio: '2026-11-05', data_fim: '2026-11-20' }),
      ])
    ).toEqual([{ colaborador_id: 'c1', inicio: '2026-11-05', fim: '2026-11-10', quantas: 3 }])
  })

  it('cadeia sem interseção comum (A∩B, B∩C, A∩C vazio): mostra o intervalo envolvido, nunca datas invertidas', () => {
    const [s] = sobreposicoesDeCobertura([
      cobertura({ data_inicio: '2026-11-01', data_fim: '2026-11-10' }),
      cobertura({ data_inicio: '2026-11-05', data_fim: '2026-11-15' }),
      cobertura({ data_inicio: '2026-11-12', data_fim: '2026-11-30' }),
    ])
    expect(s.quantas).toBe(3)
    expect(s.inicio <= s.fim).toBe(true)
  })

  it('uma entrada por ferista — feristas diferentes não se misturam', () => {
    const resultado = sobreposicoesDeCobertura([
      cobertura({ colaborador_id: 'c1', data_inicio: '2026-11-01', data_fim: '2026-11-27' }),
      cobertura({ colaborador_id: 'c1', data_inicio: '2026-11-01', data_fim: '2026-11-04' }),
      cobertura({ colaborador_id: 'c2', data_inicio: '2026-11-01', data_fim: '2026-11-10' }),
    ])
    expect(resultado).toHaveLength(1)
    expect(resultado[0].colaborador_id).toBe('c1')
  })
})
