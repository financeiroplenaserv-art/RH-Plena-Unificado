// Pluralização de unidade de pedido em pt-BR ("2 unidades", "3 galões",
// "2 bombonas 5L"). Lógica pura, só para exibição.
//
// Regras: quantidade 1 = singular; qualquer outra (0, 2, 1,5) = plural.
// Só palavras inteiras em letras são pluralizadas; abreviações (un, L, kg, cx,
// pct, ml, g) e medidas com número ("5L", "500mL", "10kg") ficam como estão.
// Unidade composta pluraliza cada nome: "frasco/garrafa 1L" → "frascos/garrafas 1L".

const ABREVIACOES = new Set(['un', 'und', 'l', 'ml', 'kg', 'g', 'cx', 'pct', 'pc', 'pç', 'rl', 'm', 'mt', 'c', 'com', 'de', 'e'])
const IRREGULARES: Record<string, string> = { par: 'pares', kit: 'kits', mês: 'meses', mes: 'meses' }

function manterCaixa(original: string, plural: string): string {
  if (original === original.toUpperCase() && original.length > 1) return plural.toUpperCase()
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return plural[0].toUpperCase() + plural.slice(1)
  }
  return plural
}

/** Plural de UMA palavra (sem espaços). */
export function pluralizarPalavra(palavra: string): string {
  const baixa = palavra.toLowerCase()
  if (!/^[a-zà-úç]+$/i.test(palavra) || ABREVIACOES.has(baixa)) return palavra
  const irregular = IRREGULARES[baixa]
  if (irregular) return manterCaixa(palavra, irregular)
  if (baixa.length <= 3) return palavra // sigla curta
  let plural: string
  if (baixa.endsWith('ão')) plural = baixa.slice(0, -2) + 'ões'
  else if (baixa.endsWith('s')) plural = baixa
  else if (baixa.endsWith('m')) plural = baixa.slice(0, -1) + 'ns'
  else if (baixa.endsWith('r') || baixa.endsWith('z')) plural = baixa + 'es'
  else if (baixa.endsWith('l') && !baixa.endsWith('il')) plural = baixa.slice(0, -1) + 'is'
  else plural = baixa + 's'
  return manterCaixa(palavra, plural)
}

/** Unidade no plural, palavra a palavra (preserva "/" e medidas como "5L"). */
export function pluralizarUnidade(unidade: string): string {
  return unidade.replace(/[^\s/]+/g, (palavra) => pluralizarPalavra(palavra))
}

/** Unidade concordando com a quantidade: 1 = singular; o resto = plural. */
export function unidadeParaQuantidade(unidade: string | null | undefined, quantidade: number): string {
  const u = (unidade ?? '').trim()
  if (!u) return ''
  return Number(quantidade) === 1 ? u : pluralizarUnidade(u)
}

/** "2 unidades", "1 frasco 500mL", "3,5 pacotes". */
export function quantidadeComUnidade(quantidade: number, unidade: string | null | undefined): string {
  const q = String(Math.round(Number(quantidade) * 100) / 100).replace('.', ',')
  const u = unidadeParaQuantidade(unidade, quantidade)
  return u ? `${q} ${u}` : q
}
