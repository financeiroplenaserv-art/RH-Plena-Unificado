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

/** "5,60" / "5.60" (R$) → centavos. Com vírgula, o ponto é milhar ("1.234,56"). */
export function parseValorCentavos(texto: string): number | null {
  const limpo = texto.trim()
  if (!limpo) return null
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normalizado)
  if (!isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

/** Centavos → texto de input ("200" → "2,00"; 0/null → ""). */
export function textoValorReais(centavos: number | null | undefined): string {
  if (!centavos) return ''
  return (centavos / 100).toFixed(2).replace('.', ',')
}
