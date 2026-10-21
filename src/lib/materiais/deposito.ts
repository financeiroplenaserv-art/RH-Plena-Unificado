import type { MatCompra, MatCompraItem, RotaMaterial } from '@/types/materiais'
import { descricaoItemCompra } from './compra'
import { ordemRota, ROTA_DEPOSITO_PLENA, textoRota } from './pedidos'

// Fornecedor que entrega no DEPÓSITO da Plena (migration 154, decisão da gestora de
// 21/10/2026). Essex/RZK e Compra Avulsa entregam tudo no depósito; os inspetores
// separam por contrato (aba SEPARAÇÃO OPER da planilha) e a Antolimp leva junto na
// rota dela. Contratos com rota 0 ("Depósito Plena") não recebem em rota — a Plena leva.
//
// Lógica pura: o que é "depósito", a chegada por TOTAL do item, a lista de separação
// por posto e o que a Antolimp pega no depósito. A tela e o Excel só desenham isto.
//
// DECISÃO A CONFIRMAR: a linha conta como ENTREGUE ao posto quando o inspetor a marca
// como separada (a Plena não tem como confirmar a ida da Antolimp na rota nem a
// própria entrega aos contratos de "Depósito Plena").

const numero = (v: string): number | null => {
  const t = v.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const numOuNulo = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

/**
 * A compra entrega no depósito? Compra enviada vale pelo snapshot da própria compra
 * (congelado no envio); rascunho vale pelo cadastro atual do fornecedor.
 */
export function compraEntregaNoDeposito(
  compra: Pick<MatCompra, 'status' | 'entrega_deposito'> | null | undefined,
  fornecedor: { entrega_deposito?: boolean } | null | undefined
): boolean {
  if (!compra) return false
  if (compra.status === 'rascunho') return fornecedor?.entrega_deposito === true || compra.entrega_deposito === true
  return compra.entrega_deposito === true
}

// ---------------------------------------------------------------- chegada por total

export interface ItemChegadaDeposito {
  chave: string
  descricao: string
  unidade: string | null
  /** Células (posto e reposição) da mesma linha do Excel do fornecedor. */
  celulas: MatCompraItem[]
  comprado: number
  /** Soma do já registrado; null enquanto nenhuma célula teve a chegada registrada. */
  recebido: number | null
  registrado: boolean
}

const chaveItem = (c: Pick<MatCompraItem, 'item_id' | 'variacao_id'>) => `${c.item_id}|${c.variacao_id ?? ''}`

/** Ordem de preenchimento: postos por rota e nome, reposição do estoque por último. */
function ordemPreenchimento(a: MatCompraItem, b: MatCompraItem): number {
  const ea = a.contrato_id == null ? 1 : 0
  const eb = b.contrato_id == null ? 1 : 0
  if (ea !== eb) return ea - eb
  return ordemRota(a.rota) - ordemRota(b.rota) || (a.contrato_nome ?? '').localeCompare(b.contrato_nome ?? '', 'pt-BR')
}

/** Células da compra de depósito agrupadas por item (a mesa informa o TOTAL que chegou). */
export function agruparChegadaPorItem(celulas: MatCompraItem[]): ItemChegadaDeposito[] {
  const m = new Map<string, ItemChegadaDeposito>()
  for (const c of celulas) {
    const k = chaveItem(c)
    let it = m.get(k)
    if (!it) {
      it = { chave: k, descricao: descricaoItemCompra(c.item_nome, c.variacao_rotulo), unidade: c.unidade, celulas: [], comprado: 0, recebido: null, registrado: true }
      m.set(k, it)
    }
    it.celulas.push(c)
    it.comprado += Number(c.quantidade)
    if (c.qtd_recebida != null) it.recebido = (it.recebido ?? 0) + Number(c.qtd_recebida)
    else it.registrado = false
  }
  const lista = [...m.values()]
  for (const it of lista) it.celulas.sort(ordemPreenchimento)
  return lista.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
}

export interface EdicaoDeposito {
  qtd: string
  motivo: string
}

export const edicaoInicialItemDeposito = (it: ItemChegadaDeposito): EdicaoDeposito => ({
  qtd: String(it.recebido ?? it.comprado),
  motivo: it.celulas.find((c) => c.motivo_recebimento)?.motivo_recebimento ?? '',
})

/** Primeiro problema do total informado para o item, ou null. */
export function erroChegadaItemDeposito(it: ItemChegadaDeposito, e: EdicaoDeposito): string | null {
  const q = numero(e.qtd)
  if (q == null || q < 0) return 'Quantidade inválida.'
  if (q > it.comprado) return `Maior que o comprado (${it.comprado}). Chegou a mais? Registre o comprado e avise o comprador.`
  const reposicao = it.celulas.find((c) => c.contrato_id == null)
  if (reposicao?.qtd_recebida != null) {
    // Reposição só aumenta (mesma trava da RPC): o total não pode ficar abaixo do que já entrou no estoque.
    const minimo = reposicao.qtd_recebida
    if (q < minimo) return `Já entraram ${minimo} no estoque; o total não pode ser menor.`
  }
  if (q < it.comprado && !e.motivo.trim()) return 'Chegou menos: informe o motivo (vai para a carta ao líder).'
  return null
}

export interface PayloadChegadaDeposito {
  id: string
  qtd_recebida: number
  motivo: string | null
}

/**
 * Divide o TOTAL que chegou no depósito entre as células do item, na ordem de
 * preenchimento (postos por rota, estoque por último): a falta recai nas últimas células.
 * Cada célula que fica abaixo do comprado leva o motivo (a RPC exige).
 */
export function distribuirTotalNasCelulas(celulas: MatCompraItem[], total: number, motivo: string | null): PayloadChegadaDeposito[] {
  const ordenadas = [...celulas].sort(ordemPreenchimento)
  let resto = total
  return ordenadas.map((c) => {
    const q = Math.max(0, Math.min(resto, Number(c.quantidade)))
    resto -= q
    return { id: c.id, qtd_recebida: q, motivo: q < Number(c.quantidade) ? motivo : null }
  })
}

/** O item está pendente (sem registro) ou o total digitado difere do gravado. */
export function itemDepositoPendente(it: ItemChegadaDeposito, e: EdicaoDeposito | undefined): boolean {
  if (!it.registrado) return true
  if (!e) return false
  return numero(e.qtd) !== it.recebido
}

/** Payload de mat_registrar_chegada para os itens pendentes (ou todos com o comprado, em "Chegou tudo"). */
export function montarPayloadChegadaDeposito(
  itens: ItemChegadaDeposito[],
  edicoes: Record<string, EdicaoDeposito>,
  chegouTudo = false
): { payload: PayloadChegadaDeposito[]; erros: { chave: string; erro: string }[] } {
  const payload: PayloadChegadaDeposito[] = []
  const erros: { chave: string; erro: string }[] = []
  for (const it of itens) {
    if (chegouTudo) {
      if (it.registrado && it.recebido === it.comprado) continue
      payload.push(...distribuirTotalNasCelulas(it.celulas, it.comprado, null))
      continue
    }
    if (!itemDepositoPendente(it, edicoes[it.chave])) continue
    const e = edicoes[it.chave] ?? edicaoInicialItemDeposito(it)
    const erro = erroChegadaItemDeposito(it, e)
    if (erro) {
      erros.push({ chave: it.chave, erro })
      continue
    }
    payload.push(...distribuirTotalNasCelulas(it.celulas, numero(e.qtd) as number, e.motivo.trim() || null))
  }
  return { payload, erros }
}

// ---------------------------------------------------------------- separação no depósito

/** Linha da lista de separação (formato da RPC mat_separacao_deposito). */
export interface LinhaSeparacao {
  linha_id: string
  pedido_id: string
  competencia: string
  contrato_id: string
  contrato_nome: string
  rota: RotaMaterial | null
  parte: string | null
  item_id: string | null
  variacao_id: string | null
  item_nome: string | null
  variacao_rotulo: string | null
  unidade: string | null
  /** O que foi comprado para este posto. */
  qtd_compra: number
  /** O que chegou no depósito para este posto (null = ainda não chegou). */
  qtd_recebida: number | null
  qtd_separada: number | null
  separado_em: string | null
  motivo_entrega: string | null
  status_pedido: string
  compra_id: string
  compra_numero: string
  compra_status: string
  competencia_compra: string
  fornecedor_nome: string | null
}

export interface DadosSeparacao {
  competencia: string
  hoje: string
  linhas: LinhaSeparacao[]
}

export function normalizarSeparacao(bruto: unknown): DadosSeparacao {
  const b = (bruto ?? {}) as Record<string, unknown>
  return {
    competencia: String(b.competencia ?? ''),
    hoje: String(b.hoje ?? ''),
    linhas: ((b.linhas as Record<string, unknown>[]) ?? []).map((r) => ({
      ...(r as unknown as LinhaSeparacao),
      rota: numOuNulo(r.rota) as RotaMaterial | null,
      qtd_compra: Number(r.qtd_compra ?? 0),
      qtd_recebida: numOuNulo(r.qtd_recebida),
      qtd_separada: numOuNulo(r.qtd_separada),
    })),
  }
}

export const descricaoSeparacao = (l: Pick<LinhaSeparacao, 'item_nome' | 'variacao_rotulo'>) => descricaoItemCompra(l.item_nome, l.variacao_rotulo)

export type SituacaoSeparacao = 'aguardando' | 'a_separar' | 'separada'

/** aguardando = ainda não chegou no depósito; a_separar = chegou e falta separar; separada = feita (ou nada chegou). */
export function situacaoSeparacao(l: Pick<LinhaSeparacao, 'qtd_recebida' | 'qtd_separada'>): SituacaoSeparacao {
  if (l.qtd_separada != null) return 'separada'
  if (l.qtd_recebida == null) return 'aguardando'
  return l.qtd_recebida === 0 ? 'separada' : 'a_separar'
}

export interface GrupoSeparacao {
  contratoId: string
  contratoNome: string
  rota: RotaMaterial | null
  linhas: LinhaSeparacao[]
  aSeparar: number
  aguardando: number
  concluido: boolean
}

/** Lista por posto, agrupada por rota (1 a 4, Depósito Plena, sem rota) e nome. */
export function agruparSeparacaoPorContrato(linhas: LinhaSeparacao[]): GrupoSeparacao[] {
  const m = new Map<string, GrupoSeparacao>()
  for (const l of linhas) {
    let g = m.get(l.contrato_id)
    if (!g) {
      g = { contratoId: l.contrato_id, contratoNome: l.contrato_nome, rota: l.rota, linhas: [], aSeparar: 0, aguardando: 0, concluido: true }
      m.set(l.contrato_id, g)
    }
    g.linhas.push(l)
    const s = situacaoSeparacao(l)
    if (s === 'a_separar') g.aSeparar++
    if (s === 'aguardando') g.aguardando++
    if (s !== 'separada') g.concluido = false
  }
  const lista = [...m.values()]
  for (const g of lista) g.linhas.sort((a, b) => descricaoSeparacao(a).localeCompare(descricaoSeparacao(b), 'pt-BR'))
  return lista.sort((a, b) => ordemRota(a.rota) - ordemRota(b.rota) || a.contratoNome.localeCompare(b.contratoNome, 'pt-BR'))
}

export const edicaoInicialSeparacao = (l: LinhaSeparacao): EdicaoDeposito => ({
  qtd: String(l.qtd_separada ?? l.qtd_recebida ?? ''),
  motivo: l.qtd_separada != null && l.qtd_recebida != null && l.qtd_separada < l.qtd_recebida ? (l.motivo_entrega ?? '') : '',
})

/** Primeiro problema da separação da linha, ou null. Espelha as travas de mat_registrar_separacao_deposito. */
export function erroSeparacao(l: LinhaSeparacao, e: EdicaoDeposito): string | null {
  if (l.qtd_recebida == null) return 'Ainda não chegou no depósito.'
  const q = numero(e.qtd)
  if (q == null || q < 0) return 'Quantidade inválida.'
  if (q > l.qtd_recebida) return `Maior que o que chegou para este posto (${l.qtd_recebida}).`
  if (q < l.qtd_recebida && !e.motivo.trim()) return 'Separou menos do que chegou: informe o motivo (vai para a carta ao líder).'
  return null
}

/** A linha pode ser separada agora (chegou) e ainda não foi, ou foi editada. */
export function linhaSeparavel(l: LinhaSeparacao, e: EdicaoDeposito | undefined): boolean {
  if (l.qtd_recebida == null || l.qtd_recebida === 0) return false
  if (l.qtd_separada == null) return true
  return !!e && numero(e.qtd) !== l.qtd_separada
}

export interface PayloadSeparacao {
  id: string
  qtd: number
  motivo: string | null
}

/** Payload da RPC. separarTudo = tudo o que chegou, sem motivo (botão "Separei tudo"). */
export function montarPayloadSeparacao(
  linhas: LinhaSeparacao[],
  edicoes: Record<string, EdicaoDeposito>,
  separarTudo = false
): { payload: PayloadSeparacao[]; erros: { id: string; erro: string }[] } {
  const payload: PayloadSeparacao[] = []
  const erros: { id: string; erro: string }[] = []
  for (const l of linhas) {
    if (separarTudo) {
      if (l.qtd_recebida == null || l.qtd_recebida === 0 || l.qtd_separada === l.qtd_recebida) continue
      payload.push({ id: l.linha_id, qtd: l.qtd_recebida, motivo: null })
      continue
    }
    if (!linhaSeparavel(l, edicoes[l.linha_id])) continue
    const e = edicoes[l.linha_id] ?? edicaoInicialSeparacao(l)
    const erro = erroSeparacao(l, e)
    if (erro) {
      erros.push({ id: l.linha_id, erro })
      continue
    }
    const q = numero(e.qtd) as number
    payload.push({ id: l.linha_id, qtd: q, motivo: l.qtd_recebida != null && q < l.qtd_recebida ? e.motivo.trim() : null })
  }
  return { payload, erros }
}

// ---------------------------------------------------------------- Excel

type Celula = string | number | null

export const TITULO_SEPARACAO = 'Plena Facilities — Separação no depósito'

/**
 * Lista de separação para imprimir: Rota | Posto | Item | Comprado | Chegou | Separado.
 * Soma linhas do mesmo item no mesmo posto (kit + extra). Cabeçalho de 5 linhas como as outras abas.
 */
export function aoaListaSeparacao(linhas: LinhaSeparacao[], competencia: string): Celula[][] {
  const topo: Celula[][] = [[TITULO_SEPARACAO], ['Mês', `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`], ['Origem', 'Fornecedores que entregam no depósito Plena'], [], []]
  const corpo: Celula[][] = [['Rota', 'Posto', 'Item', 'Comprado', 'Chegou', 'Separado']]
  const soma = new Map<string, { rota: RotaMaterial | null; posto: string; item: string; comprado: number; chegou: number | null; separado: number | null }>()
  for (const l of linhas) {
    const k = `${l.contrato_id}|${l.item_id ?? ''}|${l.variacao_id ?? ''}|${l.item_nome ?? ''}`
    const s = soma.get(k) ?? { rota: l.rota, posto: l.contrato_nome, item: descricaoSeparacao(l), comprado: 0, chegou: null, separado: null }
    s.comprado += l.qtd_compra
    if (l.qtd_recebida != null) s.chegou = (s.chegou ?? 0) + l.qtd_recebida
    if (l.qtd_separada != null) s.separado = (s.separado ?? 0) + l.qtd_separada
    soma.set(k, s)
  }
  const ordenado = [...soma.values()].sort(
    (a, b) => ordemRota(a.rota) - ordemRota(b.rota) || a.posto.localeCompare(b.posto, 'pt-BR') || a.item.localeCompare(b.item, 'pt-BR')
  )
  for (const s of ordenado) corpo.push([textoRota(s.rota), s.posto, s.item, s.comprado, s.chegou, s.separado])
  return [...topo, ...corpo]
}

// ---------------------------------------------------------------- Antolimp: levar do depósito

/** Célula por posto de uma compra de fornecedor de depósito (formato da RPC mat_levar_do_deposito). */
export interface LinhaLevarDoDeposito {
  celula_id: string
  compra_id: string
  compra_numero: string
  compra_status: string
  fornecedor_nome: string | null
  contrato_id: string
  contrato_nome: string
  rota: RotaMaterial | null
  item_id: string
  variacao_id: string | null
  item_nome: string
  variacao_rotulo: string | null
  unidade: string | null
  quantidade: number
  qtd_recebida: number | null
}

export function normalizarLevarDoDeposito(bruto: unknown): LinhaLevarDoDeposito[] {
  const b = (bruto ?? {}) as Record<string, unknown>
  return ((b.linhas as Record<string, unknown>[]) ?? []).map((r) => ({
    ...(r as unknown as LinhaLevarDoDeposito),
    rota: numOuNulo(r.rota) as RotaMaterial | null,
    quantidade: Number(r.quantidade ?? 0),
    qtd_recebida: numOuNulo(r.qtd_recebida),
  }))
}

/**
 * O que o fornecedor de rota (Antolimp) deve pegar no depósito e levar junto: só postos que
 * recebem em rota (os de "Depósito Plena" a própria Plena leva). Soma o mesmo item do mesmo
 * posto vindo de compras diferentes e mantém a origem para o motorista saber onde está.
 */
export function levarDoDeposito(linhas: LinhaLevarDoDeposito[]): {
  rota: RotaMaterial
  contrato: string
  item: string
  unidade: string | null
  quantidade: number
  origem: string
}[] {
  const soma = new Map<string, { rota: RotaMaterial; contrato: string; item: string; unidade: string | null; quantidade: number; origens: Set<string> }>()
  for (const l of linhas) {
    if (l.rota === ROTA_DEPOSITO_PLENA) continue
    const k = `${l.contrato_id}|${l.item_id}|${l.variacao_id ?? ''}`
    const s = soma.get(k) ?? {
      rota: l.rota as RotaMaterial,
      contrato: l.contrato_nome,
      item: descricaoItemCompra(l.item_nome, l.variacao_rotulo),
      unidade: l.unidade,
      quantidade: 0,
      origens: new Set<string>(),
    }
    s.quantidade += l.quantidade
    if (l.fornecedor_nome) s.origens.add(l.fornecedor_nome)
    soma.set(k, s)
  }
  return [...soma.values()]
    .sort((a, b) => ordemRota(a.rota) - ordemRota(b.rota) || a.contrato.localeCompare(b.contrato, 'pt-BR') || a.item.localeCompare(b.item, 'pt-BR'))
    .map(({ origens, ...r }) => ({ ...r, origem: [...origens].sort((x, y) => x.localeCompare(y, 'pt-BR')).join(' / ') }))
}

/** Postos "Depósito Plena" que recebem de fornecedor de depósito (a Plena leva): conferência na tela. */
export function postosDepositoPlena(linhas: LinhaLevarDoDeposito[]): string[] {
  return [...new Set(linhas.filter((l) => l.rota === ROTA_DEPOSITO_PLENA).map((l) => l.contrato_nome))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Aba "Levar do depósito" da compra da Antolimp: Rota | Posto | Item | Quantidade | Sai de. */
export function aoaLevarDoDeposito(
  levar: ReturnType<typeof levarDoDeposito>,
  cab: { fornecedor: string; competencia: string; numero: string },
  agrupar = true
): Celula[][] {
  const topo: Celula[][] = [
    ['Plena Facilities — Levar do depósito Plena'],
    ['Fornecedor', cab.fornecedor],
    ['Mês', `${cab.competencia.slice(5, 7)}/${cab.competencia.slice(0, 4)}`],
    ['Compra', cab.numero],
    [],
  ]
  const ordenado = agrupar ? levar : [...levar].sort((a, b) => a.contrato.localeCompare(b.contrato, 'pt-BR') || a.item.localeCompare(b.item, 'pt-BR'))
  const corpo: Celula[][] = [agrupar ? ['Rota', 'Posto', 'Item', 'Quantidade', 'Sai de'] : ['Posto', 'Item', 'Quantidade', 'Sai de']]
  for (const l of ordenado)
    corpo.push(agrupar ? [textoRota(l.rota), l.contrato, l.item, l.quantidade, l.origem] : [`${l.contrato} (${textoRota(l.rota)})`, l.item, l.quantidade, l.origem])
  return [...topo, ...corpo]
}
