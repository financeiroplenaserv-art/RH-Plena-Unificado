import type { MatContrato, MatPedido, RotaMaterial, StatusProdutos } from '@/types/materiais'

/**
 * Status de pedido cujo conteúdo já foi decidido pelo gestor e segue para a
 * entrega (Fase 2, migration 147). Espelho de STATUS_PRODUTOS_ENTREGUE da Edge
 * Function pedido-materiais. Use esta lista em vez de comparar com 'aprovado'.
 */
export const STATUS_APROVADO_OU_DEPOIS: readonly StatusProdutos[] = ['aprovado', 'em_compra', 'entregue', 'entregue_parcial']

export const aprovadoOuDepois = (s: string | null | undefined): boolean =>
  (STATUS_APROVADO_OU_DEPOIS as readonly string[]).includes(s ?? '')

/**
 * Rotas de entrega válidas — espelho dos CHECKs de mat_contratos.rota e
 * mat_pedidos.rota_override (migration 145: 1 a 4). Toda tela que lista rotas usa
 * esta lista, para nunca mais haver um limite escondido em 1–3.
 */
export const ROTAS_MATERIAIS: readonly RotaMaterial[] = [1, 2, 3, 4]

/**
 * Rota 0 = "Depósito Plena" (migration 154): contrato que não recebe em rota — a Plena
 * leva do depósito. Entra na lista dos seletores depois das rotas de entrega.
 */
export const ROTA_DEPOSITO_PLENA = 0 as const
export const ROTAS_SELECIONAVEIS: readonly RotaMaterial[] = [...ROTAS_MATERIAIS, ROTA_DEPOSITO_PLENA]

/** "Rota 2", "Depósito Plena" ou "—" (sem rota) — texto único para toda tela do módulo. */
export function textoRota(rota: number | null | undefined): string {
  if (rota === ROTA_DEPOSITO_PLENA) return 'Depósito Plena'
  return rota == null ? '—' : `Rota ${rota}`
}

/** Ordem de exibição: rotas 1 a 4, depois Depósito Plena, depois sem rota. */
export function ordemRota(rota: number | null | undefined): number {
  if (rota == null) return 99
  return rota === ROTA_DEPOSITO_PLENA ? 50 : rota
}

/** Lê o valor de um <select> de rota ('' ou desconhecido = sem rota). */
export function lerRota(valor: string | null | undefined): RotaMaterial | null {
  if (valor == null || String(valor).trim() === '') return null
  const n = Number(valor)
  return (ROTAS_SELECIONAVEIS as readonly number[]).includes(n) ? (n as RotaMaterial) : null
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
