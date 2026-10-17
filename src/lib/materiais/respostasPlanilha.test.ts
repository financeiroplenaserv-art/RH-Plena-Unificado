import { describe, expect, it } from 'vitest'
import { lerQuantidadeComUnidade, lerQuantidadePorVariacao, unidadeBate, type RegraVariacaoTexto } from './respostasPlanilha'

describe('lerQuantidadeComUnidade', () => {
  it('aceita número + unidade que bate com a do item', () => {
    expect(lerQuantidadeComUnidade('1 bombona', 'bombona 5L')).toEqual({ qtd: 1, resto: '' })
    expect(lerQuantidadeComUnidade('2 unidades', 'pacote')).toEqual({ qtd: 2, resto: '' })
    expect(lerQuantidadeComUnidade('4 unid', 'unidade')).toEqual({ qtd: 4, resto: '' })
    expect(lerQuantidadeComUnidade('2 litros', 'frasco/garrafa 1L')).toEqual({ qtd: 2, resto: '' })
    expect(lerQuantidadeComUnidade('3 pacotes', 'pacote')).toEqual({ qtd: 3, resto: '' })
  })
  it('guarda o texto que sobra como observação', () => {
    expect(lerQuantidadeComUnidade('1 unidade mandar melhor qualidade', 'embalagem 800g')).toEqual({ qtd: 1, resto: '1 unidade mandar melhor qualidade' })
  })
  it('recusa unidade que não bate, litro em bombona e texto com outro número', () => {
    expect(lerQuantidadeComUnidade('2 bombonas', 'unidade')).toBeNull()
    expect(lerQuantidadeComUnidade('2 litros', 'bombona 5L')).toBeNull()
    expect(lerQuantidadeComUnidade('2 unidades de 5 litros', 'unidade')).toBeNull()
    expect(lerQuantidadeComUnidade('dois', 'unidade')).toBeNull()
    expect(lerQuantidadeComUnidade('2 verde 2 azul', 'unidade')).toBeNull()
  })
  it('unidadeBate trata plural', () => {
    expect(unidadeBate('bombonas', 'bombona 5L')).toBe(true)
    expect(unidadeBate('caixas', 'caixa')).toBe(true)
    expect(unidadeBate('fardos', 'pacote')).toBe(false)
  })
})

const FLANELA: RegraVariacaoTexto[] = [
  { padrao: 'amarel', variacao_id: 'am' },
  { padrao: 'azul', variacao_id: 'az' },
  { padrao: 'verde', variacao_id: 've' },
  { padrao: 'vermelh', variacao_id: 'vm' },
]
const DISCO: RegraVariacaoTexto[] = [
  { padrao: '(^| )300( |$)', variacao_id: 'd300' },
  { padrao: '(^| )350( |$)', variacao_id: 'd350' },
]
const RODO: RegraVariacaoTexto[] = [{ padrao: '(^| )1( 00)? ?(m|metros?)( |$)', variacao_id: 'r1m' }]
const VASSOURA: RegraVariacaoTexto[] = [
  { padrao: 'piacav', variacao_id: 'pia' },
  { padrao: 'novic', variacao_id: 'nov' },
]

describe('lerQuantidadePorVariacao', () => {
  it('lê pares quantidade + cor', () => {
    expect(lerQuantidadePorVariacao('2 verde 2 azul', FLANELA)).toEqual({ ok: true, partes: [{ variacao_id: 've', quantidade: 2 }, { variacao_id: 'az', quantidade: 2 }] })
  })
  it('lê tamanho do disco no texto', () => {
    expect(lerQuantidadePorVariacao('3 350', DISCO)).toEqual({ ok: true, partes: [{ variacao_id: 'd350', quantidade: 3 }] })
  })
  it('lê tipo de vassoura com acento e espaço duplo', () => {
    expect(lerQuantidadePorVariacao('3 vassoura piaçava  3 vassoura noviça', VASSOURA)).toEqual({
      ok: true,
      partes: [{ variacao_id: 'pia', quantidade: 3 }, { variacao_id: 'nov', quantidade: 3 }],
    })
  })
  it('1.00 metro não é quantidade e vira Rodo 1 m', () => {
    expect(lerQuantidadePorVariacao('2 rodos de 1.00 metro', RODO)).toEqual({ ok: true, partes: [{ variacao_id: 'r1m', quantidade: 2 }] })
  })
  it('é tudo ou nada: trecho ambíguo ou sem texto invalida a resposta', () => {
    expect(lerQuantidadePorVariacao('2 amarela verde2 vermelha', FLANELA).ok).toBe(false)
    expect(lerQuantidadePorVariacao('10', FLANELA).ok).toBe(false)
    expect(lerQuantidadePorVariacao('2unid. 55cm', RODO).ok).toBe(false)
    expect(lerQuantidadePorVariacao('amarela 2', FLANELA).ok).toBe(false)
    expect(lerQuantidadePorVariacao('2 roxa', FLANELA).ok).toBe(false)
  })
  it('soma a mesma variação repetida', () => {
    expect(lerQuantidadePorVariacao('1 azul 2 azul', FLANELA)).toEqual({ ok: true, partes: [{ variacao_id: 'az', quantidade: 3 }] })
  })
})
