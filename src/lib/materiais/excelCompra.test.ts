import { describe, expect, it } from 'vitest'
import type { MatCompraItem } from '@/types/materiais'
import {
  aoaCompraAoFornecedor,
  aoaEntregaPorRota,
  aoaPedidoPorCliente,
  montarMatrizCompra,
  nomeArquivoCompra,
} from './excelCompra'

const cel = (p: Partial<MatCompraItem>): MatCompraItem => ({
  id: Math.random().toString(36),
  compra_id: 'comp',
  item_id: 'cloro',
  variacao_id: null,
  contrato_id: 'abaete',
  item_nome: 'Cloro 5L',
  variacao_rotulo: null,
  unidade: 'GL',
  categoria: 'limpeza',
  contrato_nome: 'Abaeté',
  rota: 1,
  quantidade: 6,
  preco_unitario: 12.5,
  qtd_recebida: null,
  motivo_recebimento: null,
  recebido_em: null,
  entrega_local: 'posto',
  ...p,
})

const itens = [
  cel({}),
  cel({ contrato_id: 'telex', contrato_nome: 'Telex Sede', rota: 3, quantidade: 3 }),
  cel({ item_id: 'borr', item_nome: 'Borrifador UN', preco_unitario: 4, quantidade: 4 }),
  cel({ item_id: 'borr', item_nome: 'Borrifador UN', preco_unitario: 4, contrato_id: 'back', contrato_nome: 'Back Art', rota: 1, quantidade: 3 }),
  cel({ item_id: 'borr', item_nome: 'Borrifador UN', preco_unitario: 4, contrato_id: null, contrato_nome: null, rota: null, quantidade: 2, entrega_local: 'escritorio' }),
  cel({ item_id: 'disco', item_nome: 'Disco preto UN', variacao_id: 'v350', variacao_rotulo: '350 mm', preco_unitario: null, contrato_id: 'sem', contrato_nome: 'Zeta', rota: null, quantidade: 1 }),
]

describe('montarMatrizCompra', () => {
  const m = montarMatrizCompra(itens)
  it('contratos agrupados por rota (sem rota no fim), itens em ordem alfabética', () => {
    expect(m.colunas.map((c) => `${c.rota}:${c.nome}`)).toEqual(['1:Abaeté', '1:Back Art', '3:Telex Sede', 'null:Zeta'])
    expect(m.linhas.map((l) => l.descricao)).toEqual(['Borrifador UN', 'Cloro 5L', 'Disco preto 350 mm UN'])
  })
  it('totais por item, por contrato, estoque e geral', () => {
    const borr = m.linhas[0]
    expect(borr).toMatchObject({ estoque: 2, total: 9, valor: 36 })
    expect(m.totalPorContrato).toEqual({ abaete: 10, telex: 3, back: 3, sem: 1 })
    expect(m.totalEstoque).toBe(2)
    expect(m.totalGeral).toBe(19)
    expect(m.valorGeral).toBe(36 + 9 * 12.5)
    expect(m.itensSemPreco).toBe(1)
  })
})

describe('abas do Excel', () => {
  const m = montarMatrizCompra(itens)
  const cab = { fornecedor: 'Antolimp', competencia: '2026-10-01', numero: 'COMP-2026-10-001' }
  it('Pedido por Cliente SEM preço: rotas em cima, contratos, Estoque e Total', () => {
    const aoa = aoaPedidoPorCliente(m, cab, false)
    expect(aoa[1]).toEqual(['Mês', '10/2026'])
    expect(aoa[4]).toEqual(['', 'Rota 1', '', 'Rota 3', 'Sem rota', '', ''])
    expect(aoa[5]).toEqual(['Item', 'Abaeté', 'Back Art', 'Telex Sede', 'Zeta', 'Estoque', 'Total'])
    expect(aoa[6]).toEqual(['Borrifador UN', 4, 3, null, null, 2, 9])
    expect(aoa[aoa.length - 1]).toEqual(['Total', 10, 3, 3, 1, 2, 19])
    expect(JSON.stringify(aoa)).not.toContain('12.5')
  })
  it('versão interna com valores', () => {
    const aoa = aoaPedidoPorCliente(m, cab, true)
    expect(aoa[5].slice(-2)).toEqual(['Preço unitário', 'Valor'])
    expect(aoa[7]).toEqual(['Cloro 5L', 6, null, 3, null, null, 9, 12.5, 112.5])
  })
  it('Compra ao Fornecedor e Entrega por Rota', () => {
    const c = aoaCompraAoFornecedor(m, cab, false)
    expect(c[4]).toEqual(['Item', 'Quantidade'])
    expect(c[c.length - 1]).toEqual(['Total Geral', 19])
    const e = aoaEntregaPorRota(m)
    expect(e[1]).toEqual(['Rota 1', 'Abaeté', 'Borrifador UN', 4])
    expect(e[e.length - 1]).toEqual(['Escritório', 'Estoque (reposição)', 'Borrifador UN', 2])
  })
  it('sem reposição não há coluna Estoque', () => {
    const m2 = montarMatrizCompra(itens.filter((i) => i.contrato_id))
    expect(aoaPedidoPorCliente(m2, cab, false)[5]).not.toContain('Estoque')
  })
})

describe('nomeArquivoCompra', () => {
  it('sem acento nem espaço', () => {
    expect(nomeArquivoCompra('Loja das Bombas Ltda.', { competencia: '2026-10-01', numero: 'COMP-2026-10-003' }, false)).toBe(
      'Pedido_Loja-das-Bombas-Ltda_10-2026_COMP-2026-10-003.xlsx'
    )
    expect(nomeArquivoCompra('Antolímp', { competencia: '2026-10-01', numero: 'COMP-2026-10-001' }, true)).toBe(
      'Pedido_Antolimp_10-2026_COMP-2026-10-001_com-valores.xlsx'
    )
  })
})
