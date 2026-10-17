// Leitura de respostas em TEXTO da planilha de pedidos (importação de outubro/2026,
// scripts/materiais/importar-pedidos-outubro.ts). Lógica pura e testada.
//
// Regra do projeto — "importação nunca grava palpite": aqui só se aceita o que o texto da
// resposta diz de forma explícita (número + unidade que bate com a do item; número + palavra
// que identifica UMA variação). Qualquer dúvida devolve null/erro e a linha vira pendência.

import { normalizarTexto } from './normalizar'

export interface RegraVariacaoTexto {
  /** Expressão regular (texto) aplicada sobre o trecho normalizado (minúsculas, sem acento). */
  padrao: string
  variacao_id: string
}

const UNIDADES_GENERICAS = new Set(['unidade', 'unidades', 'unid', 'un', 'und'])
const UNIDADES_LITRO = new Set(['litro', 'litros', 'l', 'lt', 'lts'])

/** A palavra de unidade escrita pelo líder bate com a unidade de pedido do item? */
export function unidadeBate(palavra: string, unidadeItem: string): boolean {
  const p = normalizarTexto(palavra)
  if (!p) return false
  if (UNIDADES_GENERICAS.has(p)) return true
  const palavrasItem = normalizarTexto(unidadeItem).split(' ').filter(Boolean)
  const formas = new Set([p, p.replace(/s$/, ''), p.replace(/es$/, ''), p.replace(/oes$/, 'ao')])
  if ([...formas].some((f) => palavrasItem.includes(f))) return true
  // "2 litros" de um item vendido em frasco de 1 litro ("frasco/garrafa 1L") = 2 frascos.
  return UNIDADES_LITRO.has(p) && palavrasItem.includes('1l')
}

/**
 * "6 unidades", "1 bombona", "2 litros", "1 unidade mandar melhor qualidade".
 * Aceita texto depois da unidade só se não tiver número (vira observação). Unidade que não bate
 * com a do item, ou formato diferente, devolve null.
 */
export function lerQuantidadeComUnidade(valor: string, unidadeItem: string): { qtd: number; resto: string } | null {
  const m = normalizarTexto(valor).match(/^(\d{1,3}) ?([a-z]+)(?: (.+))?$/)
  if (!m) return null
  if (!unidadeBate(m[2], unidadeItem)) return null
  const resto = m[3] ?? ''
  if (/\d/.test(resto)) return null
  return { qtd: Number(m[1]), resto: resto ? valor.trim() : '' }
}

export type LeituraPorVariacao =
  | { ok: true; partes: { variacao_id: string; quantidade: number }[] }
  | { ok: false; motivo: string }

/**
 * "3 vassoura piaçava 3 vassoura noviça", "2 verde 2 azul", "3 350": cada número de 1 ou 2
 * dígitos abre um trecho que vai até o próximo número; o texto do trecho tem de bater com
 * exatamente UMA variação. Tudo ou nada: qualquer trecho sem variação clara invalida a resposta.
 */
export function lerQuantidadePorVariacao(valor: string, regras: RegraVariacaoTexto[]): LeituraPorVariacao {
  const tokens = valor.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { ok: false, motivo: 'texto vazio' }
  const trechos: { quantidade: number; texto: string[] }[] = []
  for (const t of tokens) {
    if (/^\d{1,2}$/.test(t)) trechos.push({ quantidade: Number(t), texto: [] })
    else if (trechos.length === 0) return { ok: false, motivo: 'a resposta não começa com a quantidade' }
    else trechos[trechos.length - 1].texto.push(t)
  }
  const partes: { variacao_id: string; quantidade: number }[] = []
  for (const tr of trechos) {
    const txt = normalizarTexto(tr.texto.join(' '))
    if (!txt) return { ok: false, motivo: `quantidade ${tr.quantidade} sem texto de variação` }
    const batem = new Set(regras.filter((r) => new RegExp(r.padrao).test(txt)).map((r) => r.variacao_id))
    if (batem.size !== 1) return { ok: false, motivo: batem.size === 0 ? `"${txt}" não bate com nenhuma variação` : `"${txt}" bate com mais de uma variação` }
    const variacao_id = [...batem][0]
    const existente = partes.find((p) => p.variacao_id === variacao_id)
    if (existente) existente.quantidade += tr.quantidade
    else partes.push({ variacao_id, quantidade: tr.quantidade })
  }
  return { ok: true, partes }
}
