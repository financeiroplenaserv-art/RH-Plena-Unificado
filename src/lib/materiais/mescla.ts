import type { StatusCeuPedido, StatusProdutos } from '@/types/materiais'

// Mescla de envios (decisão da gestão, 09/10/2026): um pedido MENSAL por
// contrato e mês. Cada envio gera uma linha em mat_pedido_envios e a regra
// vale POR FILA:
//  - produtos: mesclam até a aprovação; depois viram pedido 'extra';
//  - uniforme/EPI/crachá: mesclam até a conferência; depois viram 'extra'.
// Espelha a lógica de mat_registrar_envio (migration 122).

export type DestinoFila = 'nenhuma' | 'novo' | 'mesclar' | 'extra'

export interface DestinoEnvio {
  produtos: DestinoFila
  ceu: DestinoFila
}

const PRODUTOS_ACEITAM_MESCLA: StatusProdutos[] = ['rascunho', 'nao_se_aplica', 'enviado', 'em_validacao', 'validado']
const CEU_ACEITA_MESCLA: StatusCeuPedido[] = ['nao_se_aplica', 'enviado', 'em_identificacao']

/** Para onde vai cada fila do envio, dado o pedido mensal já existente (ou null). */
export function destinoEnvio(
  pedidoMensal: { status_produtos: StatusProdutos; status_ceu: StatusCeuPedido } | null,
  temProdutos: boolean,
  temCeu: boolean
): DestinoEnvio {
  if (!pedidoMensal) {
    return { produtos: temProdutos ? 'novo' : 'nenhuma', ceu: temCeu ? 'novo' : 'nenhuma' }
  }
  return {
    produtos: !temProdutos
      ? 'nenhuma'
      : PRODUTOS_ACEITAM_MESCLA.includes(pedidoMensal.status_produtos)
        ? 'mesclar'
        : 'extra',
    ceu: !temCeu ? 'nenhuma' : CEU_ACEITA_MESCLA.includes(pedidoMensal.status_ceu) ? 'mesclar' : 'extra',
  }
}

/** Status inicial da fila de produtos (sem exceção pula a validação). */
export function statusInicialProdutos(temProdutos: boolean, temExcecao: boolean): StatusProdutos {
  if (!temProdutos) return 'nao_se_aplica'
  return temExcecao ? 'em_validacao' : 'validado'
}

/**
 * Status de produtos depois de mesclar um complemento: com exceção volta para
 * validação; sem exceção só libera um pedido que ainda não tinha produtos.
 */
export function statusProdutosAposMescla(atual: StatusProdutos, complementoTemExcecao: boolean): StatusProdutos {
  if (complementoTemExcecao) return 'em_validacao'
  if (atual === 'nao_se_aplica' || atual === 'enviado' || atual === 'rascunho') return 'validado'
  return atual
}

/** Status da fila do CEU depois de mesclar linhas. */
export function statusCeuAposMescla(atual: StatusCeuPedido): StatusCeuPedido {
  return atual === 'nao_se_aplica' ? 'enviado' : atual
}

/** Texto para a tela pública: o que acontecerá com o novo envio. */
export function descreverDestino(destino: DestinoEnvio): string {
  const partes: string[] = []
  if (destino.produtos === 'mesclar') partes.push('os produtos serão somados ao pedido do mês')
  if (destino.produtos === 'extra') partes.push('os produtos já foram aprovados e irão como pedido extra')
  if (destino.ceu === 'mesclar') partes.push('os itens de uniforme, EPI e crachá serão somados ao pedido do mês')
  if (destino.ceu === 'extra') partes.push('os itens de uniforme, EPI e crachá já foram conferidos e irão como pedido extra')
  if (partes.length === 0) return ''
  const texto = partes.join('; ')
  return texto.charAt(0).toUpperCase() + texto.slice(1) + '.'
}
