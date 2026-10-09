import type { MatItem, MatItemVariacao, MatKitItem, MatPreco } from '@/types/materiais'
import { chaveItem, mediaConsumo, type ConsumoMes } from './media'
import { normalizarTexto } from './normalizar'
import { arredondar, precoVigente, type PrecoHistorico } from './precos'

// Lógica pura das telas de cadastro do módulo Materiais (catálogo, kit).

/** Histórico de preços de um item/variação, do mais recente para o mais antigo. */
export function historicoPrecos<T extends Pick<MatPreco, 'item_id' | 'variacao_id' | 'vigente_desde'> & { created_at?: string }>(
  precos: T[],
  itemId: string,
  variacaoId: string | null
): T[] {
  return precos
    .filter((p) => p.item_id === itemId && (p.variacao_id ?? null) === variacaoId)
    .sort((a, b) =>
      a.vigente_desde === b.vigente_desde
        ? (b.created_at ?? '').localeCompare(a.created_at ?? '')
        : b.vigente_desde.localeCompare(a.vigente_desde)
    )
}

/** Valida o lançamento de um novo preço. Devolve a mensagem de erro ou null. */
export function validarNovoPreco(preco: number | null, vigenteDesde: string): string | null {
  if (preco == null || Number.isNaN(preco)) return 'Informe o preço.'
  if (preco < 0) return 'O preço não pode ser negativo.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vigenteDesde)) return 'Informe a data de início da vigência.'
  return null
}

/** Converte texto digitado ("12,50", "1.234,5", "R$ 3") em número; null se vazio/inválido. */
export function lerNumero(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').trim()
  if (!limpo) return null
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

/** Já existe outro item/contrato com o mesmo nome (sem acento/caixa)? */
export function nomeDuplicado(nome: string, existentes: { id: string; nome: string }[], ignorarId?: string | null): boolean {
  const alvo = normalizarTexto(nome)
  if (!alvo) return false
  return existentes.some((e) => e.id !== ignorarId && normalizarTexto(e.nome) === alvo)
}

export interface LinhaKit {
  kit: Pick<MatKitItem, 'id' | 'item_id' | 'variacao_id' | 'quantidade' | 'periodicidade_meses' | 'observacao'>
  itemNome: string
  unidade: string
  variacaoRotulo: string | null
  precoUnitario: number | null
  subtotal: number | null
  /** Média mensal (últimos 6 meses fechados) de consumo do item no contrato. */
  media6: number | null
}

/**
 * Monta as linhas da tabela do Kit Mensal com preço vigente e subtotal
 * (kit × preço). O limite do contrato é `limiteContrato` (precos.ts).
 */
export function montarLinhasKit(
  kit: LinhaKit['kit'][],
  itens: Pick<MatItem, 'id' | 'nome' | 'unidade_pedido'>[],
  variacoes: Pick<MatItemVariacao, 'id' | 'rotulo'>[],
  precos: PrecoHistorico[],
  hoje: string,
  consumos: ConsumoMes[] = []
): LinhaKit[] {
  const mapaItens = new Map(itens.map((i) => [i.id, i]))
  const mapaVar = new Map(variacoes.map((v) => [v.id, v]))
  const media = consumos.length > 0 ? mediaConsumo(consumos, precos, hoje, 6).quantidadePorItem : null
  return kit
    .map((k) => {
      const item = mapaItens.get(k.item_id)
      const preco = precoVigente(precos, k.item_id, k.variacao_id, hoje)
      return {
        kit: k,
        itemNome: item?.nome ?? '(item removido)',
        unidade: item?.unidade_pedido ?? '',
        variacaoRotulo: k.variacao_id ? (mapaVar.get(k.variacao_id)?.rotulo ?? '—') : null,
        precoUnitario: preco,
        subtotal: preco == null ? null : arredondar(Number(k.quantidade) * preco),
        media6: media ? (media[chaveItem(k.item_id, k.variacao_id)] ?? 0) : null,
      }
    })
    .sort((a, b) =>
      a.itemNome.localeCompare(b.itemNome, 'pt-BR', { sensitivity: 'base' }) ||
      (a.variacaoRotulo ?? '').localeCompare(b.variacaoRotulo ?? '', 'pt-BR')
    )
}

/** O par item/variação já está no kit? (o banco tem índice único equivalente) */
export function jaNoKit(
  kit: Pick<MatKitItem, 'id' | 'item_id' | 'variacao_id'>[],
  itemId: string,
  variacaoId: string | null,
  ignorarId?: string | null
): boolean {
  const chave = chaveItem(itemId, variacaoId)
  return kit.some((k) => k.id !== ignorarId && chaveItem(k.item_id, k.variacao_id) === chave)
}
