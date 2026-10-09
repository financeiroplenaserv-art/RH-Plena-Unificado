import { competenciaDe, mesesFechados } from './datas'
import { arredondar, precoVigente, type PrecoHistorico } from './precos'

// Média de consumo do contrato. Referência do painel do gestor: ÚLTIMOS 6
// MESES FECHADOS (exclui o mês corrente; mês sem pedido conta como ZERO), em
// quantidade e em R$ ao PREÇO VIGENTE ATUAL — comparável ao limite (kit ×
// preço atual). A média de 12 meses é só referência de sazonalidade.

export interface ConsumoMes {
  /** 1º dia do mês */
  competencia: string
  item_id: string
  variacao_id: string | null
  quantidade: number
}

export const chaveItem = (itemId: string, variacaoId: string | null) => `${itemId}|${variacaoId ?? ''}`

/**
 * Une o histórico das planilhas com os pedidos aprovados no CORH sem
 * sobreposição: se a competência tem consumo vindo do CORH, vale só ele; senão
 * vale o histórico.
 */
export function unirConsumo(historico: ConsumoMes[], pedidosAprovados: ConsumoMes[]): ConsumoMes[] {
  const comPedido = new Set(pedidosAprovados.map((c) => competenciaDe(c.competencia)))
  return [...historico.filter((h) => !comPedido.has(competenciaDe(h.competencia))), ...pedidosAprovados]
}

export interface MediaConsumo {
  /** Meses considerados (competências), do mais antigo ao mais recente. */
  meses: string[]
  /** Quantidade média por mês de cada item (chave = chaveItem). */
  quantidadePorItem: Record<string, number>
  /** Valor médio mensal em R$ (preço vigente em `hoje`). */
  valorMedio: number
  /** Valor de cada mês ao preço atual (mês sem consumo = 0). */
  valorPorMes: Record<string, number>
  /** Itens consumidos no período sem preço vigente (ficam fora do valor). */
  itensSemPreco: string[]
}

export function mediaConsumo(
  consumos: ConsumoMes[],
  precos: PrecoHistorico[],
  hoje: string,
  nMeses = 6
): MediaConsumo {
  const meses = mesesFechados(hoje, nMeses)
  const noPeriodo = new Set(meses)
  const somaItem: Record<string, number> = {}
  const valorPorMes: Record<string, number> = Object.fromEntries(meses.map((m) => [m, 0]))
  const semPreco = new Set<string>()

  for (const c of consumos) {
    const comp = competenciaDe(c.competencia)
    if (!noPeriodo.has(comp)) continue
    const chave = chaveItem(c.item_id, c.variacao_id)
    somaItem[chave] = (somaItem[chave] ?? 0) + c.quantidade
    const preco = precoVigente(precos, c.item_id, c.variacao_id, hoje)
    if (preco == null) semPreco.add(chave)
    else valorPorMes[comp] += c.quantidade * preco
  }

  const quantidadePorItem = Object.fromEntries(
    Object.entries(somaItem).map(([k, v]) => [k, arredondar(v / nMeses)])
  )
  const total = Object.values(valorPorMes).reduce((s, v) => s + v, 0)
  return {
    meses,
    quantidadePorItem,
    valorMedio: arredondar(total / nMeses),
    valorPorMes: Object.fromEntries(Object.entries(valorPorMes).map(([k, v]) => [k, arredondar(v)])),
    itensSemPreco: [...semPreco],
  }
}

/** Médias de 6 meses (base do painel) e de 12 meses (referência de sazonalidade). */
export function mediasReferencia(consumos: ConsumoMes[], precos: PrecoHistorico[], hoje: string) {
  return { media6: mediaConsumo(consumos, precos, hoje, 6), media12: mediaConsumo(consumos, precos, hoje, 12) }
}

/** Consumo vindo dos pedidos aprovados (soma de qtd_aprovada por mês/item). */
export function consumoDePedidosAprovados(
  pedidos: { id: string; competencia: string; status_produtos: string }[],
  itens: { pedido_id: string; item_id: string | null; variacao_id: string | null; qtd_aprovada: number | null }[]
): ConsumoMes[] {
  const comp = new Map(
    pedidos.filter((p) => p.status_produtos === 'aprovado').map((p) => [p.id, competenciaDe(p.competencia)])
  )
  const acum = new Map<string, ConsumoMes>()
  for (const i of itens) {
    const competencia = comp.get(i.pedido_id)
    if (!competencia || !i.item_id || !i.qtd_aprovada) continue
    const k = `${competencia}|${chaveItem(i.item_id, i.variacao_id)}`
    const atual = acum.get(k)
    if (atual) atual.quantidade += i.qtd_aprovada
    else acum.set(k, { competencia, item_id: i.item_id, variacao_id: i.variacao_id, quantidade: i.qtd_aprovada })
  }
  return [...acum.values()]
}
