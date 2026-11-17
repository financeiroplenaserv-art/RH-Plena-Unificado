import { describe, expect, it } from 'vitest'
import type { LancamentoAjusteVT, LinhaLoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import { totalizarColaboradorLote } from '@/lib/vt/loteCarga'

function linha(parcial: Partial<LinhaLoteCargaVT>): LinhaLoteCargaVT {
  return {
    id: 'linha-1',
    colaboradorId: 'pessoa-1',
    departamentoId: 'posto-1',
    data: '2026-11-10',
    origemDia: 'escala',
    decisaoTrajetoId: 'decisao-1',
    decisaoRevisao: 1,
    componentes: [],
    ajustes: [],
    custoDiaCentavos: 1000,
    pendenciaIds: [],
    ...parcial,
  }
}

function ajuste(parcial: Partial<LancamentoAjusteVT>): LancamentoAjusteVT {
  return {
    id: 'ajuste-1',
    loteOrigemId: 'lote-anterior',
    linhaOrigemId: null,
    colaboradorId: 'pessoa-1',
    data: null,
    tipo: 'debito',
    valorCentavos: 500,
    evidencia: 'Ponto conferido',
    criadoPor: 'usuario-1',
    criadoEm: '2026-11-01T10:00:00Z',
    consumidoPorLoteId: null,
    ...parcial,
  }
}

describe('totais por colaborador no lote de carga', () => {
  it('guarda necessidade, débitos, créditos, valor final e lançamentos consumidos', () => {
    const total = totalizarColaboradorLote({
      colaboradorId: 'pessoa-1',
      linhas: [linha({}), linha({ id: 'linha-2', data: '2026-11-11' })],
      ajustesAnteriores: [
        ajuste({ id: 'debito-1', valorCentavos: 500 }),
        ajuste({ id: 'credito-1', tipo: 'credito', valorCentavos: 200 }),
      ],
    })

    expect(total).toMatchObject({
      status: 'completo',
      necessidadeCentavos: 2000,
      ajusteCentavos: -300,
      valorCentavos: 1700,
      excedenteTruncadoCentavos: 0,
      lancamentoAjusteIds: ['debito-1', 'credito-1'],
    })
  })

  it('desconto maior que a necessidade fica no piso zero e conserva o excedente', () => {
    const total = totalizarColaboradorLote({
      colaboradorId: 'pessoa-1',
      linhas: [linha({})],
      ajustesAnteriores: [ajuste({ valorCentavos: 1500 })],
    })

    expect(total.valorCentavos).toBe(0)
    expect(total.excedenteTruncadoCentavos).toBe(500)
  })

  it('pessoa sem dias no mês ainda recebe o ajuste anterior e tem snapshot próprio', () => {
    const total = totalizarColaboradorLote({
      colaboradorId: 'pessoa-1',
      linhas: [],
      ajustesAnteriores: [ajuste({ tipo: 'credito', valorCentavos: 400 })],
    })

    expect(total).toMatchObject({
      status: 'completo',
      necessidadeCentavos: 0,
      ajusteCentavos: 400,
      valorCentavos: 400,
      excedenteTruncadoCentavos: 0,
    })
  })

  it('subtotal parcial não produz valor confirmável', () => {
    const total = totalizarColaboradorLote({
      colaboradorId: 'pessoa-1',
      linhas: [linha({ custoDiaCentavos: null, pendenciaIds: ['sem-preco'] })],
      ajustesAnteriores: [ajuste({})],
    })

    expect(total.status).toBe('parcial')
    expect(total.necessidadeCentavos).toBe(0)
    expect(total.valorCentavos).toBeNull()
    expect(total.excedenteTruncadoCentavos).toBeNull()
    expect(total.pendenciaIds).toContain('sem-preco')
  })

  it('ajuste já consumido ou sem valor não é consumido novamente', () => {
    const total = totalizarColaboradorLote({
      colaboradorId: 'pessoa-1',
      linhas: [linha({})],
      ajustesAnteriores: [
        ajuste({ id: 'ja-consumido', consumidoPorLoteId: 'lote-1' }),
        ajuste({ id: 'sem-valor', valorCentavos: null }),
      ],
    })

    expect(total.status).toBe('parcial')
    expect(total.ajusteCentavos).toBe(0)
    expect(total.lancamentoAjusteIds).toEqual([])
    expect(total.pendenciaIds).toEqual(['sem-valor'])
  })
})
