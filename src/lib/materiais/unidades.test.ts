import { describe, expect, it } from 'vitest'
import { pluralizarUnidade, quantidadeComUnidade, unidadeParaQuantidade } from './unidades'

describe('pluralização de unidade (pt-BR)', () => {
  it('palavras comuns', () => {
    for (const [s, p] of [
      ['unidade', 'unidades'], ['caixa', 'caixas'], ['pacote', 'pacotes'], ['galão', 'galões'], ['frasco', 'frascos'],
      ['rolo', 'rolos'], ['fardo', 'fardos'], ['par', 'pares'], ['litro', 'litros'], ['Unidade', 'Unidades'], ['embalagem', 'embalagens'],
    ]) expect(pluralizarUnidade(s)).toBe(p)
  })
  it('abreviações e medidas ficam iguais', () => {
    for (const s of ['un', 'L', 'kg', 'cx', 'pct', 'ml', '5L', '500mL', '10kg']) expect(pluralizarUnidade(s)).toBe(s)
  })
  it('unidades compostas do catálogo', () => {
    expect(pluralizarUnidade('bombona 5L')).toBe('bombonas 5L')
    expect(pluralizarUnidade('frasco/garrafa 1L')).toBe('frascos/garrafas 1L')
    expect(pluralizarUnidade('frasco 500mL')).toBe('frascos 500mL')
    expect(pluralizarUnidade('embalagem 10kg')).toBe('embalagens 10kg')
  })
  it('1 = singular; 0, 2 e fracionado = plural', () => {
    expect(unidadeParaQuantidade('unidade', 1)).toBe('unidade')
    expect(unidadeParaQuantidade('unidade', 2)).toBe('unidades')
    expect(unidadeParaQuantidade('unidade', 0)).toBe('unidades')
    expect(unidadeParaQuantidade('pacote', 1.5)).toBe('pacotes')
    expect(unidadeParaQuantidade(null, 3)).toBe('')
  })
  it('quantidade com unidade', () => {
    expect(quantidadeComUnidade(2, 'unidade')).toBe('2 unidades')
    expect(quantidadeComUnidade(1, 'bombona 5L')).toBe('1 bombona 5L')
    expect(quantidadeComUnidade(3, 'bombona 5L')).toBe('3 bombonas 5L')
    expect(quantidadeComUnidade(2.5, 'pacote')).toBe('2,5 pacotes')
    expect(quantidadeComUnidade(4, null)).toBe('4')
  })
})
