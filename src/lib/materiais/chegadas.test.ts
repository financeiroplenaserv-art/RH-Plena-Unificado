import { describe, expect, it } from 'vitest'
import type { MatCompraItem } from '@/types/materiais'
import {
  agruparCelulasPorContrato,
  celulaPendente,
  erroChegada,
  erroRemanejamento,
  montarPayloadChegada,
  montarPayloadRemanejamento,
  normalizarChegadas,
  remanejamentosDaCompra,
  type RemanejamentoChegada,
} from './chegadas'

const cel = (p: Partial<MatCompraItem>): MatCompraItem =>
  ({
    id: 'c1',
    compra_id: 'k',
    item_id: 'cloro',
    variacao_id: null,
    contrato_id: 'abaete',
    item_nome: 'Cloro 5L',
    variacao_rotulo: null,
    unidade: 'GL',
    categoria: 'limpeza',
    contrato_nome: 'Abaeté',
    rota: 2,
    quantidade: 6,
    preco_unitario: 10,
    qtd_recebida: null,
    motivo_recebimento: null,
    recebido_em: null,
    entrega_local: 'posto',
    ...p,
  }) as MatCompraItem

describe('agruparCelulasPorContrato', () => {
  it('agrupa por contrato, ordena por rota e põe a reposição do estoque no fim', () => {
    const g = agruparCelulasPorContrato([
      cel({ id: 'a' }),
      cel({ id: 'b', contrato_id: null, contrato_nome: null, rota: null, entrega_local: 'escritorio' }),
      cel({ id: 'c', contrato_id: 'telex', contrato_nome: 'Telex', rota: 1, qtd_recebida: 6 }),
      cel({ id: 'd', item_nome: 'Álcool 70%' }),
    ])
    expect(g.map((x) => x.contratoNome)).toEqual(['Telex', 'Abaeté', 'Reposição do estoque (escritório)'])
    expect(g[0].registrado).toBe(true)
    expect(g[1].registrado).toBe(false)
    expect(g[1].celulas.map((c) => c.id)).toEqual(['d', 'a'])
  })
})

describe('erroChegada (mesmas travas da RPC)', () => {
  it('padrão = comprado; menor exige motivo; maior recusado', () => {
    expect(erroChegada(cel({}), { qtd: '6', motivo: '' })).toBeNull()
    expect(erroChegada(cel({}), { qtd: '4', motivo: '' })).toMatch(/motivo/)
    expect(erroChegada(cel({}), { qtd: '4', motivo: 'faltou no fornecedor' })).toBeNull()
    expect(erroChegada(cel({}), { qtd: '7', motivo: '' })).toMatch(/Maior que o comprado/)
    expect(erroChegada(cel({}), { qtd: 'x', motivo: '' })).toMatch(/inválida/)
  })
  it('reposição do estoque só aumenta', () => {
    expect(erroChegada(cel({ contrato_id: null, qtd_recebida: 5 }), { qtd: '3', motivo: 'x' })).toMatch(/só aumenta/)
  })
})

describe('montarPayloadChegada', () => {
  it('"chegou tudo" manda o comprado das células ainda não completas', () => {
    const { payload } = montarPayloadChegada([cel({ id: 'a' }), cel({ id: 'b', qtd_recebida: 6 })], {}, true)
    expect(payload).toEqual([{ id: 'a', qtd_recebida: 6, motivo: null }])
  })
  it('manda só o que está pendente ou foi alterado, com o motivo quando menor', () => {
    const celulas = [cel({ id: 'a' }), cel({ id: 'b', qtd_recebida: 6 }), cel({ id: 'c', qtd_recebida: 6 })]
    const { payload, erros } = montarPayloadChegada(celulas, { a: { qtd: '5', motivo: ' quebrou ' }, c: { qtd: '6', motivo: '' } })
    expect(erros).toEqual([])
    expect(payload).toEqual([{ id: 'a', qtd_recebida: 5, motivo: 'quebrou' }])
    expect(celulaPendente(celulas[1], undefined)).toBe(false)
  })
  it('devolve os erros em vez de mandar algo que o banco recusaria', () => {
    const { payload, erros } = montarPayloadChegada([cel({ id: 'a' })], { a: { qtd: '2', motivo: '' } })
    expect(payload).toEqual([])
    expect(erros[0].id).toBe('a')
  })
})

const rem = (p: Partial<RemanejamentoChegada>): RemanejamentoChegada => ({
  linha_id: 'l1',
  pedido_id: 'p1',
  competencia: '2026-10-01',
  contrato_id: 'b',
  contrato_nome: 'Back Art',
  rota: 2,
  origem_id: 'a',
  origem_nome: 'Abaeté',
  item_id: 'i',
  variacao_id: null,
  item_nome: 'Cloro 5L',
  variacao_rotulo: null,
  unidade: 'GL',
  qtd_remanejada: 3,
  qtd_entregue_remanejada: null,
  remanejamento_obs: null,
  motivo_entrega: null,
  confirmado_em: null,
  status_pedido: 'em_compra',
  compras: ['k1'],
  ...p,
})

describe('remanejamento feito', () => {
  it('padrão = remanejado; menor exige motivo; maior recusado', () => {
    expect(erroRemanejamento(rem({}), { qtd: '3', motivo: '' })).toBeNull()
    expect(erroRemanejamento(rem({}), { qtd: '1', motivo: '' })).toMatch(/motivo/)
    expect(erroRemanejamento(rem({}), { qtd: '4', motivo: '' })).toMatch(/Maior/)
    const { payload } = montarPayloadRemanejamento([rem({})], {})
    expect(payload).toEqual([{ id: 'l1', qtd: 3, motivo: null }])
  })
  it('normaliza a RPC e filtra os remanejamentos de uma compra', () => {
    const d = normalizarChegadas({
      remanejamentos: [{ ...rem({}), qtd_remanejada: '3', rota: '2', compras: ['k1'] }, { ...rem({ linha_id: 'l2' }), compras: [] }],
      pedidos: [{ pedido_id: 'p1', implantacao: true }],
    })
    expect(d.remanejamentos[0].qtd_remanejada).toBe(3)
    expect(d.pedidos[0].implantacao).toBe(true)
    expect(remanejamentosDaCompra(d.remanejamentos, 'k1').map((r) => r.linha_id)).toEqual(['l1'])
  })
})
