import { adicionarMeses } from './datas'
import { mapaSubstituicoes, resolverSubstituto, type VinculoSubstituicao } from './substituicao'

// "Última vez que este contrato recebeu este item" — só para as telas
// INTERNAS (detalhe do pedido: inspetor valida, gestor aprova). Nunca vai
// para o link público do líder. Calculado na leitura, a partir do histórico
// das planilhas e dos pedidos já aprovados/entregues do contrato; considera a
// cadeia de substituição (o item novo herda a última entrega do que ele
// substituiu).

/** Um fato de entrega: o contrato recebeu `quantidade` do item na competência. */
export interface FatoEntrega {
  item_id: string
  /** AAAA-MM-DD (1º dia da competência). */
  competencia: string
  quantidade: number
}

export interface UltimaEntrega {
  /** AAAA-MM-DD */
  data: string
  quantidade: number
}

/**
 * Histórico completo de entregas do item ao contrato, estritamente ANTES de
 * `antesDe`, da mais recente para a mais antiga — uma linha por competência,
 * somando o que entrou nela (variações, linhas repetidas e itens substituídos).
 */
export function historicoEntregasDoItem(
  itemId: string,
  fatos: FatoEntrega[],
  vinculos: VinculoSubstituicao[],
  antesDe: string
): UltimaEntrega[] {
  const mapa = mapaSubstituicoes(vinculos)
  const porData = new Map<string, number>()
  for (const f of fatos) {
    if (!(f.quantidade > 0) || f.competencia >= antesDe) continue
    if (f.item_id !== itemId && resolverSubstituto(f.item_id, null, mapa).item_id !== itemId) continue
    porData.set(f.competencia, (porData.get(f.competencia) ?? 0) + f.quantidade)
  }
  return [...porData.entries()]
    .sort((x, y) => (x[0] < y[0] ? 1 : x[0] > y[0] ? -1 : 0))
    .map(([data, q]) => ({ data, quantidade: Math.round(q * 100) / 100 }))
}

/**
 * Última entrega do item ao contrato, estritamente ANTES de `antesDe`
 * (competência do pedido em análise). A quantidade soma tudo que entrou na
 * mesma competência (variações, linhas repetidas e itens substituídos).
 */
export function ultimaEntregaDoItem(
  itemId: string,
  fatos: FatoEntrega[],
  vinculos: VinculoSubstituicao[],
  antesDe: string
): UltimaEntrega | null {
  return historicoEntregasDoItem(itemId, fatos, vinculos, antesDe)[0] ?? null
}

/**
 * A última entrega foi há menos tempo que a validade do item? (então este
 * pedido chega "antes do prazo"). Sem validade cadastrada, nunca.
 */
export function antesDoPrazo(ultimaData: string, validadeMeses: number | null | undefined, hoje: string): boolean {
  if (!validadeMeses || validadeMeses <= 0) return false
  return adicionarMeses(ultimaData, validadeMeses) > hoje
}
