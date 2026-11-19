import { describe, expect, it } from 'vitest'
import { agruparAlternativasIguais, menorValorComDestaque, textoSemelhantes } from '@/lib/vt/agruparAlternativas'

function alt(id: string, linhas: Array<string | null>, valor: number | null) {
  return {
    alternativa: { id, itinerario: { pernas: linhas.map((linha) => ({ linha })) } },
    resultado: { valorCentavos: valor },
  }
}

describe('agruparAlternativasIguais', () => {
  it('junta as repetidas, mantém a primeira (e o id dela) e conta as demais', () => {
    const grupos = agruparAlternativasIguais([
      alt('google-1', ['404M'], 710),
      alt('google-2', ['404m'], 710),
      alt('google-3', ['404M'], 710),
      alt('google-4', ['62', '39A'], 1120),
    ])
    expect(grupos.map((g) => [g.principal.alternativa.id, g.semelhantes])).toEqual([
      ['google-1', 2],
      ['google-4', 0],
    ])
  })

  it('mesma sequência com valor diferente, ou sequência diferente, não agrupa', () => {
    const grupos = agruparAlternativasIguais([
      alt('a', ['404M'], 710),
      alt('b', ['404M'], 1420),
      alt('c', ['39A', '62'], 710),
      alt('d', ['62', '39A'], 710),
    ])
    expect(grupos).toHaveLength(4)
  })

  it('perna sem linha identificada nunca é agrupada', () => {
    const grupos = agruparAlternativasIguais([alt('a', [null], null), alt('b', [null], null)])
    expect(grupos).toHaveLength(2)
  })

  it('indeterminadas iguais se agrupam entre si', () => {
    const grupos = agruparAlternativasIguais([alt('a', ['9999Z'], null), alt('b', ['9999Z'], null)])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].semelhantes).toBe(1)
  })
})

describe('textoSemelhantes', () => {
  it('descreve a quantidade em linguagem simples', () => {
    expect(textoSemelhantes(0)).toBeNull()
    expect(textoSemelhantes(1)).toBe('+1 horário parecido')
    expect(textoSemelhantes(2)).toBe('+2 horários parecidos')
  })
})

describe('menorValorComDestaque', () => {
  it('só destaca quando há outra alternativa com valor maior', () => {
    expect(menorValorComDestaque([710, 1420, null])).toBe(710)
    expect(menorValorComDestaque([710, 710])).toBeNull()
    expect(menorValorComDestaque([710])).toBeNull()
    expect(menorValorComDestaque([null, null])).toBeNull()
  })
})
