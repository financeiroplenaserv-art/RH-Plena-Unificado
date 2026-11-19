/**
 * Pré-seleção da volta: procura, entre as alternativas da volta, a que usa as
 * MESMAS linhas da ida em ordem inversa (ex.: ida 62 → 39A, volta 39A → 62).
 * Só sugere — quem confirma é a pessoa, ao salvar. Sem linha identificada em
 * alguma condução, não há como comparar e devolve null.
 */
interface AlternativaComLinhas {
  id: string
  itinerario: { pernas: ReadonlyArray<{ linha: string | null }> }
}

function linhasDe(alternativa: AlternativaComLinhas): string[] | null {
  const linhas = alternativa.itinerario.pernas.map((p) => p.linha?.trim().toUpperCase() ?? '')
  return linhas.length > 0 && linhas.every(Boolean) ? linhas : null
}

export function encontrarAlternativaInversa<T extends { alternativa: AlternativaComLinhas }>(
  ida: AlternativaComLinhas,
  candidatasVolta: readonly T[],
): T | null {
  const linhasIda = linhasDe(ida)
  if (!linhasIda) return null
  const esperado = [...linhasIda].reverse().join('>')
  return candidatasVolta.find((c) => linhasDe(c.alternativa)?.join('>') === esperado) ?? null
}
