import { describe, expect, it } from 'vitest'
import { agruparEntregasPorData, detalheEntrega, linhaCasaComPeca, opcoesPeca, ultimaEPenultima } from './entregasPeca'

const nomes: Record<string, string> = {
  a: 'BOTA PVC 38',
  b: 'BOTA PVC 39',
  c: 'LUVA LATEX G',
  d: 'ÓCULOS INCOLOR',
}
const nome = (id: string) => nomes[id]

describe('última e penúltima entrega', () => {
  it('sem histórico', () => {
    expect(ultimaEPenultima([])).toEqual({ ultima: null, penultima: null })
  })
  it('só uma entrega: penúltima vazia', () => {
    const r = ultimaEPenultima([{ item_id: 'a', data_entrega: '2026-09-01', quantidade: 1 }])
    expect(r.ultima?.data).toBe('2026-09-01')
    expect(r.penultima).toBeNull()
  })
  it('mesma data soma a quantidade e conta como uma entrega só', () => {
    const r = ultimaEPenultima([
      { item_id: 'a', data_entrega: '2026-09-01', quantidade: 1 },
      { item_id: 'a', data_entrega: '2026-09-01', quantidade: 1 },
      { item_id: 'a', data_entrega: '2026-05-01', quantidade: 1 },
    ])
    expect(r.ultima).toMatchObject({ data: '2026-09-01', quantidade: 2 })
    expect(r.penultima).toMatchObject({ data: '2026-05-01', quantidade: 1 })
  })
  it('peça com vários tamanhos: junta os itens e ordena por data', () => {
    const g = agruparEntregasPorData([
      { item_id: 'a', data_entrega: '2026-01-01', quantidade: 1 },
      { item_id: 'b', data_entrega: '2026-08-01', quantidade: 1 },
      { item_id: 'a', data_entrega: '2026-08-01', quantidade: 2 },
      { item_id: 'a', data_entrega: '2026-03-01', quantidade: null },
    ])
    expect(g.map((x) => x.data)).toEqual(['2026-08-01', '2026-03-01', '2026-01-01'])
    expect(g[0]).toMatchObject({ quantidade: 3, itemIds: ['b', 'a'] })
    expect(g[1].quantidade).toBe(1)
  })
  it('detalhe com quantidade e tamanhos', () => {
    expect(detalheEntrega(2, ['40'])).toBe('2 un · tam. 40')
    expect(detalheEntrega(1, ['40', '41', '40'])).toBe('1 un · tam. 40, 41')
    expect(detalheEntrega(3, [null])).toBe('3 un')
  })
})

describe('filtro Peça', () => {
  const linhas = [
    { tipo: 'epi' as const, item_id: 'a' },
    { tipo: 'epi' as const, item_id: 'b' },
    { tipo: 'epi' as const, item_id: 'c' },
    { tipo: 'cracha' as const, item_id: null },
    { tipo: 'epi' as const, item_id: 'd' },
  ]
  it('opções: nome base sem repetir tamanhos, crachá incluído, ordem pt-BR', () => {
    expect(opcoesPeca(linhas, nome)).toEqual(['BOTA PVC', 'Crachá', 'LUVA LATEX', 'ÓCULOS INCOLOR'])
  })
  it('vazio = todas; texto filtra por contém sem acento', () => {
    expect(linhas.every((l) => linhaCasaComPeca(l, '', nome))).toBe(true)
    expect(linhas.filter((l) => linhaCasaComPeca(l, 'bota', nome))).toHaveLength(2)
    expect(linhas.filter((l) => linhaCasaComPeca(l, 'cracha', nome))).toHaveLength(1)
    expect(linhas.filter((l) => linhaCasaComPeca(l, 'oculos', nome))).toHaveLength(1)
    expect(linhaCasaComPeca({ tipo: 'epi', item_id: null }, 'bota', nome)).toBe(false)
  })
})
