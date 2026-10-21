import type { MatCompraItem, RotaMaterial, StatusProdutos } from '@/types/materiais'
import { descricaoItemCompra } from './compra'
import { ordemRota } from './pedidos'

// Tela Chegadas (Marco B da Fase 2 — docs/PLANO_MATERIAIS_FASE2.md §4/§5 passo 7).
// A mesa registra, por contrato, o que o fornecedor entregou (padrão = o que foi
// comprado; menor exige motivo; maior é recusado — mesma regra da RPC
// mat_registrar_chegada) e confirma o "remanejamento feito" das linhas levadas
// de outro posto (migration 151 — sem isso o pedido não fecha como entregue).
// Lógica pura: agrupamento, validação e payload das RPCs.

/** Edição de uma célula ou de um remanejamento na tela (texto do input + motivo). */
export interface EdicaoChegada {
  qtd: string
  motivo: string
}

const numero = (v: string): number | null => {
  const t = v.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export interface GrupoContratoChegada {
  /** null = reposição do estoque (entrega no escritório). */
  contratoId: string | null
  contratoNome: string
  rota: RotaMaterial | null
  celulas: MatCompraItem[]
  /** Todas as células já têm chegada registrada. */
  registrado: boolean
}

/** Células da compra agrupadas por contrato (rota 1→4, sem rota e reposição no fim; nome pt-BR). */
export function agruparCelulasPorContrato(itens: MatCompraItem[]): GrupoContratoChegada[] {
  const m = new Map<string, GrupoContratoChegada>()
  for (const c of itens) {
    const k = c.contrato_id ?? '__estoque__'
    let g = m.get(k)
    if (!g) {
      g = {
        contratoId: c.contrato_id,
        contratoNome: c.contrato_id ? (c.contrato_nome ?? 'Contrato') : 'Reposição do estoque (escritório)',
        rota: c.rota,
        celulas: [],
        registrado: true,
      }
      m.set(k, g)
    }
    g.celulas.push(c)
    if (c.qtd_recebida == null) g.registrado = false
  }
  const lista = [...m.values()]
  for (const g of lista)
    g.celulas.sort((a, b) => descricaoItemCompra(a.item_nome, a.variacao_rotulo).localeCompare(descricaoItemCompra(b.item_nome, b.variacao_rotulo), 'pt-BR'))
  return lista.sort((a, b) => {
    const ea = a.contratoId == null ? 1 : 0
    const eb = b.contratoId == null ? 1 : 0
    if (ea !== eb) return ea - eb
    const ra = ordemRota(a.rota)
    const rb = ordemRota(b.rota)
    return ra - rb || a.contratoNome.localeCompare(b.contratoNome, 'pt-BR')
  })
}

/** Valor inicial do input: o já registrado ou, sem registro, o comprado. */
export const edicaoInicialCelula = (c: MatCompraItem): EdicaoChegada => ({
  qtd: String(c.qtd_recebida ?? c.quantidade),
  motivo: c.motivo_recebimento ?? '',
})

/** Primeiro problema da célula, ou null. Espelha as travas de mat_registrar_chegada. */
export function erroChegada(c: MatCompraItem, e: EdicaoChegada): string | null {
  const q = numero(e.qtd)
  if (q == null || q < 0) return 'Quantidade inválida.'
  if (q > c.quantidade) return `Maior que o comprado (${c.quantidade}). Chegou a mais? Registre o comprado e avise o comprador.`
  if (c.contrato_id == null && c.qtd_recebida != null && q < c.qtd_recebida)
    return `Reposição do estoque só aumenta (já registrado ${c.qtd_recebida}); corrija pelo estoque.`
  if (q < c.quantidade && !e.motivo.trim()) return 'Chegou menos: informe o motivo (vai para a carta ao líder).'
  return null
}

/** A célula foi alterada em relação ao que está gravado (ou ainda não foi registrada). */
export function celulaPendente(c: MatCompraItem, e: EdicaoChegada | undefined): boolean {
  if (c.qtd_recebida == null) return true
  if (!e) return false
  return numero(e.qtd) !== c.qtd_recebida || (e.motivo.trim() || null) !== (c.motivo_recebimento?.trim() || null)
}

export interface PayloadChegada {
  id: string
  qtd_recebida: number
  motivo: string | null
}

/**
 * Payload de mat_registrar_chegada para as células do grupo que estão pendentes
 * (sem registro ou alteradas). `chegouTudo` = todas com o comprado, sem motivo.
 */
export function montarPayloadChegada(
  celulas: MatCompraItem[],
  edicoes: Record<string, EdicaoChegada>,
  chegouTudo = false
): { payload: PayloadChegada[]; erros: { id: string; erro: string }[] } {
  const payload: PayloadChegada[] = []
  const erros: { id: string; erro: string }[] = []
  for (const c of celulas) {
    if (chegouTudo) {
      if (c.contrato_id == null && c.qtd_recebida != null && c.qtd_recebida >= c.quantidade) continue
      if (c.qtd_recebida === c.quantidade) continue
      payload.push({ id: c.id, qtd_recebida: c.quantidade, motivo: null })
      continue
    }
    const e = edicoes[c.id] ?? edicaoInicialCelula(c)
    if (!celulaPendente(c, edicoes[c.id])) continue
    const erro = erroChegada(c, e)
    if (erro) {
      erros.push({ id: c.id, erro })
      continue
    }
    const q = numero(e.qtd) as number
    payload.push({ id: c.id, qtd_recebida: q, motivo: q < c.quantidade ? e.motivo.trim() : null })
  }
  return { payload, erros }
}

// ---------------------------------------------------------------- remanejamentos

/** Linha remanejada (formato da RPC mat_chegadas). */
export interface RemanejamentoChegada {
  linha_id: string
  pedido_id: string
  competencia: string
  contrato_id: string
  contrato_nome: string
  rota: RotaMaterial | null
  origem_id: string | null
  origem_nome: string | null
  item_id: string | null
  variacao_id: string | null
  item_nome: string | null
  variacao_rotulo: string | null
  unidade: string | null
  qtd_remanejada: number
  qtd_entregue_remanejada: number | null
  remanejamento_obs: string | null
  motivo_entrega: string | null
  confirmado_em: string | null
  status_pedido: StatusProdutos
  /** Compras (não canceladas) da mesma geração. */
  compras: string[]
}

export interface PedidoChegada {
  pedido_id: string
  contrato_id: string
  contrato_nome: string
  tipo: 'mensal' | 'extra'
  implantacao: boolean
  status_produtos: StatusProdutos
}

export interface DadosChegadas {
  competencia: string
  hoje: string
  remanejamentos: RemanejamentoChegada[]
  pedidos: PedidoChegada[]
}

const numOuNulo = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

export function normalizarChegadas(bruto: unknown): DadosChegadas {
  const b = (bruto ?? {}) as Record<string, unknown>
  return {
    competencia: String(b.competencia ?? ''),
    hoje: String(b.hoje ?? ''),
    remanejamentos: ((b.remanejamentos as Record<string, unknown>[]) ?? []).map((r) => ({
      ...(r as unknown as RemanejamentoChegada),
      rota: numOuNulo(r.rota) as RotaMaterial | null,
      qtd_remanejada: Number(r.qtd_remanejada ?? 0),
      qtd_entregue_remanejada: numOuNulo(r.qtd_entregue_remanejada),
      compras: ((r.compras as string[]) ?? []).map(String),
    })),
    pedidos: ((b.pedidos as Record<string, unknown>[]) ?? []).map((p) => ({
      ...(p as unknown as PedidoChegada),
      implantacao: p.implantacao === true,
    })),
  }
}

export const edicaoInicialRemanejamento = (r: RemanejamentoChegada): EdicaoChegada => ({
  qtd: String(r.qtd_entregue_remanejada ?? r.qtd_remanejada),
  motivo: r.qtd_entregue_remanejada != null && r.qtd_entregue_remanejada < r.qtd_remanejada ? (r.motivo_entrega ?? '') : '',
})

export function erroRemanejamento(r: RemanejamentoChegada, e: EdicaoChegada): string | null {
  const q = numero(e.qtd)
  if (q == null || q < 0) return 'Quantidade inválida.'
  if (q > r.qtd_remanejada) return `Maior que o remanejado (${r.qtd_remanejada}).`
  if (q < r.qtd_remanejada && !e.motivo.trim()) return 'Levou menos: informe o motivo (vai para a carta ao líder).'
  return null
}

export interface PayloadRemanejamento {
  id: string
  qtd: number
  motivo: string | null
}

export function montarPayloadRemanejamento(
  linhas: RemanejamentoChegada[],
  edicoes: Record<string, EdicaoChegada>
): { payload: PayloadRemanejamento[]; erros: { id: string; erro: string }[] } {
  const payload: PayloadRemanejamento[] = []
  const erros: { id: string; erro: string }[] = []
  for (const r of linhas) {
    const e = edicoes[r.linha_id] ?? edicaoInicialRemanejamento(r)
    const erro = erroRemanejamento(r, e)
    if (erro) {
      erros.push({ id: r.linha_id, erro })
      continue
    }
    const q = numero(e.qtd) as number
    payload.push({ id: r.linha_id, qtd: q, motivo: q < r.qtd_remanejada ? e.motivo.trim() : null })
  }
  return { payload, erros }
}

/** Descrição do item do remanejamento (mesmo nome da compra/Excel). */
export const descricaoRemanejamento = (r: Pick<RemanejamentoChegada, 'item_nome' | 'variacao_rotulo'>) =>
  descricaoItemCompra(r.item_nome, r.variacao_rotulo)

/** Remanejamentos de uma compra (mesma geração ou célula) — visão interna do detalhe da compra. */
export const remanejamentosDaCompra = (linhas: RemanejamentoChegada[], compraId: string) =>
  linhas.filter((r) => r.compras.includes(compraId))
