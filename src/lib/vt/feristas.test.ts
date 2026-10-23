import { describe, expect, it } from 'vitest'
import { classificarFeristas, mesesAtras } from '@/lib/vt/feristas'

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
