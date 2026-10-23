// Lógica pura do VT — quem é ferista (decisão da gestora, 23/10/2026):
// "se cita que a pessoa vai cobrir férias, NAQUELE MOMENTO ela é ferista".
// Selo "Ferista" = carteira ativa (equipe dedicada, os "só ferista") OU
// cobertura em andamento/agendada (vt_coberturas com fim >= hoje). Histórico
// NÃO gera selo (quase todo admitido cobre no início — selo demais vira
// ruído): quem cobriu na janela recente só aparece antes no seletor, para o
// planejamento ter "os últimos utilizados". Fonte única de comportamento =
// vt_coberturas (nenhuma flag paralela; quando o módulo Férias for liberado,
// ferias_alocacoes alimenta vt_coberturas e a regra segue idêntica).

import type { VtCobertura } from '@/types/vt'

/** 'AAAA-MM-DD' menos N meses, como string local (Date.UTC: sem bug de fuso). */
export function mesesAtras(hoje: string, meses: number): string {
  const [a, m, d] = hoje.split('-').map(Number)
  const total = a * 12 + (m - 1) - meses
  const ano = Math.floor(total / 12)
  const mes = (total % 12) + 1
  // Dia pode não existir no mês alvo (31/03 - 1 mês) — o Date.UTC normaliza.
  return new Date(Date.UTC(ano, mes - 1, d)).toISOString().slice(0, 10)
}

/** 0 = carteira (dedicada) · 1 = cobrindo agora/agendado · 2 = cobriu na janela · 3 = demais. */
export type PrioridadeFerista = 0 | 1 | 2 | 3

export const ROTULO_GRUPO_FERISTA: Record<PrioridadeFerista, string> = {
  0: 'Equipe de feristas',
  1: 'Cobrindo agora / agendado',
  2: 'Últimos utilizados',
  3: 'Demais optantes',
}

export interface ClassificadorFeristas {
  /** Selo "Ferista": carteira ativa OU cobertura em andamento/agendada. */
  ehFerista: (id: string | null | undefined) => boolean
  /** Ordem do seletor de ferista (menor primeiro). */
  prioridade: (id: string | null | undefined) => PrioridadeFerista
}

export function classificarFeristas({
  carteiraIds,
  coberturas,
  hoje,
  janelaMeses = 6,
}: {
  /** colaborador_id dos feristas ativos da carteira (ferias_feristas). */
  carteiraIds: string[]
  /** Coberturas com ferista e fim dentro da janela (já filtradas na consulta ou não — a função refiltra). */
  coberturas: Pick<VtCobertura, 'colaborador_id' | 'data_fim'>[]
  hoje: string // 'AAAA-MM-DD'
  janelaMeses?: number
}): ClassificadorFeristas {
  const carteira = new Set(carteiraIds)
  const limite = mesesAtras(hoje, janelaMeses)
  const cobrindo = new Set<string>()
  const recentes = new Set<string>()
  for (const c of coberturas) {
    if (!c.colaborador_id || c.data_fim < limite) continue
    if (c.data_fim >= hoje) cobrindo.add(c.colaborador_id)
    else recentes.add(c.colaborador_id)
  }
  return {
    ehFerista: (id) => !!id && (carteira.has(id) || cobrindo.has(id)),
    prioridade: (id) => {
      if (!id) return 3
      if (carteira.has(id)) return 0
      if (cobrindo.has(id)) return 1
      if (recentes.has(id)) return 2
      return 3
    },
  }
}
