import { describe, expect, it } from 'vitest'
import { arredondarMultiplo, erroMultiploItem, fatorValido, rotuloMultiplo, textoEmbalagem } from './multiploCompra'

describe('arredondarMultiplo', () => {
  it('casos da gestora', () => {
    expect(arredondarMultiplo(3, 100)).toEqual({ total: 100, embalagens: 1, sobra: 97 }) // flanela kit c/ 100
    expect(arredondarMultiplo(6, 4)).toEqual({ total: 8, embalagens: 2, sobra: 2 }) // RZK caixa c/ 4
    expect(arredondarMultiplo(8, 5)).toEqual({ total: 10, embalagens: 2, sobra: 2 }) // Lustro: 8 frascos → 2 bombonas
  })
  it('múltiplo exato não sobra; fator 1 e zero não mudam nada', () => {
    expect(arredondarMultiplo(200, 100)).toEqual({ total: 200, embalagens: 2, sobra: 0 })
    expect(arredondarMultiplo(7, 1)).toEqual({ total: 7, embalagens: 7, sobra: 0 })
    expect(arredondarMultiplo(0, 100)).toEqual({ total: 0, embalagens: 0, sobra: 0 })
  })
  it('fator inválido vale 1', () => {
    expect(fatorValido(0)).toBe(1)
    expect(fatorValido(2.5)).toBe(1)
    expect(fatorValido('4')).toBe(4)
    expect(arredondarMultiplo(3, Number.NaN).total).toBe(3)
  })
})

describe('textoEmbalagem', () => {
  it('singular, plural e unidade com medida', () => {
    expect(textoEmbalagem(100, 100, 'kit')).toBe('1 kit c/ 100')
    expect(textoEmbalagem(8, 4, 'caixa')).toBe('2 caixas c/ 4')
    expect(textoEmbalagem(15, 5, 'bombona 5L')).toBe('3 bombonas 5L c/ 5')
  })
  it('resto quando não é múltiplo (compra antiga) e fator 1 sem texto', () => {
    expect(textoEmbalagem(9, 4, 'caixa')).toBe('2 caixas c/ 4 + 1')
    expect(textoEmbalagem(3, 4, 'caixa')).toBe('3 (menos de 1 caixa c/ 4)')
    expect(textoEmbalagem(9, 1, 'caixa')).toBeNull()
    expect(textoEmbalagem(9, 4, null)).toBe('2 embalagens c/ 4 + 1')
  })
  it('rótulo do selo', () => {
    expect(rotuloMultiplo(100, 'kit')).toBe('compra em kit c/ 100')
    expect(rotuloMultiplo(1, 'kit')).toBeNull()
  })
})

describe('erroMultiploItem (espelha as constraints da 152)', () => {
  it('valida fator, unidade e fracionado', () => {
    expect(erroMultiploItem({ fator: '1', unidadeCompra: '', fracionado: false })).toBeNull()
    expect(erroMultiploItem({ fator: '100', unidadeCompra: 'kit', fracionado: false })).toBeNull()
    expect(erroMultiploItem({ fator: '0', unidadeCompra: '', fracionado: false })).toMatch(/inteiro/)
    expect(erroMultiploItem({ fator: '2,5', unidadeCompra: 'cx', fracionado: false })).toMatch(/inteiro/)
    expect(erroMultiploItem({ fator: '4', unidadeCompra: ' ', fracionado: false })).toMatch(/como o fornecedor vende/)
    expect(erroMultiploItem({ fator: '5', unidadeCompra: 'bombona 5L', fracionado: true, preparoEscritorio: true })).toMatch(/fracionado/)
  })
})
