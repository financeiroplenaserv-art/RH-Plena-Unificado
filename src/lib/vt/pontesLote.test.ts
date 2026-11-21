import { describe, expect, it } from 'vitest'
import { ajustesDoFechamentoAnterior, cargasDoLoteConfirmado } from './pontesLote'
import type { LinhaLoteCargaVT, LoteCargaVT } from './contratosLoteCarga'

const linha = (colaboradorId: string, departamentoId: string, data: string, custo: number | null, origemDia: LinhaLoteCargaVT['origemDia'] = 'escala'): LinhaLoteCargaVT => ({
  id: `${colaboradorId}-${data}`,
  colaboradorId,
  departamentoId,
  data,
  origemDia,
  decisaoTrajetoId: 'd1',
  decisaoRevisao: 1,
  componentes: [],
  ajustes: [],
  custoDiaCentavos: custo,
  pendenciaIds: [],
})

function lote(status: LoteCargaVT['status']): LoteCargaVT {
  return {
    id: 'lote-1',
    competencia: '2026-12',
    status,
    linhas: [
      linha('ana', 'posto-a', '2026-12-02', 890),
      linha('ana', 'posto-a', '2026-12-01', 890),
      linha('ana', 'posto-b', '2026-12-03', 1880, 'cobertura'),
      linha('bia', 'posto-a', '2026-12-01', null),
    ],
    totaisPorColaborador: [
      { colaboradorId: 'ana', status: 'completo', necessidadeCentavos: 3660, ajusteCentavos: -890, valorCentavos: 2770, excedenteTruncadoCentavos: null, lancamentoAjusteIds: [], pendenciaIds: [] },
      { colaboradorId: 'bia', status: 'parcial', necessidadeCentavos: 0, ajusteCentavos: 0, valorCentavos: null, excedenteTruncadoCentavos: null, lancamentoAjusteIds: [], pendenciaIds: ['p1'] },
    ],
  } as unknown as LoteCargaVT
}

describe('cargasDoLoteConfirmado', () => {
  it('vira uma carga gravada por pessoa completa, com datas por posto para o Fechamento', () => {
    const cargas = cargasDoLoteConfirmado(lote('confirmado'), (id) => (id === 'posto-a' ? 'PALAZZO' : 'GREAT'), 'u1', '2026-11-25T10:00:00Z')
    expect(cargas).toHaveLength(1)
    expect(cargas[0]).toMatchObject({
      colaborador_id: 'ana',
      competencia: '2026-12',
      status: 'gravada',
      necessidade_centavos: 3660,
      ajuste_centavos: -890,
      valor_centavos: 2770,
      confirmada_por: 'u1',
    })
    expect(cargas[0].detalhe).toEqual([
      { departamento_id: 'posto-b', posto: 'GREAT', dias: 1, custo_dia_centavos: 1880, subtotal_centavos: 1880, dias_cobertura: 1, dias_treinamento: 0, datas: ['2026-12-03'] },
      { departamento_id: 'posto-a', posto: 'PALAZZO', dias: 2, custo_dia_centavos: 890, subtotal_centavos: 1780, dias_cobertura: 0, dias_treinamento: 0, datas: ['2026-12-01', '2026-12-02'] },
    ])
  })

  it('recusa lote que não está confirmado', () => {
    expect(() => cargasDoLoteConfirmado(lote('rascunho'), () => '', 'u1', '')).toThrow(/confirmado/)
  })
})

describe('ajustesDoFechamentoAnterior', () => {
  it('desconto vira débito e crédito vira crédito; zero não gera lançamento', () => {
    const lancamentos = ajustesDoFechamentoAnterior([
      { id: 'f1', colaborador_id: 'ana', competencia: '2026-11', desconto_centavos: 890, credito_centavos: 0 },
      { id: 'f2', colaborador_id: 'bia', competencia: '2026-11', desconto_centavos: 0, credito_centavos: 1120 },
      { id: 'f3', colaborador_id: 'caio', competencia: '2026-11', desconto_centavos: 0, credito_centavos: null },
    ], '2026-11-25T10:00:00Z')
    expect(lancamentos.map((l) => [l.colaboradorId, l.tipo, l.valorCentavos])).toEqual([
      ['ana', 'debito', 890],
      ['bia', 'credito', 1120],
    ])
    expect(lancamentos.every((l) => l.consumidoPorLoteId === null)).toBe(true)
  })
})
