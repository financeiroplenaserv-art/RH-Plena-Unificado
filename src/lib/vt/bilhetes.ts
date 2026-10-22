// Lógica pura do módulo VT — bilhetes nomeados com valor diário fechado
// (ida+volta). Modelo aprovado pela gestora em 21/10/2026
// (docs/PLANO_MODULO_VT.md §2d): a precificação NÃO é por conduções × tarifa;
// cada bilhete tem um valor diário e o trajeto usa até 2 (custo = soma).
// ("combinação" virou "bilhete", termo da operação — migration 156.)

import type { VtBilhete } from '@/types/vt'

/**
 * Bilhetes vigentes na data `hoje` (AAAA-MM-DD): só ativos com
 * vigente_desde <= hoje, UM por nome — o de vigência mais recente.
 */
export function bilhetesVigentes(bilhetes: VtBilhete[], hoje: string): VtBilhete[] {
  const porNome = new Map<string, VtBilhete>()
  for (const b of bilhetes) {
    if (!b.ativo || b.vigente_desde > hoje) continue
    const atual = porNome.get(b.nome)
    if (!atual || b.vigente_desde > atual.vigente_desde) porNome.set(b.nome, b)
  }
  return [...porNome.values()]
}

/** Custo do dia em centavos: soma dos valores diários dos bilhetes (1 ou 2). */
export function custoDiaBilhetesCentavos(b1: VtBilhete, b2: VtBilhete | null): number {
  return b1.valor_diario_centavos + (b2?.valor_diario_centavos ?? 0)
}

/** Formata centavos como moeda pt-BR ("R$ 5,60"). */
export function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
