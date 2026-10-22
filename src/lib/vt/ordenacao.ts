// Ordenação por nome da aba Colaboradores do VT (ajuste aprovado pela gestora,
// 22/10/2026): cabeçalho clicável ciclando A→Z (padrão) → Z→A. Ordenação
// estável, pt-BR, sem peso de acento. Helper local ao módulo — o padrão
// parecido do BI (ordenarEventos) é específico de lá; não acoplar.

export type DirecaoNome = 'az' | 'za'

/**
 * Ordena por nome (pt-BR, sem peso de acento), estável nos empates (mantém a
 * ordem original — inclusive em Z→A, que inverte a COMPARAÇÃO, não o array).
 */
export function ordenarPorNome<T>(itens: T[], nome: (item: T) => string, direcao: DirecaoNome = 'az'): T[] {
  const sinal = direcao === 'az' ? 1 : -1
  return [...itens].sort(
    (a, b) => sinal * nome(a).localeCompare(nome(b), 'pt-BR', { sensitivity: 'base' })
  )
}
