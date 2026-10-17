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
  const mapa = mapaSubstituicoes(vinculos)
  let data: string | null = null
  let quantidade = 0
  for (const f of fatos) {
    if (!(f.quantidade > 0) || f.competencia >= antesDe) continue
    if (f.item_id !== itemId && resolverSubstituto(f.item_id, null, mapa).item_id !== itemId) continue
    if (data == null || f.competencia > data) {
      data = f.competencia
      quantidade = f.quantidade
    } else if (f.competencia === data) {
      quantidade += f.quantidade
    }
  }
  return data ? { data, quantidade: Math.round(quantidade * 100) / 100 } : null
}

/**
 * A última entrega foi há menos tempo que a validade do item? (então este
 * pedido chega "antes do prazo"). Sem validade cadastrada, nunca.
 */
export function antesDoPrazo(ultimaData: string, validadeMeses: number | null | undefined, hoje: string): boolean {
  if (!validadeMeses || validadeMeses <= 0) return false
  return adicionarMeses(ultimaData, validadeMeses) > hoje
}
