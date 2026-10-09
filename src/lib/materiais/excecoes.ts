import type { MatKitItem } from '@/types/materiais'
import { adicionarMeses } from './datas'

// Exceções de uma linha de produto do pedido. O SERVIDOR recalcula; o cliente
// só usa para exibir a justificativa obrigatória. Exceção não bloqueia o
// pedido: exige justificativa e manda o pedido para a validação do inspetor.

export interface LinhaProdutoExcecao {
  item_id: string | null
  variacao_id: string | null
  quantidade: number
}

export interface EntradaExcecao {
  linha: LinhaProdutoExcecao
  kit: Pick<MatKitItem, 'item_id' | 'variacao_id' | 'quantidade'>[]
  /** validade_meses do item no catálogo (null = sem controle de validade). */
  validadeMeses: number | null
  /** Última entrega do item ao contrato (AAAA-MM-DD), se houver. */
  ultimaEntrega: string | null
  hoje: string
}

export interface ResultadoExcecao {
  acimaKit: boolean
  validade: boolean
  foraKit: boolean
  exigeJustificativa: boolean
  /** Quantidade do kit considerada (0 se fora do kit). */
  qtdKit: number
}

/** Quantidade do kit para o item/variação (variação exata; senão a do item). */
export function qtdNoKit(
  kit: Pick<MatKitItem, 'item_id' | 'variacao_id' | 'quantidade'>[],
  itemId: string | null,
  variacaoId: string | null
): number | null {
  if (!itemId) return null
  const exato = kit.find((k) => k.item_id === itemId && (k.variacao_id ?? null) === (variacaoId ?? null))
  if (exato) return Number(exato.quantidade)
  const base = kit.find((k) => k.item_id === itemId && k.variacao_id == null)
  return base ? Number(base.quantidade) : null
}

/**
 * - fora do kit: "outros materiais" (sem item) ou item que não está no kit;
 * - acima do kit: quantidade maior que a do kit (item no kit);
 * - validade: pedir antes de vencer (última entrega + validade_meses > hoje).
 */
export function calcularExcecoes(e: EntradaExcecao): ResultadoExcecao {
  const { linha, kit, validadeMeses, ultimaEntrega, hoje } = e
  const noKit = qtdNoKit(kit, linha.item_id, linha.variacao_id)
  const foraKit = linha.quantidade > 0 && noKit == null
  const acimaKit = noKit != null && linha.quantidade > noKit
  let validade = false
  if (linha.quantidade > 0 && linha.item_id && validadeMeses && ultimaEntrega) {
    validade = adicionarMeses(ultimaEntrega, validadeMeses) > hoje
  }
  return {
    acimaKit,
    validade,
    foraKit,
    exigeJustificativa: acimaKit || validade || foraKit,
    qtdKit: noKit ?? 0,
  }
}

/** A justificativa só vale se não for vazia/espaços. */
export function justificativaValida(texto: string | null | undefined): boolean {
  return (texto ?? '').trim() !== ''
}
