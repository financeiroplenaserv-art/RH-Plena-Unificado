import type { MatKitItem, MatPreco } from '@/types/materiais'

// Preço vigente, limite em R$ do contrato (Kit × preço) e comparação com o
// valor pedido. O histórico de preços nunca é alterado (nova linha a cada
// mudança): vigente = linha mais recente com vigente_desde <= data.

export type PrecoHistorico = Pick<MatPreco, 'item_id' | 'variacao_id' | 'preco' | 'vigente_desde'> & {
  created_at?: string
}

function maisRecente(candidatas: PrecoHistorico[]): PrecoHistorico | null {
  let melhor: PrecoHistorico | null = null
  for (const p of candidatas) {
    if (
      !melhor ||
      p.vigente_desde > melhor.vigente_desde ||
      (p.vigente_desde === melhor.vigente_desde && (p.created_at ?? '') >= (melhor.created_at ?? ''))
    ) {
      melhor = p
    }
  }
  return melhor
}

/**
 * Preço vigente do item na data. O preço próprio da variação, quando existe,
 * prevalece sobre o do item; senão vale o do item (variacao_id nulo).
 */
export function precoVigente(
  precos: PrecoHistorico[],
  itemId: string,
  variacaoId: string | null,
  data: string
): number | null {
  const doItem = precos.filter((p) => p.item_id === itemId && p.vigente_desde <= data)
  if (variacaoId) {
    const daVariacao = maisRecente(doItem.filter((p) => p.variacao_id === variacaoId))
    if (daVariacao) return Number(daVariacao.preco)
  }
  const base = maisRecente(doItem.filter((p) => p.variacao_id == null))
  return base ? Number(base.preco) : null
}

export interface LimiteContrato {
  /** Σ quantidade × preço vigente (itens com preço). */
  total: number
  /** Itens do kit sem preço cadastrado (ficam fora do total). */
  itensSemPreco: Pick<MatKitItem, 'item_id' | 'variacao_id' | 'quantidade'>[]
}

/**
 * Limite mensal em R$ do contrato = Σ quantidade do Kit × preço vigente.
 * (A periodicidade do item só afeta o "preencher pelo kit", não o limite.)
 */
export function limiteContrato(
  kit: Pick<MatKitItem, 'item_id' | 'variacao_id' | 'quantidade'>[],
  precos: PrecoHistorico[],
  data: string
): LimiteContrato {
  let total = 0
  const itensSemPreco: LimiteContrato['itensSemPreco'] = []
  for (const k of kit) {
    const preco = precoVigente(precos, k.item_id, k.variacao_id, data)
    if (preco == null) itensSemPreco.push(k)
    else total += Number(k.quantidade) * preco
  }
  return { total: arredondar(total), itensSemPreco }
}

/** Valor do pedido a partir de linhas com quantidade e preço unitário. */
export function valorPedido(linhas: { quantidade: number; preco_unitario: number | null }[]): number {
  return arredondar(linhas.reduce((s, l) => s + l.quantidade * (l.preco_unitario ?? 0), 0))
}

export interface ComparacaoLimite {
  excedeu: boolean
  /** valor − limite (positivo = passou). */
  diferenca: number
  /** valor ÷ limite (null se limite = 0). */
  percentual: number | null
}

export function compararComLimite(valor: number, limite: number): ComparacaoLimite {
  return {
    excedeu: valor > limite,
    diferenca: arredondar(valor - limite),
    percentual: limite > 0 ? valor / limite : null,
  }
}

export function arredondar(n: number): number {
  return Math.round(n * 100) / 100
}
