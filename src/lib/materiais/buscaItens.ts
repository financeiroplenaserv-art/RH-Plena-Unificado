// Busca tolerante a erro de digitação no catálogo de materiais — lógica pura.
// Usada pelo campo único "O que mais você precisa?" do link do líder (ação
// `buscar_item` da Edge Function pedido-materiais): o líder digita "cab",
// "cabo vasora", "detergete", "piaçava", "disco 350" e recebe até 8
// sugestões ATIVAS.
//
// Variações (decisão da gestão, 16/10/2026): item com variações vira UM
// resultado por variação, com nome de exibição completo ("Vassoura Noviça",
// "Disco branco 350 mm", "Flanela Microfibra amarela") — a busca olha também
// o rótulo da variação e os nomes antigos (`mat_aliases`) ligados a ela. No
// link do líder cada quadro tem um item e uma variação já definidos aqui.
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
  /** Nomes antigos e grafias do ITEM (mat_aliases.nome_legado sem variacao_id). */
  aliases?: string[]
  /** Variações ativas: com elas, cada variação é um resultado próprio. */
  variacoes?: { id: string; rotulo: string }[]
  /** Nomes antigos ligados a uma variação (mat_aliases com variacao_id), por id da variação. */
  aliasesPorVariacao?: Record<string, string[]>
  /** Itens (ou variações) do kit do contrato: pequena preferência no desempate. */
  noKit?: boolean
  /** Ids das variações que estão no kit (o item inteiro no kit = noKit). */
  variacoesNoKit?: string[]
}

// Palavras de cadastro que não ajudam a pessoa a reconhecer o item.
// Conservador: só a unidade no FIM do nome ("Pedra Sanitária UN", "Saco de
// lixo PCT") e "Especial" quando há uma variação para pôr no lugar
// ("Vassoura Especial" + "Noviça" = "Vassoura Noviça").
const UNIDADE_NO_FIM = /\s+(UN|UND|UNID|PCT)\.?$/i
const GENERICAS_COM_VARIACAO = /\s+especial\b/gi

/**
 * Nome amigável do item (com a variação, quando houver): "Vassoura Especial
 * UN" + "Noviça" = "Vassoura Noviça"; "Disco branco UN" + "350 mm" = "Disco
 * branco 350 mm"; "Pedra Sanitária UN" = "Pedra Sanitária". Na dúvida (o nome
 * ficaria vazio), mantém o nome do cadastro.
 */
export function nomeExibicaoItem(nome: string, rotuloVariacao?: string | null): string {
  const original = (nome ?? '').trim()
  let base = original.replace(UNIDADE_NO_FIM, '').trim()
  const rotulo = (rotuloVariacao ?? '').trim()
  if (rotulo) {
    const semGenerica = base.replace(GENERICAS_COM_VARIACAO, '').replace(/\s+/g, ' ').trim()
    if (semGenerica) base = semGenerica
  }
  if (!base) base = original
  if (!rotulo) return base
  // Rótulo que já está no nome ("Mop Cabo grande" + "grande") não repete.
  if (` ${normalizarBusca(base)}`.endsWith(` ${normalizarBusca(rotulo)}`)) return base
  return `${base} ${rotulo}`
}

/** Assinatura do fallback futuro (não usado hoje). Deve devolver ids do catálogo. */
export type FallbackBusca = (termo: string, nomes: { id: string; nome: string }[]) => Promise<string[]>

export const BUSCA_MIN_CARACTERES = 3
// 8 resultados (decisão da gestora, 16/10/2026): "vassoura" cabe inteira
// (Piaçava ficava de fora com 5); busca maior ("disco") pede para detalhar.
export const BUSCA_MAX_RESULTADOS = 8
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
  /** Variação do resultado (item com variações = um resultado por variação). */
  variacao: { id: string; rotulo: string } | null
  /** Nome de exibição completo (nomeExibicaoItem). */
  nome: string
  nota: number
  /** Nome (ou alias) que casou melhor. */
  casouCom: string
}

