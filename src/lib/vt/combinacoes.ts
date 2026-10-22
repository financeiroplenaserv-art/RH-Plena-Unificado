// Lógica pura do módulo VT — combinações nomeadas com valor diário fechado
// (ida+volta). Modelo aprovado pela gestora em 21/10/2026
// (docs/PLANO_MODULO_VT.md §2d): a precificação NÃO é por conduções × tarifa;
// cada combinação tem um valor diário e o trajeto usa até 2 (custo = soma).

import type { VtCombinacao } from '@/types/vt'

/**
 * Combinações vigentes na data `hoje` (AAAA-MM-DD): só ativas com
 * vigente_desde <= hoje, UMA por nome — a de vigência mais recente.
 */
export function combinacoesVigentes(combinacoes: VtCombinacao[], hoje: string): VtCombinacao[] {
  const porNome = new Map<string, VtCombinacao>()
  for (const c of combinacoes) {
    if (!c.ativo || c.vigente_desde > hoje) continue
    const atual = porNome.get(c.nome)
    if (!atual || c.vigente_desde > atual.vigente_desde) porNome.set(c.nome, c)
  }
  return [...porNome.values()]
}

/** Custo do dia em centavos: soma dos valores diários das combinações (1 ou 2). */
export function custoDiaCombinacoesCentavos(c1: VtCombinacao, c2: VtCombinacao | null): number {
  return c1.valor_diario_centavos + (c2?.valor_diario_centavos ?? 0)
}

/** Formata centavos como moeda pt-BR ("R$ 5,60"). */
export function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
