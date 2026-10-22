import { describe, expect, it } from 'vitest'
import { ordenarPorNome } from '@/lib/vt/ordenacao'

const nome = (x: { n: string }) => x.n

describe('ordenarPorNome', () => {
  const lista = [
    { n: 'Carlos' },
    { n: 'Álvaro' },
    { n: 'ana' },
    { n: 'Beatriz' },
    { n: 'Alvaro' }, // duplicado de Álvaro sem acento — empate na ordenação
  ]

  it('A→Z: pt-BR sem peso de acento nem de caixa', () => {
    expect(ordenarPorNome(lista, nome).map((x) => x.n)).toEqual([
      'Álvaro',
      'Alvaro',
      'ana',
      'Beatriz',
      'Carlos',
    ])
  })

  it('Z→A inverte a comparação, mantendo a ordem original nos empates', () => {
    expect(ordenarPorNome(lista, nome, 'za').map((x) => x.n)).toEqual([
      'Carlos',
      'Beatriz',
      'ana',
      'Álvaro', // empate: Álvaro veio antes de Alvaro na lista original nos dois sentidos
      'Alvaro',
    ])
  })

  it('não muta o array original', () => {
    const original = [...lista]
    ordenarPorNome(lista, nome, 'za')
    expect(lista).toEqual(original)
  })
})