/** Preferência do kit do contrato no desempate (não faz item ruim passar na frente de item bom). */
const BONUS_KIT = 0.03

/**
 * Até `limite` resultados que casam com o termo, do melhor para o pior. Item
 * com variações gera um resultado por variação. Termo com menos de
 * BUSCA_MIN_CARACTERES letras não busca (evita "listar tudo"). Em empate,
 * vem primeiro o do kit do contrato e uma variação de cada item antes da
 * segunda do mesmo item ("vassoura" mostra vassouras diferentes).
 */
export function buscarItens<T extends ItemBuscavel>(
  termo: string,
  itens: T[],
  limite = BUSCA_MAX_RESULTADOS,
  notaMinima = NOTA_MINIMA
): ResultadoBusca<T>[] {
  const tn = normalizarBusca(termo)
  if (tn.replace(/ /g, '').length < BUSCA_MIN_CARACTERES) return []
  type Candidato = ResultadoBusca<T> & { ordemNoItem: number; kit: boolean }
  const candidatos: Candidato[] = []
  for (const item of itens) {
    const variacoes = item.variacoes ?? []
    const alvos: { variacao: { id: string; rotulo: string } | null; nomes: string[]; aliases: string[]; kit: boolean }[] =
      variacoes.length === 0
        ? [{ variacao: null, nomes: [item.nome], aliases: item.aliases ?? [], kit: !!item.noKit }]
        : variacoes.map((v) => ({
            variacao: v,
            nomes: [nomeExibicaoItem(item.nome, v.rotulo), `${item.nome} ${v.rotulo}`],
            aliases: [...(item.aliasesPorVariacao?.[v.id] ?? []), ...(item.aliases ?? [])],
            kit: !!item.noKit || (item.variacoesNoKit ?? []).includes(v.id),
          }))
    alvos.forEach((alvo, ordemNoItem) => {
      let melhor = 0
      let casouCom = alvo.nomes[0]
      for (const n of alvo.nomes) {
        const nota = notaNome(tn, n)
        if (nota > melhor) {
          melhor = nota
          casouCom = n
        }
      }
      for (const a of alvo.aliases) {
        // alias vale um pouco menos que o nome oficial (desempate)
        const n = notaNome(tn, a) * 0.97
        if (n > melhor) {
          melhor = n
          casouCom = a
        }
      }
      if (melhor < notaMinima) return
      candidatos.push({
        item,
        variacao: alvo.variacao,
        nome: nomeExibicaoItem(item.nome, alvo.variacao?.rotulo),
        nota: Math.min(1, melhor) + (alvo.kit ? BONUS_KIT : 0),
        casouCom,
        ordemNoItem,
        kit: alvo.kit,
      })
    })
  }
  // Ordem entre as variações do mesmo item que empataram: a 1ª de cada item
  // vem antes da 2ª de qualquer item.
  const faixa = (n: number) => Math.round(n * 100)
  const vistosPorFaixa = new Map<string, number>()
  const ordenados = candidatos.sort(
    (a, b) => b.nota - a.nota || a.ordemNoItem - b.ordemNoItem || a.nome.localeCompare(b.nome, 'pt-BR')
  )
  const posicaoNoItem = new Map<Candidato, number>()
  for (const c of ordenados) {
    const chave = `${faixa(c.nota)}|${c.item.id}`
    const n = vistosPorFaixa.get(chave) ?? 0
    posicaoNoItem.set(c, n)
    vistosPorFaixa.set(chave, n + 1)
  }
  return ordenados
    .sort(
      (a, b) =>
        faixa(b.nota) - faixa(a.nota) ||
        posicaoNoItem.get(a)! - posicaoNoItem.get(b)! ||
        b.nota - a.nota ||
        a.ordemNoItem - b.ordemNoItem ||
        a.nome.localeCompare(b.nome, 'pt-BR')
    )
    .slice(0, Math.max(0, Math.min(limite, BUSCA_MAX_RESULTADOS)))
    .map(({ item, variacao, nome, nota, casouCom }) => ({ item, variacao, nome, nota, casouCom }))
}
