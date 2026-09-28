import type { FeriasSolicitacao, StatusSolicitacaoFerias } from '@/types/ferias'

// ============================================================
// Fill rate de cobertura por feristas
// ------------------------------------------------------------
// % das solicitações efetivas (aprovada/em_andamento/concluida) do ano
// que têm ferista alocado. Meta visual da gestão: 85–92% —
// verde ≥ 85, âmbar 70–84, vermelho < 70.
// ============================================================

export const META_FILL_RATE = { verde: 0.85, ambar: 0.7 } as const

export type FaixaMetaFillRate = 'verde' | 'ambar' | 'vermelho'

export interface FillRate {
  /** Proporção 0–1; null quando o recorte está vazio (nunca NaN) */
  taxa: number | null
  total: number
  alocadas: number
}

const STATUS_FILL_RATE: StatusSolicitacaoFerias[] = ['aprovada', 'em_andamento', 'concluida']

export function calcularFillRate(
  solicitacoes: Pick<FeriasSolicitacao, 'status' | 'data_inicio' | 'ferista_alocado_id'>[],
  ano: number
): FillRate {
  const prefixoAno = String(ano)
  const doAno = solicitacoes.filter(
    (s) => STATUS_FILL_RATE.includes(s.status) && s.data_inicio.startsWith(prefixoAno)
  )
  const alocadas = doAno.filter((s) => s.ferista_alocado_id !== null).length
  return {
    taxa: doAno.length === 0 ? null : alocadas / doAno.length,
    total: doAno.length,
    alocadas,
  }
}

export function faixaMetaFillRate(taxa: number): FaixaMetaFillRate {
  if (taxa >= META_FILL_RATE.verde) return 'verde'
  if (taxa >= META_FILL_RATE.ambar) return 'ambar'
  return 'vermelho'
}
