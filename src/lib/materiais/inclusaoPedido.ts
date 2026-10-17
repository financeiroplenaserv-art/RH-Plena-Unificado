import type { MatItem, StatusProdutos } from '@/types/materiais'
import { exclusivoDeOutroContrato } from './buscaItens'

// Incluir item no pedido do líder e ligar texto livre ao catálogo (migration
// 139, decisões da gestora de 17/10/2026). O banco reconfere tudo nas RPCs
// `incluir_linha_pedido_materiais` e `ligar_linha_catalogo_materiais`; aqui
// fica só o que a tela precisa para mostrar (ou esconder) os botões e avisar.

/**
 * A tela oferece "Adicionar item" / "Ligar ao catálogo"?
 * - em validação ou validado: inspetor, gestor e admin (`podeValidarOuAprovar`);
 * - já aprovado: SÓ gestor/admin (`podeAprovar`) — incluir um item reabre o
 *   pedido para o gestor aprovar o novo extra.
 */
export function podeEditarLinhasDoPedido(
  status: StatusProdutos,
  podeValidarOuAprovar: boolean,
  podeAprovar: boolean
): boolean {
  if (status === 'em_validacao' || status === 'validado') return podeValidarOuAprovar
  if (status === 'aprovado') return podeAprovar
  return false
}

/** Incluir item em pedido aprovado devolve o pedido para a aprovação do gestor. */
export const inclusaoReabrePedido = (status: StatusProdutos) => status === 'aprovado'

/** Aviso (sem bloquear) quando o item está escondido do link deste contrato. */
export function avisoItemOculto(
  item: Pick<MatItem, 'contratos_ocultos'> | null | undefined,
  contratoId: string | null | undefined
): string | null {
  if (!item || !contratoId || !(item.contratos_ocultos ?? []).includes(contratoId)) return null
  return 'Este item está escondido do link deste contrato. Pode incluir mesmo assim — confira se é isso mesmo.'
}

/** Avisos do item escolhido para o contrato do pedido (exclusivo de outro, escondido). */
export function avisosItemParaContrato(
  item: Pick<MatItem, 'contratos_exclusivos' | 'contratos_ocultos'> | null | undefined,
  contratoId: string | null | undefined,
  nomesExclusivos: string[]
): string | null {
  if (!item || !contratoId) return null
  if (exclusivoDeOutroContrato(item, contratoId)) {
    return `Item exclusivo de ${nomesExclusivos.join(', ') || 'outro contrato'}. Pode incluir mesmo assim — confira se é isso mesmo.`
  }
  return avisoItemOculto(item, contratoId)
}

/** Mensagem do primeiro impedimento da inclusão, ou null. O motivo é obrigatório ("Qual o motivo?"). */
export function validarInclusao(d: { itemId: string | null; quantidade: number | null; motivo: string }): string | null {
  if (!d.itemId) return 'Escolha o item.'
  if (d.quantidade == null || !Number.isFinite(d.quantidade) || d.quantidade <= 0) return 'Informe a quantidade.'
  if (d.quantidade > 999) return 'Quantidade acima do permitido (999).'
  if (!d.motivo.trim()) return 'Qual o motivo? Escreva o motivo da inclusão.'
  return null
}
