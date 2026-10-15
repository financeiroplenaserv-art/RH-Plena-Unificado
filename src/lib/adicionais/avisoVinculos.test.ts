import { describe, it, expect } from 'vitest'
import { deveAvisarVinculosFaltando } from './avisoVinculos'

describe('deveAvisarVinculosFaltando', () => {
  it('avisa quando metade ou mais está sem vínculo (caso da virada de período esquecida)', () => {
    expect(deveAvisarVinculosFaltando(182, 179)).toBe(true) // caso real de 14/10/2026
    expect(deveAvisarVinculosFaltando(10, 5)).toBe(true)
    expect(deveAvisarVinculosFaltando(5, 3)).toBe(true)
  })

  it('não avisa quando a minoria está sem vínculo (situação normal)', () => {
    expect(deveAvisarVinculosFaltando(182, 10)).toBe(false)
    expect(deveAvisarVinculosFaltando(10, 4)).toBe(false)
    expect(deveAvisarVinculosFaltando(5, 2)).toBe(false)
  })

  it('não avisa em espelhos pequenos/parciais (menos de 5 com ponto)', () => {
    expect(deveAvisarVinculosFaltando(4, 4)).toBe(false)
    expect(deveAvisarVinculosFaltando(1, 1)).toBe(false)
    expect(deveAvisarVinculosFaltando(0, 0)).toBe(false)
  })
})
