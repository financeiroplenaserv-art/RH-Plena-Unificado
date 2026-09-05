import { distanciaLevenshtein, removerAcentos } from './utils'

export interface DepartamentoFuzzy {
  id: string
  nome: string
  nome_curto: string | null
  empresa_id?: string | null
  status?: string | null
}

function normalizarTexto(texto: string): string {
  return removerAcentos(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Normalização usada nos matches de departamento (sem acentos/pontuação, maiúsculas). */
export function normalizarDepartamento(texto: string): string {
  return normalizarTexto(texto)
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
 * Se a linha resolvida não tem nome_curto (duplicada legada), procura uma linha
 * "irmã" com o mesmo nome normalizado que tenha nome_curto (prefere Ativa) —
 * ex.: colaborador aponta para "ALIANCA S A INDUSTRIA..." sem nome_curto, mas
 * exibimos "CBO" da linha irmã.
 */
export function nomeCurtoDepartamentoFuzzy(
  departamentos: DepartamentoFuzzy[],
  departamentoId?: string | null,
  nomeTextual?: string | null,
  empresaId?: string | null
): string {
  const dep = encontrarDepartamentoFuzzy(departamentos, departamentoId, nomeTextual, empresaId)
  if (dep?.nome_curto?.trim()) return dep.nome_curto.trim()
  if (dep) {
    const chaveNome = normalizarTexto(dep.nome)
    const irmaos = departamentos.filter(
      (d) => d.id !== dep.id && d.nome_curto?.trim() && normalizarTexto(d.nome) === chaveNome
    )
    const irma = irmaos.find((d) => d.status === 'Ativo') || irmaos[0]
    if (irma) return irma.nome_curto!.trim()
    return dep.nome.trim()
  }
  return nomeTextual?.trim() || '—'
}

export interface ColaboradorDepartamento {
  id: string
  departamento_id?: string | null
  departamento?: string | null
  empresa_id?: string | null
}

/**
 * IDs dos colaboradores de um departamento buscado por nome_curto/nome
 * (filtros de relatórios e listagens). O texto legado de
 * `colaboradores.departamento` não bate com o cadastro por acento/pontuação
 * ("ALIANCA S A INDUSTRIA..." vs "Aliança S.A. Indústria..."), então ILIKE
 * no banco não encontrava — aqui cada colaborador tem o departamento
 * resolvido por encontrarDepartamentoFuzzy (id > nome exato > nome_curto >
 * tokens > substring > similaridade).
 */
export function idsColaboradoresDoDepartamento(
  departamentos: DepartamentoFuzzy[],
  colaboradores: ColaboradorDepartamento[],
  termo: string
): Set<string> {
  const ids = new Set<string>()
  const t = normalizarTexto(termo.trim())
  if (!t) return ids

  const alvos = departamentos.filter(
    (d) => normalizarTexto(d.nome) === t || (d.nome_curto ? normalizarTexto(d.nome_curto) === t : false)
  )
  if (alvos.length === 0) {
    const fuzzy = encontrarDepartamentoFuzzy(departamentos, null, termo)
    if (fuzzy) alvos.push(fuzzy)
  }

  // O cadastro pode ter LINHAS DUPLICADAS para o mesmo departamento (ex.:
  // "Aliança S/A - Indústria..." com nome_curto CBO e "ALIANCA S A INDUSTRIA..."
  // sem nome_curto) — o colaborador pode apontar para qualquer uma delas.
  // Expande o alvo para todas as linhas com o mesmo nome ou nome_curto
  // normalizado.
  const chaves = new Set<string>()
  alvos.forEach((d) => {
    chaves.add(normalizarTexto(d.nome))
    if (d.nome_curto) chaves.add(normalizarTexto(d.nome_curto))
  })
  const alvosExpandidos = departamentos.filter(
    (d) => chaves.has(normalizarTexto(d.nome)) || (d.nome_curto ? chaves.has(normalizarTexto(d.nome_curto)) : false)
  )

  if (alvosExpandidos.length === 0) {
    // Sem departamento correspondente: fallback pelo texto livre do cadastro.
    for (const c of colaboradores) {
      if (c.departamento && normalizarTexto(c.departamento).includes(t)) ids.add(c.id)
    }
    return ids
  }

  const alvoIds = new Set(alvosExpandidos.map((d) => d.id))
  for (const c of colaboradores) {
    const dep = encontrarDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento, c.empresa_id)
    if (dep && alvoIds.has(dep.id)) ids.add(c.id)
  }
  return ids
}
