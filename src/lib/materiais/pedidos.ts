import type { MatContrato, MatPedido, RotaMaterial } from '@/types/materiais'

/**
 * Rotas de entrega válidas — espelho dos CHECKs de mat_contratos.rota e
 * mat_pedidos.rota_override (migration 145: 1 a 4). Toda tela que lista rotas usa
 * esta lista, para nunca mais haver um limite escondido em 1–3.
 */
export const ROTAS_MATERIAIS: readonly RotaMaterial[] = [1, 2, 3, 4]

/** Lê o valor de um <select> de rota ('' ou desconhecido = sem rota). */
export function lerRota(valor: string | null | undefined): RotaMaterial | null {
  const n = Number(valor)
  return (ROTAS_MATERIAIS as readonly number[]).includes(n) ? (n as RotaMaterial) : null
}

/** Rota efetiva do pedido: a do dia (override da mesa) ou a padrão do contrato. */
export function rotaEfetiva(
  pedido: Pick<MatPedido, 'rota_override'>,
  contrato: Pick<MatContrato, 'rota'>
): RotaMaterial | null {
  return pedido.rota_override ?? contrato.rota ?? null
}

/** Compara o tamanho digitado pelo líder com o do cadastro (ceu_tamanhos): só divergência real. */
export function tamanhosDivergem(digitado: string | null | undefined, cadastro: string | null | undefined): boolean {
  const norm = (t: string | null | undefined) => (t ?? '').toUpperCase().replace(/\s+/g, '')
  if (!norm(digitado) || !norm(cadastro)) return false
  return norm(digitado) !== norm(cadastro)
}
