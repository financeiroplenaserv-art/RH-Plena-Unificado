import type { MatKitItem } from '@/types/materiais'
import { chaveItem, type ConsumoMes } from './media'

// "Substituir em todos os kits" (migration 128): o item X (ou só uma variação
// dele) foi descontinuado e trocado pelo Y em todos os contratos. Aqui ficam
// (1) a prévia — espelho da RPC mat_substituir_item_kits — e (2) a cadeia de
// substituição usada pela média de consumo: o histórico ORIGINAL nunca é
// reescrito; a média do item novo soma o consumo dos itens que ele substituiu
// (X→Y→W), lendo os vínculos substituido_por_* de mat_itens/mat_item_variacoes.

// ------------------------------------------------------------------
// Validação
// ------------------------------------------------------------------

export interface ParamsSubstituicao {
  deItemId: string
  deVariacaoId: string | null
  paraItemId: string
  paraVariacaoId: string | null
}

export interface ItemParaValidar {
  id: string
  ativo: boolean
}

export interface VariacaoParaValidar {
  id: string
  item_id: string
  ativo: boolean
}

/** Mensagem do primeiro impedimento, ou null quando dá para substituir. */
export function validarSubstituicao(
  p: ParamsSubstituicao,
  itens: ItemParaValidar[],
  variacoes: VariacaoParaValidar[]
): string | null {
  if (!p.deItemId) return 'Escolha o item de origem.'
  if (!p.paraItemId) return 'Escolha o item de destino.'
  const destino = itens.find((i) => i.id === p.paraItemId)
  if (!destino) return 'Item de destino não encontrado.'
  if (!destino.ativo) return 'O item de destino está inativo.'
  if (p.deItemId === p.paraItemId) {
    // Trocar só a variação dentro do mesmo item é permitido; o resto é origem = destino.
    if (!p.deVariacaoId || !p.paraVariacaoId || p.deVariacaoId === p.paraVariacaoId) {
      return 'A origem e o destino são o mesmo item.'
    }
  }
  if (p.deVariacaoId) {
    const v = variacoes.find((x) => x.id === p.deVariacaoId)
    if (!v || v.item_id !== p.deItemId) return 'A variação de origem não pertence ao item de origem.'
  }
  const ativasDestino = variacoes.filter((v) => v.item_id === p.paraItemId && v.ativo)
  if (p.paraVariacaoId) {
    const v = ativasDestino.find((x) => x.id === p.paraVariacaoId)
    if (!v) return 'A variação de destino não pertence ao item de destino ou está inativa.'
  } else if (ativasDestino.length > 0) {
    return 'O item de destino tem variações: escolha a variação de destino.'
  }
  return null
}

// ------------------------------------------------------------------
// Prévia (espelha a RPC)
// ------------------------------------------------------------------

export type LinhaKitSubst = Pick<MatKitItem, 'id' | 'contrato_id' | 'item_id' | 'variacao_id' | 'quantidade' | 'periodicidade_meses'>

export interface ContratoSubst {
  id: string
  nome: string
  ativo: boolean
}

export interface LinhaPreviaSubstituicao {
  contratoId: string
  contratoNome: string
  contratoAtivo: boolean
  /** Linhas do item de origem que saem do kit. */
  origem: LinhaKitSubst[]
  /** Soma das quantidades de origem. */
  quantidadeOrigem: number
  /** Linha do destino que já existia no kit (recebe a soma). */
  destinoExistente: LinhaKitSubst | null
  /** Quantidade final da linha do destino. */
  quantidadeNova: number
  /** Periodicidade final (a da linha que permanece). */
  periodicidadeMeses: number
  /** O contrato já tinha o destino (ou havia 2+ linhas de origem): as quantidades são somadas numa linha só. */
  soma: boolean
  /** Linhas somadas com periodicidades diferentes — vale a da linha que permanece. */
  periodicidadeDivergente: boolean
}

export interface PreviaSubstituicao {
  linhas: LinhaPreviaSubstituicao[]
  contratos: number
  linhasSomadas: number
}

const porId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * Mesma regra da RPC: cada linha de origem (todas as variações do item, ou só
 * a escolhida) vira a linha do destino mantendo quantidade e periodicidade;
 * se o contrato já tem o destino, as quantidades somam numa linha só (vale a
 * periodicidade da linha que já existia). Contrato inativo também entra.
 */
export function montarPreviaSubstituicao(
  p: ParamsSubstituicao,
  kit: LinhaKitSubst[],
  contratos: ContratoSubst[]
): PreviaSubstituicao {
  const ehOrigem = (k: LinhaKitSubst) =>
    k.item_id === p.deItemId && (p.deVariacaoId == null || k.variacao_id === p.deVariacaoId)
  const chaveDestino = chaveItem(p.paraItemId, p.paraVariacaoId)
  const nomes = new Map(contratos.map((c) => [c.id, c]))

  const porContrato = new Map<string, LinhaKitSubst[]>()
  for (const k of kit) {
    // a própria linha de destino nunca é "origem" (troca de variação no mesmo item)
    if (!ehOrigem(k) || chaveItem(k.item_id, k.variacao_id) === chaveDestino) continue
    const lista = porContrato.get(k.contrato_id) ?? []
    lista.push(k)
    porContrato.set(k.contrato_id, lista)
  }

  const linhas: LinhaPreviaSubstituicao[] = []
  for (const [contratoId, origemBruta] of porContrato) {
    const origem = [...origemBruta].sort(porId)
    const destino =
      kit.find((k) => k.contrato_id === contratoId && chaveItem(k.item_id, k.variacao_id) === chaveDestino) ?? null
    const quantidadeOrigem = origem.reduce((s, k) => s + Number(k.quantidade), 0)
    const permanece = destino ?? origem[0]
    const periodicidades = new Set([...(destino ? [destino] : []), ...origem].map((k) => k.periodicidade_meses ?? 1))
    const c = nomes.get(contratoId)
    linhas.push({
      contratoId,
      contratoNome: c?.nome ?? '(contrato removido)',
      contratoAtivo: c?.ativo ?? false,
      origem,
      quantidadeOrigem,
      destinoExistente: destino,
      quantidadeNova: quantidadeOrigem + (destino ? Number(destino.quantidade) : 0),
      periodicidadeMeses: permanece.periodicidade_meses ?? 1,
      soma: !!destino || origem.length > 1,
      periodicidadeDivergente: periodicidades.size > 1,
    })
  }
  linhas.sort(
    (a, b) =>
      Number(b.soma) - Number(a.soma) ||
      Number(b.contratoAtivo) - Number(a.contratoAtivo) ||
      a.contratoNome.localeCompare(b.contratoNome, 'pt-BR')
  )
  return { linhas, contratos: linhas.length, linhasSomadas: linhas.filter((l) => l.soma).length }
}

