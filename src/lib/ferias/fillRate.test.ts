import { describe, it, expect } from 'vitest'
import { calcularFillRate, faixaMetaFillRate, META_FILL_RATE } from './fillRate'
import type { StatusSolicitacaoFerias } from '@/types/ferias'

function solicitacao(status: StatusSolicitacaoFerias, data_inicio: string, ferista_alocado_id: string | null) {
  return { status, data_inicio, ferista_alocado_id }
}

describe('calcularFillRate', () => {
  it('calcula a proporção de solicitadas com ferista no ano', () => {
    const lista = [
      solicitacao('aprovada', '2026-03-01', 'f1'),
      solicitacao('concluida', '2026-05-10', null),
      solicitacao('em_andamento', '2026-09-15', 'f2'),
      solicitacao('aprovada', '2026-11-01', null),
    ]
    const resultado = calcularFillRate(lista, 2026)
    expect(resultado.total).toBe(4)
    expect(resultado.alocadas).toBe(2)
    expect(resultado.taxa).toBe(0.5)
  })

  it('ignora pendente e cancelada e outros anos', () => {
    const lista = [
      solicitacao('pendente', '2026-03-01', 'f1'),
      solicitacao('cancelada', '2026-04-01', null),
      solicitacao('concluida', '2025-12-01', 'f1'),
    ]
    const resultado = calcularFillRate(lista, 2026)
    expect(resultado.total).toBe(0)
  })

  it('devolve taxa null (não NaN) quando o denominador é zero', () => {
    const resultado = calcularFillRate([], 2026)
    expect(resultado.taxa).toBeNull()
    expect(resultado.total).toBe(0)
    expect(resultado.alocadas).toBe(0)
  })
})

describe('faixaMetaFillRate', () => {
  it('verde a partir de 85%', () => {
    expect(faixaMetaFillRate(META_FILL_RATE.verde)).toBe('verde')
    expect(faixaMetaFillRate(0.92)).toBe('verde')
    expect(faixaMetaFillRate(1)).toBe('verde')
  })

  it('âmbar entre 70% e 84,9%', () => {
    expect(faixaMetaFillRate(META_FILL_RATE.ambar)).toBe('ambar')
    expect(faixaMetaFillRate(0.849)).toBe('ambar')
  })

  it('vermelho abaixo de 70%', () => {
    expect(faixaMetaFillRate(0.699)).toBe('vermelho')
    expect(faixaMetaFillRate(0)).toBe('vermelho')
  })
})
