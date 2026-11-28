/** Ordenação por nome (pt-BR, sem peso de acento/caixa) e filtros da aba Trajetos — só exibição. */

export type SentidoNome = 'asc' | 'desc' | null

/** Ciclo do cabeçalho: A→Z → Z→A → ordem original. */
export function proximoSentidoNome(atual: SentidoNome): SentidoNome {
  if (atual === 'asc') return 'desc'
  if (atual === 'desc') return null
  return 'asc'
}

/** Ordenação estável; `null` devolve a ordem original (cópia). */
export function ordenarPorNome<T>(itens: readonly T[], nomeDe: (item: T) => string, sentido: SentidoNome): T[] {
  if (!sentido) return [...itens]
  const fator = sentido === 'asc' ? 1 : -1
  return itens
    .map((item, i) => ({ item, i }))
    .sort((a, b) => fator * nomeDe(a.item).localeCompare(nomeDe(b.item), 'pt-BR', { sensitivity: 'base' }) || a.i - b.i)
    .map((x) => x.item)
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export interface FiltroTrajetos {
  nome: string
  /** Nome do posto exibido; '' = todos. */
  posto: string
}

export function filtrarTrajetos<T extends { nomeColaborador: string; nomePosto: string }>(linhas: readonly T[], filtro: FiltroTrajetos): T[] {
  const termo = normalizar(filtro.nome)
  return linhas.filter(
    (l) => (!termo || normalizar(l.nomeColaborador).includes(termo)) && (!filtro.posto || l.nomePosto === filtro.posto),
  )
}

/** Postos distintos (como exibidos), ordenados pt-BR. */
export function postosDistintos(linhas: readonly { nomePosto: string }[]): string[] {
  return [...new Set(linhas.map((l) => l.nomePosto).filter((p) => p && p !== '—'))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  )
}
