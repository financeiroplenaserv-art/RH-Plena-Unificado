import { removerAcentos } from '@/lib/utils'
import { separarTamanhoDoNome } from './pecasCeu'

// CEU → Pedidos: "Última" e "Penúltima" entrega da PEÇA (qualquer tamanho) e
// filtro por peça. Lógica pura, sem acesso a banco.

export interface EntregaBruta {
  item_id: string
  data_entrega: string
  quantidade: number | null
}

export interface EntregaDoDia {
  /** AAAA-MM-DD */
  data: string
  /** Soma das quantidades entregues na data (todas as linhas da peça). */
  quantidade: number
  /** Itens (tamanhos) entregues na data, sem repetir. */
  itemIds: string[]
}

/**
 * Agrupa as entregas por DATA (soma a quantidade; null conta 1) e ordena da mais
 * recente para a mais antiga. Assim "última" e "penúltima" são sempre duas datas
 * distintas — duas unidades entregues no mesmo dia continuam sendo uma entrega só.
 */
export function agruparEntregasPorData(entregas: EntregaBruta[]): EntregaDoDia[] {
  const m = new Map<string, EntregaDoDia>()
  for (const e of entregas) {
    if (!e.data_entrega) continue
    const g = m.get(e.data_entrega) ?? { data: e.data_entrega, quantidade: 0, itemIds: [] }
    g.quantidade += e.quantidade == null ? 1 : Number(e.quantidade)
    if (!g.itemIds.includes(e.item_id)) g.itemIds.push(e.item_id)
    m.set(e.data_entrega, g)
  }
  return [...m.values()].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
}

export function ultimaEPenultima(entregas: EntregaBruta[]): { ultima: EntregaDoDia | null; penultima: EntregaDoDia | null } {
  const g = agruparEntregasPorData(entregas)
  return { ultima: g[0] ?? null, penultima: g[1] ?? null }
}

/** "2 un" / "2 un · tam. 40" / "2 un · tam. 40, 41" (tamanhos já resolvidos pelo chamador). */
export function detalheEntrega(quantidade: number, tamanhos: (string | null)[]): string {
  const tams = [...new Set(tamanhos.filter((t): t is string => !!t))]
  return [`${quantidade} un`, tams.length ? `tam. ${tams.join(', ')}` : null].filter(Boolean).join(' · ')
}

// ---------- filtro "Peça" ----------

export const ROTULO_PECA_CRACHA = 'Crachá'

export interface LinhaParaPeca {
  tipo: 'uniforme' | 'epi' | 'cracha'
  item_id: string | null
}

/** Nome base da peça (sem tamanho) ou "Crachá"; null quando a linha não tem item. */
export function rotuloPecaDaLinha(l: LinhaParaPeca, nomeDoItem: (id: string) => string | undefined): string | null {
  if (l.tipo === 'cracha') return ROTULO_PECA_CRACHA
  const nome = l.item_id ? nomeDoItem(l.item_id) : undefined
  return nome ? separarTamanhoDoNome(nome).base : null
}

const norm = (s: string) => removerAcentos(s).toLowerCase().trim()

/** Rótulos únicos (por texto normalizado) das peças presentes, em ordem alfabética pt-BR. */
export function opcoesPeca(linhas: LinhaParaPeca[], nomeDoItem: (id: string) => string | undefined): string[] {
  const m = new Map<string, string>()
  for (const l of linhas) {
    const r = rotuloPecaDaLinha(l, nomeDoItem)
    if (r && !m.has(norm(r))) m.set(norm(r), r)
  }
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
}

/** Vazio = todas; senão a peça da linha precisa conter o texto (sem acento/caixa). */
export function linhaCasaComPeca(l: LinhaParaPeca, filtro: string, nomeDoItem: (id: string) => string | undefined): boolean {
  const f = norm(filtro ?? '')
  if (!f) return true
  const r = rotuloPecaDaLinha(l, nomeDoItem)
  return !!r && norm(r).includes(f)
}
