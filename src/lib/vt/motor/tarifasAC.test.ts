import { describe, expect, it } from 'vitest'
import { ehLinhaCategoriaAC } from './tarifas'

describe('ehLinhaCategoriaAC (auditoria de 21/11/2026)', () => {
  it('toda linha AC da tabela DETRO fica fora do BUI presumido, não só 2144R/4144R', () => {
    for (const linha of ['2144R', '4144R', '6144R', '2590R', '2520D', '2425D', '4425D']) {
      expect(ehLinhaCategoriaAC(linha), linha).toBe(true)
    }
  })

  it('linhas comuns e código vazio não são AC', () => {
    for (const linha of ['404M', '515M', '62', '', null]) {
      expect(ehLinhaCategoriaAC(linha), String(linha)).toBe(false)
    }
  })
})
