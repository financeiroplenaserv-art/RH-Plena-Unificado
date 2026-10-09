import type { MatContrato, MatPedido, RotaMaterial } from '@/types/materiais'

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
