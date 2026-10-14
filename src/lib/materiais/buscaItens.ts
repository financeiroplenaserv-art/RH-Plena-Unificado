// Busca tolerante a erro de digitação no catálogo de materiais — lógica pura.
// Usada pelo "Preciso de outro item" do link do líder (ação `buscar_item` da
// Edge Function pedido-materiais): o líder digita "cab", "cabo vasora",
// "detergete" e recebe até 5 sugestões de itens ATIVOS.
//
// ESTE ARQUIVO É COPIADO PARA DENTRO DA EDGE FUNCTION
// supabase/functions/pedido-materiais/index.ts por
// `node scripts/sincronizar-pedido-materiais.mjs` (sem imports).
//
// Decisão (14/10/2026): busca fuzzy LOCAL, instantânea e gratuita — sem
// chamada externa. Normalização sem acento + prefixo + Levenshtein por
// palavra + trigramas, olhando o nome do item e os nomes antigos/grafias
// reais de `mat_aliases`.
//
// PONTO DE EXTENSÃO (não implementado): quando `buscarItens` não devolver
// nada, a function poderia consultar um classificador externo (ex.: Jev, da
// TypeSafe) com o termo e a lista de nomes do catálogo, aceitando só
// respostas de alta confiança. Ver `FallbackBusca` abaixo — hoje a function
// não passa nenhum fallback e o líder usa "Não achei, enviar assim".

export interface ItemBuscavel {
  id: string
  nome: string
  /** Nomes antigos e grafias (mat_aliases.nome_legado). */
  aliases?: string[]
}

/** Assinatura do fallback futuro (não usado hoje). Deve devolver ids do catálogo. */
export type FallbackBusca = (termo: string, nomes: { id: string; nome: string }[]) => Promise<string[]>

export const BUSCA_MIN_CARACTERES = 3
export const BUSCA_MAX_RESULTADOS = 5
const NOTA_MINIMA = 0.6

export function normalizarBusca(texto: string | null | undefined): string {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const VAZIAS_BUSCA = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'e', 'p', 'c'])

function palavrasBusca(texto: string): string[] {
  return normalizarBusca(texto)
    .split(' ')
    .filter((p) => p && !VAZIAS_BUSCA.has(p))
}

/** Levenshtein com corte: devolve limite + 1 quando passa do limite. */
export function distanciaEdicao(a: string, b: string, limite = 99): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limite) return limite + 1
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    let menor = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      atual.push(v)
      if (v < menor) menor = v
    }
    if (menor > limite) return limite + 1
    anterior = atual
  }
  return anterior[b.length]
}

function trigramasDe(texto: string): Set<string> {
  const s = `  ${texto} `
  const t = new Set<string>()
  for (let i = 0; i < s.length - 2; i++) t.add(s.slice(i, i + 3))
  return t
}

export function similaridadeTrigramas(a: string, b: string): number {
  const ta = trigramasDe(a)
  const tb = trigramasDe(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let comuns = 0
  for (const x of ta) if (tb.has(x)) comuns++
  return comuns / (ta.size + tb.size - comuns)
}

/** Erros de digitação aceitos por palavra: 0 até 3 letras, 1 até 5, 2 a partir de 6. */
function tolerancia(n: number): number {
  return n <= 3 ? 0 : n <= 5 ? 1 : 2
}

/** Nota de 0 a 1 de uma palavra digitada contra uma palavra do nome. */
function notaPalavra(t: string, p: string): number {
  if (t === p) return 1
  if (p.startsWith(t)) return t.length >= 2 ? 0.92 : 0.5
  if (t.startsWith(p) && p.length >= 3) return 0.8
  const tol = tolerancia(t.length)
  if (tol > 0) {
    if (distanciaEdicao(t, p, tol) <= tol) return 0.82
  }
  if (tol > 0 && t.length >= 5) {
    // prefixo com erro: "vasor" ~ "vassoura"
    if (p.length > t.length && distanciaEdicao(t, p.slice(0, t.length), tol) <= tol) return 0.72
    if (p.length > t.length + 1 && distanciaEdicao(t, p.slice(0, t.length + 1), tol) <= tol) return 0.72
  }
  return similaridadeTrigramas(t, p) * 0.7
}

/** Nota de um termo contra um nome (média das palavras digitadas, cada uma no melhor par). */
export function notaNome(termo: string, nome: string): number {
  const ts = palavrasBusca(termo)
  const ps = palavrasBusca(nome)
  if (ts.length === 0 || ps.length === 0) return 0
  let soma = 0
  let melhorPalavra = 0
  for (const t of ts) {
    let melhor = 0
    for (const p of ps) melhor = Math.max(melhor, notaPalavra(t, p))
    soma += melhor
    melhorPalavra = Math.max(melhorPalavra, melhor)
  }
  let nota = soma / ts.length
  // Várias palavras: uma delas casando bem já sugere o item ("cabo vasora"
  // traz os cabos e as vassouras quando não existe "cabo de vassoura").
  if (ts.length > 1) nota = Math.max(nota, melhorPalavra * 0.75)
  const tn = normalizarBusca(termo)
  const nn = normalizarBusca(nome)
  if (nn.startsWith(tn)) nota = Math.min(1, nota + 0.08)
  return Math.max(nota, similaridadeTrigramas(tn, nn) * 0.9)
}

export interface ResultadoBusca<T> {
  item: T
  nota: number
  /** Nome (ou alias) que casou melhor. */
  casouCom: string
}

/**
 * Até `limite` itens que casam com o termo, do melhor para o pior. Termo com
 * menos de BUSCA_MIN_CARACTERES letras não busca (evita "listar tudo").
 */
export function buscarItens<T extends ItemBuscavel>(
  termo: string,
  itens: T[],
  limite = BUSCA_MAX_RESULTADOS,
  notaMinima = NOTA_MINIMA
): ResultadoBusca<T>[] {
  const tn = normalizarBusca(termo)
  if (tn.replace(/ /g, '').length < BUSCA_MIN_CARACTERES) return []
  const resultados: ResultadoBusca<T>[] = []
  for (const item of itens) {
    let melhor = notaNome(tn, item.nome)
    let casouCom = item.nome
    for (const a of item.aliases ?? []) {
      // alias vale um pouco menos que o nome oficial (desempate)
      const n = notaNome(tn, a) * 0.97
      if (n > melhor) {
        melhor = n
        casouCom = a
      }
    }
    if (melhor >= notaMinima) resultados.push({ item, nota: melhor, casouCom })
  }
  return resultados
    .sort((a, b) => b.nota - a.nota || a.item.nome.localeCompare(b.item.nome, 'pt-BR'))
    .slice(0, Math.max(0, Math.min(limite, BUSCA_MAX_RESULTADOS)))
}