// ------------------------------------------------------------------
// Cadeia de substituição (média do item novo)
// ------------------------------------------------------------------

/** Vínculo gravado pela RPC: no item inteiro (variacao_id null) ou só numa variação. */
export interface VinculoSubstituicao {
  item_id: string
  variacao_id: string | null
  substituido_por_id: string
  substituido_por_variacao_id: string | null
}

export interface MapaSubstituicoes {
  porVariacao: Map<string, VinculoSubstituicao>
  porItem: Map<string, VinculoSubstituicao>
}

export function mapaSubstituicoes(vinculos: VinculoSubstituicao[]): MapaSubstituicoes {
  const porVariacao = new Map<string, VinculoSubstituicao>()
  const porItem = new Map<string, VinculoSubstituicao>()
  for (const v of vinculos) {
    if (v.variacao_id) porVariacao.set(v.variacao_id, v)
    else porItem.set(v.item_id, v)
  }
  return { porVariacao, porItem }
}

const LIMITE_CADEIA = 50

/**
 * Item/variação final da cadeia X→Y→W. O vínculo da variação vale antes do
 * vínculo do item. Ciclo (X→Y→X, gravado por engano) não trava: para no
 * último elo ainda não visitado.
 */
export function resolverSubstituto(
  itemId: string,
  variacaoId: string | null,
  mapa: MapaSubstituicoes
): { item_id: string; variacao_id: string | null } {
  let atual = { item_id: itemId, variacao_id: variacaoId }
  const vistos = new Set([chaveItem(itemId, variacaoId)])
  for (let i = 0; i < LIMITE_CADEIA; i++) {
    const v = (atual.variacao_id ? mapa.porVariacao.get(atual.variacao_id) : undefined) ?? mapa.porItem.get(atual.item_id)
    if (!v) break
    const prox = { item_id: v.substituido_por_id, variacao_id: v.substituido_por_variacao_id }
    const chave = chaveItem(prox.item_id, prox.variacao_id)
    if (vistos.has(chave)) break
    vistos.add(chave)
    atual = prox
  }
  return atual
}

/**
 * Consumo com o item/variação trocados pelo substituto final — a média do
 * item novo passa a somar o histórico dos itens que ele substituiu. Os dados
 * originais não mudam (cópia). Sem vínculos, devolve o próprio array.
 */
export function aplicarSubstituicoes<T extends Pick<ConsumoMes, 'item_id' | 'variacao_id'>>(
  consumos: T[],
  vinculos: VinculoSubstituicao[]
): T[] {
  if (vinculos.length === 0) return consumos
  const mapa = mapaSubstituicoes(vinculos)
  return consumos.map((c) => {
    const r = resolverSubstituto(c.item_id, c.variacao_id, mapa)
    return r.item_id === c.item_id && r.variacao_id === c.variacao_id ? c : { ...c, ...r }
  })
}

/** Variante para linhas de pedido (item_id pode ser null — descrição livre). */
export function aplicarSubstituicoesLinhas<T extends { item_id: string | null; variacao_id: string | null }>(
  linhas: T[],
  vinculos: VinculoSubstituicao[]
): T[] {
  if (vinculos.length === 0) return linhas
  const mapa = mapaSubstituicoes(vinculos)
  return linhas.map((l) => {
    if (!l.item_id) return l
    const r = resolverSubstituto(l.item_id, l.variacao_id, mapa)
    return r.item_id === l.item_id && r.variacao_id === l.variacao_id ? l : { ...l, ...r }
  })
}

/** O destino já leva (direta ou indiretamente) à origem? Gravar o vínculo criaria ciclo. */
export function criariaCiclo(p: ParamsSubstituicao, vinculos: VinculoSubstituicao[]): boolean {
  const mapa = mapaSubstituicoes(vinculos)
  const ehOrigem = (n: { item_id: string; variacao_id: string | null }) =>
    n.item_id === p.deItemId && (p.deVariacaoId == null || n.variacao_id === p.deVariacaoId)
  let atual = { item_id: p.paraItemId, variacao_id: p.paraVariacaoId }
  const vistos = new Set<string>()
  for (let i = 0; i < LIMITE_CADEIA; i++) {
    if (ehOrigem(atual)) return true
    const chave = chaveItem(atual.item_id, atual.variacao_id)
    if (vistos.has(chave)) return false
    vistos.add(chave)
    const v = (atual.variacao_id ? mapa.porVariacao.get(atual.variacao_id) : undefined) ?? mapa.porItem.get(atual.item_id)
    if (!v) return false
    atual = { item_id: v.substituido_por_id, variacao_id: v.substituido_por_variacao_id }
  }
  return false
}
