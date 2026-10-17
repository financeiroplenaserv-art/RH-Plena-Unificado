import { describe, expect, it } from 'vitest'
import { antesDoPrazo, ultimaEntregaDoItem, type FatoEntrega } from './ultimaEntrega'

const fatos: FatoEntrega[] = [
  { item_id: 'A', competencia: '2026-05-01', quantidade: 2 },
  { item_id: 'A', competencia: '2026-07-01', quantidade: 3 },
  { item_id: 'A', competencia: '2026-07-01', quantidade: 1 },
  { item_id: 'B', competencia: '2026-08-01', quantidade: 5 },
  { item_id: 'A', competencia: '2026-09-01', quantidade: 0 },
]

describe('ultimaEntregaDoItem', () => {
  it('pega a competência mais recente e soma o que entrou nela', () => {
    expect(ultimaEntregaDoItem('A', fatos, [], '2026-10-01')).toEqual({ data: '2026-07-01', quantidade: 4 })
  })
  it('ignora a própria competência e as seguintes', () => {
    expect(ultimaEntregaDoItem('A', fatos, [], '2026-07-01')).toEqual({ data: '2026-05-01', quantidade: 2 })
  })
  it('item sem entrega devolve null', () => {
    expect(ultimaEntregaDoItem('Z', fatos, [], '2026-10-01')).toBeNull()
  })
  it('o item novo herda a última entrega do que ele substituiu', () => {
    const v = [{ item_id: 'B', variacao_id: null, substituido_por_id: 'A', substituido_por_variacao_id: null }]
    expect(ultimaEntregaDoItem('A', fatos, v, '2026-10-01')).toEqual({ data: '2026-08-01', quantidade: 5 })
  })
})

describe('antesDoPrazo', () => {
  it('última há menos que a validade = antes do prazo', () => {
    expect(antesDoPrazo('2026-08-01', 6, '2026-10-17')).toBe(true)
  })
  it('validade já vencida ou sem validade = não', () => {
    expect(antesDoPrazo('2026-01-01', 6, '2026-10-17')).toBe(false)
    expect(antesDoPrazo('2026-08-01', null, '2026-10-17')).toBe(false)
  })
})
