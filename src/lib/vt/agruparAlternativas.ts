/**
 * Agrupa alternativas de rota que são "a mesma coisa" para quem revisa: o Google
 * devolve várias vezes a mesma sequência de linhas, só com horários diferentes.
 * Duas alternativas entram no mesmo grupo quando têm a mesma sequência de linhas
 * (todas identificadas) e o mesmo valor por sentido. A primeira da lista é a que
 * fica visível (mantém o id, ex.: google-1); as demais só viram um contador.
 */
interface AlternativaAgrupavel {
  alternativa: { id: string; itinerario: { pernas: ReadonlyArray<{ linha: string | null }> } }
  resultado: { valorCentavos: number | null }
}

export interface GrupoAlternativas<T> {
  /** Alternativa mostrada (a primeira do grupo, na ordem recebida). */
  principal: T
  /** Quantas outras alternativas parecidas foram escondidas atrás dela. */
  semelhantes: number
}

function chaveDoGrupo(item: AlternativaAgrupavel): string {
  const linhas = item.alternativa.itinerario.pernas.map((p) => p.linha?.trim().toUpperCase() ?? '')
  // Sem todas as linhas identificadas não há como afirmar que são iguais: nunca agrupa.
  if (linhas.length === 0 || linhas.some((l) => !l)) return `unica:${item.alternativa.id}`
  return `${linhas.join('>')}|${item.resultado.valorCentavos ?? 'indeterminado'}`
}

export function agruparAlternativasIguais<T extends AlternativaAgrupavel>(lista: readonly T[]): GrupoAlternativas<T>[] {
  const grupos = new Map<string, GrupoAlternativas<T>>()
  for (const item of lista) {
    const chave = chaveDoGrupo(item)
    const existente = grupos.get(chave)
    if (existente) existente.semelhantes += 1
    else grupos.set(chave, { principal: item, semelhantes: 0 })
  }
  return [...grupos.values()]
}

/** Texto pequeno do contador: "+2 horários parecidos". */
export function textoSemelhantes(quantidade: number): string | null {
  if (quantidade <= 0) return null
  return quantidade === 1 ? '+1 horário parecido' : `+${quantidade} horários parecidos`
}

/**
 * Menor valor, mas só quando ele realmente destaca alguma coisa: precisa haver
 * pelo menos outra alternativa com valor maior. Se tudo custa igual, devolve null
 * (nenhuma é "mais em conta").
 */
export function menorValorComDestaque(valores: ReadonlyArray<number | null>): number | null {
  const conhecidos = valores.filter((v): v is number => v !== null)
  if (conhecidos.length < 2) return null
  const menor = Math.min(...conhecidos)
  return conhecidos.some((v) => v > menor) ? menor : null
}
