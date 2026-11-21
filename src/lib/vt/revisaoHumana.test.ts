import { describe, expect, it } from 'vitest'
import { ehLinhaParaORio, motivosRevisaoHumana } from './revisaoHumana'

const p = (...linhas: string[]) => linhas.map((linha) => ({ linha }))

describe('motivosRevisaoHumana (auditoria de 21/11/2026)', () => {
  it('rota simples não pede revisão', () => {
    expect(motivosRevisaoHumana(p('62', '39A'), p('39A', '62'), 'Niterói', 'Niterói')).toEqual([])
  })

  it('3 ou mais conduções num sentido (caso Jaldeni: 44 → 61 → 42T)', () => {
    expect(motivosRevisaoHumana(p('44', '61', '42T'), p('42T'), 'Niterói', 'Niterói')).toEqual(['3 conduções na ida'])
  })

  it('mesma linha repetida em sequência (caso Bruno: 49.2 → 49.2)', () => {
    expect(motivosRevisaoHumana(p('49.2', '49.2'), p('49.2'), 'Niterói', 'Niterói')[0]).toMatch(/49\.2 aparece duas vezes/)
  })

  it('linha para o Rio usada como trecho local, só quando nem casa nem posto é Rio', () => {
    expect(motivosRevisaoHumana(p('515M', '100D'), p('489M'), 'Niterói', 'Niterói')).toEqual([
      'linha para o Rio (100D) usada como trecho local',
    ])
    expect(motivosRevisaoHumana(p('100D'), p('100D'), 'Niterói', 'Rio de Janeiro')).toEqual([])
  })

  it('reconhece só o código DETRO com D no fim', () => {
    expect(ehLinhaParaORio('7721D')).toBe(true)
    expect(ehLinhaParaORio('709D')).toBe(true)
    expect(ehLinhaParaORio('66C')).toBe(false)
    expect(ehLinhaParaORio('404M')).toBe(false)
  })
})
