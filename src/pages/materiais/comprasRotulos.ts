import type { StatusCompraMaterial, TipoCompraMaterial } from '@/types/materiais'

type Variante = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const ROTULO_STATUS_COMPRA: Record<StatusCompraMaterial, { texto: string; variante: Variante }> = {
  rascunho: { texto: 'Rascunho', variante: 'neutral' },
  enviada: { texto: 'Enviada', variante: 'info' },
  recebida_parcial: { texto: 'Chegada em andamento', variante: 'warning' },
  recebida: { texto: 'Recebida', variante: 'success' },
  cancelada: { texto: 'Cancelada', variante: 'danger' },
}

export const ROTULO_TIPO_COMPRA: Record<TipoCompraMaterial, string> = {
  mensal: 'Do mês',
  avulsa: 'Avulsa',
  reposicao_estoque: 'Reposição do estoque',
}
