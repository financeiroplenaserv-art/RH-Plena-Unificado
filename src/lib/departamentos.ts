import { distanciaLevenshtein, removerAcentos } from './utils'

export interface DepartamentoFuzzy {
  id: string
  nome: string
  nome_curto: string | null
  empresa_id?: string | null
}

function normalizarTexto(texto: string): string {
  return removerAcentos(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(texto: string): string[] {
  return texto.split(' ').filter((t) => t.length >= 2)
}

function scoreSimilaridade(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - distanciaLevenshtein(a, b) / maxLen
}

function tokensBatem(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  return a.every((ta) => b.some((tb) => ta === tb || ta.startsWith(tb) || tb.startsWith(ta)))
}

/**
 * Encontra um departamento por ID, nome exato, tokens, substring ou similaridade.
 * Prioriza match por ID > nome exato > nome_curto exato > tokens > substring > similaridade (threshold 0.8).
 */
export function encontrarDepartamentoFuzzy(
  departamentos: DepartamentoFuzzy[],
  departamentoId?: string | null,
  nomeTextual?: string | null,
  empresaId?: string | null
): DepartamentoFuzzy | null {
  // 1. Match exato por ID (prioridade máxima, não filtra por empresa)
  if (departamentoId) {
    const porId = departamentos.find((d) => d.id === departamentoId)
    if (porId) return porId
  }

  const nome = (nomeTextual || '').trim()
  if (!nome) return null

  const nomeNorm = normalizarTexto(nome)

  // Filtra pela empresa quando informada, para evitar match errado entre empresas
  const candidatos = empresaId
    ? departamentos.filter((d) => !d.empresa_id || d.empresa_id === empresaId)
    : departamentos

  // 2. Match exato por nome
  const porNomeExato = candidatos.find((d) => normalizarTexto(d.nome) === nomeNorm)
  if (porNomeExato) return porNomeExato

  // 3. Match exato por nome_curto
  const porNomeCurtoExato = candidatos.find(
    (d) => d.nome_curto && normalizarTexto(d.nome_curto) === nomeNorm
  )
  if (porNomeCurtoExato) return porNomeCurtoExato

  // 4. Match por tokens (ordem não importa)
  const tokensNome = tokens(nomeNorm)
  const porTokens = candidatos.find((d) => {
    const tokensDepNome = tokens(normalizarTexto(d.nome))
    const tokensDepCurto = d.nome_curto ? tokens(normalizarTexto(d.nome_curto)) : []
    return tokensBatem(tokensNome, tokensDepNome) || tokensBatem(tokensNome, tokensDepCurto)
  })
  if (porTokens) return porTokens

  // 5. Match por substring
  const porSubstring = candidatos.find((d) => {
    const nomeDep = normalizarTexto(d.nome)
    const nomeCurtoDep = d.nome_curto ? normalizarTexto(d.nome_curto) : ''
    return (
      (nomeDep && (nomeDep.includes(nomeNorm) || nomeNorm.includes(nomeDep))) ||
      (nomeCurtoDep && (nomeCurtoDep.includes(nomeNorm) || nomeNorm.includes(nomeCurtoDep)))
    )
  })
  if (porSubstring) return porSubstring

  // 6. Match por similaridade (Levenshtein)
  let melhorScore = 0
  let melhor: DepartamentoFuzzy | null = null
  for (const d of candidatos) {
    const scoreNome = scoreSimilaridade(nomeNorm, normalizarTexto(d.nome))
    const scoreCurto = d.nome_curto ? scoreSimilaridade(nomeNorm, normalizarTexto(d.nome_curto)) : 0
    const score = Math.max(scoreNome, scoreCurto)
    if (score > melhorScore) {
      melhorScore = score
      melhor = d
    }
  }
  if (melhorScore >= 0.8) return melhor

  return null
}

/**
 * Retorna o nome curto do departamento encontrado, ou fallback para nome textual.
 */
export function nomeCurtoDepartamentoFuzzy(
  departamentos: DepartamentoFuzzy[],
  departamentoId?: string | null,
  nomeTextual?: string | null,
  empresaId?: string | null
): string {
  const dep = encontrarDepartamentoFuzzy(departamentos, departamentoId, nomeTextual, empresaId)
  return dep?.nome_curto?.trim() || dep?.nome?.trim() || nomeTextual?.trim() || '—'
}
