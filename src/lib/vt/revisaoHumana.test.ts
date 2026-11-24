import { describe, expect, it } from 'vitest'
import { ehLinhaParaORio, linhasDProibidas, motivosRevisaoHumana, situacaoLinhaD } from './revisaoHumana'

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

  it('cidade desconhecida: não bloqueia, mas o aviso explica que falta a cidade', () => {
    const m = motivosRevisaoHumana(p('425D'), p('425D'), 'Niterói', null)
    expect(m).toHaveLength(1)
    expect(m[0]).toMatch(/cidade da casa ou do posto não está informada/)
  })
})

describe('linha D proibida (decisão da gestora, 24/11/2026)', () => {
  it('situação por cidades', () => {
    expect(situacaoLinhaD('Niterói', 'São Gonçalo')).toBe('proibida')
    expect(situacaoLinhaD('Itaboraí', 'NITEROI')).toBe('proibida')
    expect(situacaoLinhaD('Niterói', 'Rio de Janeiro')).toBe('liberada')
    expect(situacaoLinhaD('rio de janeiro', 'Niterói')).toBe('liberada')
    expect(situacaoLinhaD('Niterói', null)).toBe('conferir')
    expect(situacaoLinhaD('', 'Niterói')).toBe('conferir')
    expect(situacaoLinhaD('desconhecida', 'Niterói')).toBe('conferir')
    // Rio de um lado basta, mesmo com o outro desconhecido
    expect(situacaoLinhaD(null, 'Rio de Janeiro')).toBe('liberada')
  })

  it('proíbe 425D e 760D quando casa e posto ficam fora do Rio (casos Ana Bela e Thiago)', () => {
    expect(linhasDProibidas('Niterói', 'Niterói', p('489M'), p('425D'))).toEqual(['425D'])
    expect(linhasDProibidas('São Gonçalo', 'Niterói', p('760D', '491M'), p('491M', '760D'))).toEqual(['760D'])
  })

  it('não proíbe quando casa ou posto é no Rio, nem quando a cidade é desconhecida', () => {
    expect(linhasDProibidas('Niterói', 'Rio de Janeiro', p('425D'), p('425D'))).toEqual([])
    expect(linhasDProibidas('Niterói', null, p('425D'), p('425D'))).toEqual([])
  })

  it('linha M e outras não são D', () => {
    expect(linhasDProibidas('Niterói', 'Niterói', p('489M', '62'), p('62'))).toEqual([])
  })
})
