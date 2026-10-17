import { describe, expect, it } from 'vitest'
import { avisosItemParaContrato, avisoItemOculto, inclusaoReabrePedido, podeEditarLinhasDoPedido, validarInclusao } from './inclusaoPedido'

describe('podeEditarLinhasDoPedido', () => {
  it('em validação/validado: inspetor, gestor e admin', () => {
    expect(podeEditarLinhasDoPedido('em_validacao', true, false)).toBe(true)
    expect(podeEditarLinhasDoPedido('validado', true, false)).toBe(true)
    expect(podeEditarLinhasDoPedido('em_validacao', false, false)).toBe(false)
  })
  it('aprovado: só gestor/admin (e a inclusão reabre o pedido)', () => {
    expect(podeEditarLinhasDoPedido('aprovado', true, false)).toBe(false)
    expect(podeEditarLinhasDoPedido('aprovado', true, true)).toBe(true)
    expect(inclusaoReabrePedido('aprovado')).toBe(true)
    expect(inclusaoReabrePedido('validado')).toBe(false)
  })
  it('rascunho, enviado e cancelado: nunca', () => {
    for (const s of ['rascunho', 'enviado', 'cancelado', 'nao_se_aplica'] as const) expect(podeEditarLinhasDoPedido(s, true, true)).toBe(false)
  })
})

describe('validarInclusao', () => {
  it('motivo é obrigatório', () => {
    expect(validarInclusao({ itemId: 'a', quantidade: 2, motivo: '  ' })).toMatch(/Qual o motivo/)
    expect(validarInclusao({ itemId: 'a', quantidade: 2, motivo: 'faltou' })).toBeNull()
  })
  it('item e quantidade válidos', () => {
    expect(validarInclusao({ itemId: null, quantidade: 2, motivo: 'x' })).toMatch(/item/)
    expect(validarInclusao({ itemId: 'a', quantidade: 0, motivo: 'x' })).toMatch(/quantidade/)
    expect(validarInclusao({ itemId: 'a', quantidade: 1000, motivo: 'x' })).toMatch(/999/)
  })
})

describe('avisos do item para o contrato', () => {
  it('escondido do contrato avisa; exclusivo de outro avisa; normal não', () => {
    expect(avisoItemOculto({ contratos_ocultos: ['c1'] }, 'c1')).toMatch(/escondido/)
    expect(avisoItemOculto({ contratos_ocultos: ['c1'] }, 'c2')).toBeNull()
    expect(avisosItemParaContrato({ contratos_exclusivos: ['cnooc'] }, 'c2', ['CNOOC'])).toMatch(/exclusivo de CNOOC/)
    expect(avisosItemParaContrato({}, 'c2', [])).toBeNull()
  })
})
