import { describe, it, expect } from 'vitest'
import { compararComLimite, limiteContrato, precoVigente, valorPedido } from './precos'
import { chaveItem, consumoDePedidosAprovados, mediaConsumo, mediasReferencia, unirConsumo } from './media'
import { itensDoKitParaPedido } from './kit'

const precos = [
  { item_id: 'A', variacao_id: null, preco: 10, vigente_desde: '2026-01-01' },
  { item_id: 'A', variacao_id: null, preco: 12, vigente_desde: '2026-06-01' },
  { item_id: 'A', variacao_id: 'v1', preco: 15, vigente_desde: '2026-02-01' },
]

describe('preço vigente', () => {
  it('pega a linha mais recente com vigente_desde <= data', () => {
    expect(precoVigente(precos, 'A', null, '2026-05-01')).toBe(10)
    expect(precoVigente(precos, 'A', null, '2026-06-01')).toBe(12)
    expect(precoVigente(precos, 'A', null, '2025-12-31')).toBeNull()
  })

  it('o preço da variação prevalece; sem preço próprio cai no do item', () => {
    expect(precoVigente(precos, 'A', 'v1', '2026-03-01')).toBe(15)
    expect(precoVigente(precos, 'A', 'v1', '2026-01-15')).toBe(10) // variação ainda sem preço
    expect(precoVigente(precos, 'A', 'v2', '2026-07-01')).toBe(12)
  })

  it('item sem nenhum preço devolve null', () => {
    expect(precoVigente(precos, 'Z', null, '2026-07-01')).toBeNull()
  })
})

describe('limite do contrato e comparação com o pedido', () => {
  it('limite = Σ quantidade do kit × preço vigente; itens sem preço ficam de fora', () => {
    const kit = [
      { item_id: 'A', variacao_id: null, quantidade: 2 },
      { item_id: 'A', variacao_id: 'v1', quantidade: 1 },
      { item_id: 'B', variacao_id: null, quantidade: 5 },
    ]
    const l = limiteContrato(kit, precos, '2026-07-01')
    expect(l.total).toBe(2 * 12 + 15)
    expect(l.itensSemPreco).toHaveLength(1)
    expect(l.itensSemPreco[0].item_id).toBe('B')
  })

  it('valorPedido soma quantidade × preço unitário (snapshot)', () => {
    expect(valorPedido([{ quantidade: 3, preco_unitario: 10.5 }, { quantidade: 2, preco_unitario: null }])).toBe(31.5)
  })

  it('pedido acima do limite', () => {
    expect(compararComLimite(130, 100)).toEqual({ excedeu: true, diferenca: 30, percentual: 1.3 })
    expect(compararComLimite(100, 100).excedeu).toBe(false)
    expect(compararComLimite(10, 0)).toEqual({ excedeu: true, diferenca: 10, percentual: null })
  })
})

describe('média de consumo (6 meses fechados, referência de 12)', () => {
  const hoje = '2026-10-09'
  const c = (competencia: string, quantidade: number) => ({ competencia, item_id: 'A', variacao_id: null, quantidade })
  const consumos = [
    c('2026-09-01', 6),
    c('2026-05-01', 6),
    c('2026-10-01', 10), // mês corrente: fora da média
    c('2026-03-01', 3), // dentro dos 12 meses, fora dos 6
  ]
  const p = [{ item_id: 'A', variacao_id: null, preco: 10, vigente_desde: '2026-01-01' }]

  it('exclui o mês corrente e conta meses sem pedido como zero', () => {
    const m = mediaConsumo(consumos, p, hoje, 6)
    expect(m.meses).toHaveLength(6)
    expect(m.quantidadePorItem[chaveItem('A', null)]).toBe(2) // 12 ÷ 6
    expect(m.valorMedio).toBe(20) // 120 ÷ 6, ao preço atual
    expect(m.valorPorMes['2026-04-01']).toBe(0)
    expect(m.valorPorMes['2026-09-01']).toBe(60)
  })

  it('média de 12 meses como referência de sazonalidade', () => {
    const { media6, media12 } = mediasReferencia(consumos, p, hoje)
    expect(media6.meses).toHaveLength(6)
    expect(media12.meses).toHaveLength(12)
    expect(media12.quantidadePorItem[chaveItem('A', null)]).toBe(1.25) // 15 ÷ 12
  })

  it('item sem preço aparece em itensSemPreco e fica fora do valor', () => {
    const m = mediaConsumo([{ competencia: '2026-09-01', item_id: 'X', variacao_id: null, quantidade: 4 }], p, hoje, 6)
    expect(m.itensSemPreco).toEqual([chaveItem('X', null)])
    expect(m.valorMedio).toBe(0)
  })

  it('histórico e pedidos aprovados não se sobrepõem na mesma competência', () => {
    const hist = [c('2026-08-01', 5), c('2026-09-01', 99)]
    const ped = [c('2026-09-01', 7)]
    const u = unirConsumo(hist, ped)
    expect(u).toHaveLength(2)
    expect(u.find((x) => x.competencia === '2026-09-01')?.quantidade).toBe(7)
    expect(u.find((x) => x.competencia === '2026-08-01')?.quantidade).toBe(5)
  })

  it('consumo dos pedidos soma qtd_aprovada só de pedidos aprovados', () => {
    const r = consumoDePedidosAprovados(
      [
        { id: 'p1', competencia: '2026-09-01', status_produtos: 'aprovado' },
        { id: 'p2', competencia: '2026-09-01', status_produtos: 'aprovado' },
        { id: 'p3', competencia: '2026-09-01', status_produtos: 'validado' },
      ],
      [
        { pedido_id: 'p1', item_id: 'A', variacao_id: null, qtd_aprovada: 2 },
        { pedido_id: 'p2', item_id: 'A', variacao_id: null, qtd_aprovada: 3 },
        { pedido_id: 'p3', item_id: 'A', variacao_id: null, qtd_aprovada: 9 },
        { pedido_id: 'p1', item_id: null, variacao_id: null, qtd_aprovada: 4 },
      ]
    )
    expect(r).toEqual([{ competencia: '2026-09-01', item_id: 'A', variacao_id: null, quantidade: 5 }])
  })
})

describe('kit com periodicidade', () => {
  const kit = [
    { item_id: 'A', variacao_id: null, quantidade: 2, periodicidade_meses: 1 },
    { item_id: 'B', variacao_id: null, quantidade: 2, periodicidade_meses: 2 },
    { item_id: 'C', variacao_id: null, quantidade: 0, periodicidade_meses: 1 },
  ]
  const consumo = (competencia: string) => ({ competencia, item_id: 'B', variacao_id: null, quantidade: 2 })

  it('item a cada 2 meses sai se houve consumo no mês anterior', () => {
    const itens = itensDoKitParaPedido(kit, '2026-10-01', [consumo('2026-09-01')])
    expect(itens.map((i) => i.item_id)).toEqual(['A'])
  })

  it('item a cada 2 meses entra se o último consumo foi há 2 meses ou mais', () => {
    const itens = itensDoKitParaPedido(kit, '2026-10-01', [consumo('2026-08-01')])
    expect(itens.map((i) => i.item_id)).toEqual(['A', 'B'])
  })

  it('quantidade zero nunca entra', () => {
    expect(itensDoKitParaPedido(kit, '2026-10-01', []).some((i) => i.item_id === 'C')).toBe(false)
  })
})
