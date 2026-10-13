import { describe, it, expect } from 'vitest'
import { progressoComunicacao } from './comunicacaoCobertura'

describe('progressoComunicacao', () => {
  const vazio = {
    informativo_cliente_em: null,
    contato_titular_em: null,
    contato_ferista_em: null,
    encarregado_lider: null,
  }

  it('0/4 quando nada preenchido', () => {
    expect(progressoComunicacao(vazio)).toBe(0)
  })

  it('conta cada item preenchido', () => {
    expect(progressoComunicacao({ ...vazio, informativo_cliente_em: '2026-10-01' })).toBe(1)
    expect(progressoComunicacao({ ...vazio, informativo_cliente_em: '2026-10-01', contato_titular_em: '2026-10-02', encarregado_lider: 'Marcos' })).toBe(3)
  })

  it('texto vazio não conta', () => {
    expect(progressoComunicacao({ ...vazio, encarregado_lider: '' })).toBe(0)
  })

  it('4/4 completo', () => {
    expect(progressoComunicacao({
      informativo_cliente_em: '2026-10-01',
      contato_titular_em: '2026-10-02',
      contato_ferista_em: '2026-10-03',
      encarregado_lider: 'Marcos',
    })).toBe(4)
  })
})
