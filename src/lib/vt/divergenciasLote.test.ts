import { describe, expect, it } from 'vitest'
import type { TotalColaboradorLoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import {
  aprovarDivergenciaColaborador,
  compararTotaisPorColaborador,
  verificarAprovacoesDivergencias,
} from '@/lib/vt/divergenciasLote'

function total(parcial: Partial<TotalColaboradorLoteCargaVT>): TotalColaboradorLoteCargaVT {
  return {
    colaboradorId: 'pessoa-1',
    status: 'completo',
    necessidadeCentavos: 1000,
    ajusteCentavos: 0,
    valorCentavos: 1000,
    excedenteTruncadoCentavos: 0,
    lancamentoAjusteIds: [],
    pendenciaIds: [],
    ...parcial,
  }
}

describe('divergências por colaborador', () => {
  it('reconhece conteúdo igual mesmo com IDs em outra ordem', async () => {
    const divergencias = compararTotaisPorColaborador(
      [total({ lancamentoAjusteIds: ['b', 'a'] })],
      [total({ lancamentoAjusteIds: ['a', 'b'] })],
    )

    expect(divergencias[0]).toMatchObject({ tipo: 'inalterado', exigeAprovacao: false })
    expect(await verificarAprovacoesDivergencias(divergencias, [])).toMatchObject({ completa: true })
    await expect(aprovarDivergenciaColaborador(divergencias[0], 'usuario-1', '2026-11-15T12:00:00Z'))
      .rejects.toThrow('não exige aprovação')
  })

  it('separa inclusão, remoção e alteração de valor', () => {
    const divergencias = compararTotaisPorColaborador(
      [total({}), total({ colaboradorId: 'pessoa-2', valorCentavos: 500 })],
      [total({ valorCentavos: 1200 }), total({ colaboradorId: 'pessoa-3', status: 'parcial', valorCentavos: null })],
    )

    expect(divergencias.map((item) => [item.colaboradorId, item.tipo])).toEqual([
      ['pessoa-1', 'alterado'],
      ['pessoa-2', 'removido'],
      ['pessoa-3', 'incluido'],
    ])
    expect(divergencias[0].diferencaValorCentavos).toBe(200)
    expect(divergencias[1].diferencaValorCentavos).toBeNull()
    expect(divergencias.every((item) => item.exigeAprovacao)).toBe(true)
  })

  it('detecta mudança de pendência sem transformar valor desconhecido em zero', () => {
    const divergencias = compararTotaisPorColaborador(
      [total({})],
      [total({ status: 'parcial', valorCentavos: null, pendenciaIds: ['sem-preco'] })],
    )

    expect(divergencias[0].tipo).toBe('alterado')
    expect(divergencias[0].diferencaValorCentavos).toBeNull()
    expect(divergencias[0].camposAlterados).toEqual(expect.arrayContaining(['situação', 'valor final', 'pendências']))
  })

  it('aprovação vinculada ao conteúdo libera somente aquela divergência', async () => {
    const divergencias = compararTotaisPorColaborador([total({})], [total({ valorCentavos: 1200 })])
    const aprovacao = await aprovarDivergenciaColaborador(divergencias[0], 'usuario-1', '2026-11-15T12:00:00Z')

    const resultado = await verificarAprovacoesDivergencias(divergencias, [aprovacao])

    expect(resultado.completa).toBe(true)
    expect(resultado.pendentes).toEqual([])
    expect(resultado.validas).toEqual([aprovacao])
  })

  it('mudar a mesma pessoa depois da aprovação exige nova revisão', async () => {
    const aprovacao = await aprovarDivergenciaColaborador(
      compararTotaisPorColaborador([total({})], [total({ valorCentavos: 1200 })])[0],
      'usuario-1',
      '2026-11-15T12:00:00Z',
    )
    const novasDivergencias = compararTotaisPorColaborador([total({})], [total({ valorCentavos: 1300 })])

    const resultado = await verificarAprovacoesDivergencias(novasDivergencias, [aprovacao])

    expect(resultado.completa).toBe(false)
    expect(resultado.pendentes.map((item) => item.colaboradorId)).toEqual(['pessoa-1'])
  })

  it('mudar outra pessoa não invalida a aprovação já feita', async () => {
    const antes = [total({}), total({ colaboradorId: 'pessoa-2', valorCentavos: 500 })]
    const duranteAprovacao = [total({ valorCentavos: 1200 }), total({ colaboradorId: 'pessoa-2', valorCentavos: 500 })]
    const aprovacao = await aprovarDivergenciaColaborador(
      compararTotaisPorColaborador(antes, duranteAprovacao).find((item) => item.colaboradorId === 'pessoa-1')!,
      'usuario-1',
      '2026-11-15T12:00:00Z',
    )
    const depois = [total({ valorCentavos: 1200 }), total({ colaboradorId: 'pessoa-2', valorCentavos: 700 })]

    const resultado = await verificarAprovacoesDivergencias(compararTotaisPorColaborador(antes, depois), [aprovacao])

    expect(resultado.completa).toBe(false)
    expect(resultado.validas).toEqual([aprovacao])
    expect(resultado.pendentes.map((item) => item.colaboradorId)).toEqual(['pessoa-2'])
  })
})
