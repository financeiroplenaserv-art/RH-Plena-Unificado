// Lógica pura do VT — quem é ferista (decisão da gestora, 23/10/2026):
// "se cita que a pessoa vai cobrir férias, NAQUELE MOMENTO ela é ferista".
// Selo "Ferista" = carteira ativa (equipe dedicada, os "só ferista") OU
// cobertura em andamento/agendada (vt_coberturas com fim >= hoje). Histórico
// NÃO gera selo (quase todo admitido cobre no início — selo demais vira
// ruído): quem cobriu na janela recente só aparece antes no seletor, para o
// planejamento ter "os últimos utilizados". Fonte única de comportamento =
// vt_coberturas (nenhuma flag paralela; quando o módulo Férias for liberado,
// ferias_alocacoes alimenta vt_coberturas e a regra segue idêntica).
// Só contam linhas tipo 'ferias' (migration 160): quem está só em TREINAMENTO
// não é ferista — treinamento não gera selo nem prioridade.

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
  3: 'Demais colaboradores',
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
  coberturas: Pick<VtCobertura, 'colaborador_id' | 'data_fim' | 'tipo'>[]
  hoje: string // 'AAAA-MM-DD'
  janelaMeses?: number
}): ClassificadorFeristas {
  const carteira = new Set(carteiraIds)
  const limite = mesesAtras(hoje, janelaMeses)
  const cobrindo = new Set<string>()
  const recentes = new Set<string>()
  for (const c of coberturas) {
    // Só cobertura de FÉRIAS conta (migration 160): treinamento não é ferista.
    if (c.tipo === 'treinamento') continue
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

export interface SobreposicaoCobertura {
  colaborador_id: string
  /** Interseção dos períodos sobrepostos ('AAAA-MM-DD'). */
  inicio: string
  fim: string
  /** Quantas coberturas do ferista se sobrepõem. */
  quantas: number
}

/**
 * Ferista cobrindo 2+ postos ao mesmo tempo (decisão da gestora, 27/10/2026;
 * caso real: Everaldo cobre Mérito Barreto 01–27/11 e Itaguaí 01–04/11). Os
 * registros são MANTIDOS — a carga do dia usa a cobertura mais recente —, mas
 * a aba Carga mostra o aviso. Só contam coberturas tipo 'ferias' (ou sem tipo)
 * com ferista: "sem cobertura" (colaborador_id null) e 'treinamento' ficam de
 * fora. UMA entrada por ferista; o período é a interseção das coberturas
 * envolvidas (em cadeia sem interseção comum — A∩B e B∩C sem A∩C — mostra o
 * intervalo total envolvido, para o aviso nunca sair com datas invertidas).
 */
export function sobreposicoesDeCobertura(coberturas: VtCobertura[]): SobreposicaoCobertura[] {
  const porFerista = new Map<string, VtCobertura[]>()
  for (const c of coberturas) {
    if ((c.tipo ?? 'ferias') !== 'ferias') continue
    if (!c.colaborador_id) continue
    const lista = porFerista.get(c.colaborador_id) ?? []
    lista.push(c)
    porFerista.set(c.colaborador_id, lista)
  }
  const resultado: SobreposicaoCobertura[] = []
  for (const [colaborador_id, lista] of porFerista) {
    const envolvidas = lista.filter((a) =>
      lista.some((b) => b !== a && a.data_inicio <= b.data_fim && a.data_fim >= b.data_inicio)
    )
    if (envolvidas.length < 2) continue
    const inicioIntersecao = envolvidas.map((c) => c.data_inicio).reduce((a, b) => (b > a ? b : a))
    const fimIntersecao = envolvidas.map((c) => c.data_fim).reduce((a, b) => (b < a ? b : a))
    const temIntersecaoComum = inicioIntersecao <= fimIntersecao
    resultado.push({
      colaborador_id,
      inicio: temIntersecaoComum
        ? inicioIntersecao
        : envolvidas.map((c) => c.data_inicio).reduce((a, b) => (b < a ? b : a)),
      fim: temIntersecaoComum
        ? fimIntersecao
        : envolvidas.map((c) => c.data_fim).reduce((a, b) => (b > a ? b : a)),
      quantas: envolvidas.length,
    })
  }
  return resultado.sort((a, b) => a.colaborador_id.localeCompare(b.colaborador_id))
}
