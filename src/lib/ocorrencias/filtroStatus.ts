// Filtro de status da listagem de ocorrências.
//
// Decisão da gestão (17/09/2026): a listagem esconde ocorrências Canceladas
// por padrão. O cancelamento é o destino formal do registro (soft delete), mas
// a cancelada continuava poluindo a lista e gerava pedido de exclusão física.
// A sentinela abaixo significa "todos os status, exceto Cancelada"; a opção
// "Todos os status" continua disponível para quem quiser ver as canceladas.

export const STATUS_FILTRO_EXCETO_CANCELADAS = 'exceto_canceladas'

export type CondicaoFiltroStatus =
  | { operador: 'eq'; valor: string }
  | { operador: 'neq'; valor: 'Cancelada' }
  | null

/** Traduz o valor do filtro de status da tela para a condição de consulta. */
export function condicaoFiltroStatus(status?: string): CondicaoFiltroStatus {
  if (!status) return null
  if (status === STATUS_FILTRO_EXCETO_CANCELADAS) return { operador: 'neq', valor: 'Cancelada' }
  return { operador: 'eq', valor: status }
}
