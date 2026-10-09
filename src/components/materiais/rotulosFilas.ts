import { nomeMes } from '@/lib/materiais/pedidoLider'
import type { StatusCeuPedido, StatusLinhaCeuPedido, StatusProdutos } from '@/types/materiais'

// Rótulos das filas internas do módulo Materiais.

type Variante = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const ROTULO_STATUS_PRODUTOS: Record<StatusProdutos, { texto: string; variante: Variante }> = {
  nao_se_aplica: { texto: 'Sem produtos', variante: 'neutral' },
  rascunho: { texto: 'Rascunho', variante: 'neutral' },
  enviado: { texto: 'Enviado', variante: 'info' },
  em_validacao: { texto: 'Com o inspetor', variante: 'warning' },
  validado: { texto: 'Aguarda gestor', variante: 'info' },
  aprovado: { texto: 'Aprovado', variante: 'success' },
  cancelado: { texto: 'Cancelado', variante: 'danger' },
}

export const ROTULO_STATUS_CEU: Record<StatusCeuPedido, { texto: string; variante: Variante }> = {
  nao_se_aplica: { texto: 'Sem uniforme/EPI', variante: 'neutral' },
  enviado: { texto: 'A identificar', variante: 'warning' },
  em_identificacao: { texto: 'Em conferência', variante: 'warning' },
  conferido: { texto: 'Conferido', variante: 'info' },
  em_atendimento: { texto: 'Em atendimento', variante: 'info' },
  atendido: { texto: 'Atendido', variante: 'success' },
  cancelado: { texto: 'Cancelado', variante: 'danger' },
}

export const ROTULO_STATUS_LINHA_CEU: Record<StatusLinhaCeuPedido, { texto: string; variante: Variante }> = {
  a_identificar: { texto: 'Identificar', variante: 'warning' },
  pendente: { texto: 'Conferir', variante: 'warning' },
  conferido: { texto: 'Conferido', variante: 'info' },
  ajustado: { texto: 'Ajustado', variante: 'info' },
  atendido: { texto: 'Atendido', variante: 'success' },
  cancelado: { texto: 'Cancelado', variante: 'danger' },
}

/** "outubro/2026" a partir da competência (AAAA-MM-01). */
export function rotuloCompetencia(competencia: string): string {
  return `${nomeMes(competencia)}/${competencia.slice(0, 4)}`
}
