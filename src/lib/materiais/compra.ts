import type { RotaMaterial } from '@/types/materiais'
import { arredondarMultiplo, fatorValido, textoEmbalagem } from './multiploCompra'

// Preparar a compra do mês (Fase 2 — docs/PLANO_MATERIAIS_FASE2.md §3.3/§5).
// Lógica pura: a prévia vem agregada do servidor (RPC mat_previa_compra) e
// aqui se calcula a sugestão (estoque primeiro, o resto ao fornecedor padrão do
// item), se valida o que o comprador ajustou e se monta o payload da RPC
// mat_gerar_compras. NADA é gerado sozinho: quem gera e envia é o comprador
// (gestor ou mesa), clicando — sem job/cron.

/** Uma linha aprovada e ainda sem destino (formato da RPC mat_previa_compra). */
export interface LinhaPrevia {
  linha_id: string
  pedido_id: string
  pedido_tipo: 'mensal' | 'extra'
  /** Migration 151: pedido de implantação de contrato (selo; compra normal). */
  implantacao?: boolean
  competencia: string
  status_pedido: string
  contrato_id: string
  contrato_nome: string
  rota: RotaMaterial | null
  parte: 'kit' | 'extra' | null
  item_id: string | null
  variacao_id: string | null
  descricao_livre: string | null
  item_nome: string | null
  variacao_rotulo: string | null
  unidade: string | null
  categoria: string | null
  ordem: number | null
  preparo_escritorio: boolean
  /** Migration 152: múltiplo de compra (padrão 1 = como antes). */
  fator_compra?: number
  unidade_compra?: string | null
  /** Migration 152: o fornecedor entrega no escritório e a mesa separa (a linha sai do estoque). */
  fracionado_escritorio?: boolean
  qtd_aprovada: number
  preco_pedido: number | null
  preco_vigente: number | null
  fornecedor_padrao_id: string | null
  fornecedor_padrao_nome: string | null
  saldo_estoque: number | null
  created_at: string
}

export interface PendenciaPrevia {
  pedido_id: string
  contrato_id: string
  contrato_nome: string
  status_pedido: string
  linhas_pendentes: number
}

export interface ItemEscritorioPrevia {
  item_id: string
  item_nome: string
  unidade: string | null
  total_aprovado: number
  total_pendente: number
  separado: number
  contratos: number
}

/** Contrato ativo (seletor "remanejado de qual posto" — migration 151). */
export interface ContratoPrevia {
  id: string
  nome: string
  rota: number | null
}

export interface PreviaCompra {
  competencia: string
  hoje: string
  linhas: LinhaPrevia[]
  contratos: ContratoPrevia[]
  pendentes: PendenciaPrevia[]
  escritorio: ItemEscritorioPrevia[]
  contratos_sem_rota: number
  ultima_contagem: string | null
  dia_inicio_compra: number
  dia_fim_compra: number
  dia_limite_aprovacao: number
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const numOuNulo = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

/** Normaliza o JSON da RPC (numeric chega como texto/número). */
export function normalizarPrevia(bruto: unknown): PreviaCompra {
  const b = (bruto ?? {}) as Record<string, unknown>
  const linhas = ((b.linhas as Record<string, unknown>[]) ?? []).map((l) => ({
    ...(l as unknown as LinhaPrevia),
    rota: (numOuNulo(l.rota) as RotaMaterial | null) ?? null,
    ordem: numOuNulo(l.ordem),
    preparo_escritorio: l.preparo_escritorio === true,
    fator_compra: fatorValido(l.fator_compra ?? 1),
    unidade_compra: typeof l.unidade_compra === 'string' && l.unidade_compra.trim() ? l.unidade_compra.trim() : null,
    fracionado_escritorio: l.fracionado_escritorio === true,
    implantacao: l.implantacao === true,
    qtd_aprovada: num(l.qtd_aprovada),
    preco_pedido: numOuNulo(l.preco_pedido),
    preco_vigente: numOuNulo(l.preco_vigente),
    saldo_estoque: numOuNulo(l.saldo_estoque),
  }))
  return {
    competencia: String(b.competencia ?? ''),
    hoje: String(b.hoje ?? ''),
    linhas,
    contratos: ((b.contratos as ContratoPrevia[]) ?? []).map((c) => ({ id: String(c.id), nome: String(c.nome ?? ''), rota: numOuNulo(c.rota) })),
    pendentes: ((b.pendentes as PendenciaPrevia[]) ?? []).map((p) => ({ ...p, linhas_pendentes: num(p.linhas_pendentes) })),
    escritorio: ((b.escritorio as ItemEscritorioPrevia[]) ?? []).map((e) => ({
      ...e,
      total_aprovado: num(e.total_aprovado),
      total_pendente: num(e.total_pendente),
      separado: num(e.separado),
      contratos: num(e.contratos),
    })),
    contratos_sem_rota: num(b.contratos_sem_rota),
    ultima_contagem: (b.ultima_contagem as string | null) ?? null,
    dia_inicio_compra: num(b.dia_inicio_compra) || 20,
    dia_fim_compra: num(b.dia_fim_compra) || 25,
    dia_limite_aprovacao: num(b.dia_limite_aprovacao) || 20,
  }
}

/** Nome do item na compra/Excel: "Flanela Microfibra amarela", "Disco preto 350 mm UN". */
export function descricaoItemCompra(nome: string | null | undefined, rotulo?: string | null): string {
  const base = (nome ?? '').trim() || 'Item'
  const r = (rotulo ?? '').trim()
  if (!r) return base
  // Unidade no fim do nome ("Disco preto UN"): a variação entra antes dela.
  const m = base.match(/^(.*\S)\s+(UN|PCT|CX|FD|GL|RL|PC|KG|LT|L|PAR|KIT)$/i)
  if (m) return `${m[1]} ${r} ${m[2]}`
  return `${base} ${r}`
}

export const chaveItemCompra = (itemId: string | null, variacaoId: string | null) => `${itemId ?? ''}|${variacaoId ?? ''}`

/** Linha "do mês anterior" (sobrou de competência passada sem destino). */
export const doMesAnterior = (l: Pick<LinhaPrevia, 'competencia'>, competencia: string) => l.competencia < competencia

/** Destino escolhido para uma linha (o que vai para a RPC). */
export interface DestinoLinha {
  qtdEstoque: number
  qtdCompra: number
  fornecedorId: string | null
  naoAtender: boolean
  motivo: string
  /**
   * Migration 151 (decisão da gestora, 19/10/2026): parte levada de OUTRO
   * posto — não é comprada nem sai do estoque central. Nunca sugerida: só
   * quando o comprador escolhe.
   */
  qtdRemanejada?: number
  remanejadoDe?: string | null
  obsRemanejamento?: string
}

export type TipoDestino =
  | 'fornecedor'
  | 'estoque'
  | 'remanejado'
  | 'dividida'
  | 'escritorio'
  | 'nao_atendido'
  | 'texto_livre'

const rem = (d: DestinoLinha | undefined) => d?.qtdRemanejada ?? 0

/** Soma do que a linha vai receber (estoque + fornecedor + remanejado). */
export const totalDestino = (d: DestinoLinha | undefined) => (d ? d.qtdEstoque + d.qtdCompra + rem(d) : 0)

export function tipoDestino(l: Pick<LinhaPrevia, 'item_id' | 'preparo_escritorio'>, d: DestinoLinha | undefined): TipoDestino {
  if (d?.naoAtender) return 'nao_atendido'
  if (!l.item_id) return 'texto_livre'
  if (l.preparo_escritorio) return 'escritorio'
  if (!d) return 'fornecedor'
  if (totalDestino(d) === 0) return 'nao_atendido'
  const partes = [d.qtdEstoque > 0, d.qtdCompra > 0, rem(d) > 0].filter(Boolean).length
  if (partes > 1) return 'dividida'
  if (rem(d) > 0) return 'remanejado'
  return d.qtdEstoque > 0 ? 'estoque' : 'fornecedor'
}

/** Ordem de consumo do saldo dentro de um item: kit antes do extra, depois rota, contrato e data. */
function ordemConsumo(a: LinhaPrevia, b: LinhaPrevia): number {
  const pa = a.parte === 'kit' ? 0 : 1
  const pb = b.parte === 'kit' ? 0 : 1
  if (pa !== pb) return pa - pb
  const ra = a.rota ?? 9
  const rb = b.rota ?? 9
  if (ra !== rb) return ra - rb
  const c = a.contrato_nome.localeCompare(b.contrato_nome, 'pt-BR')
  if (c !== 0) return c
  return a.created_at.localeCompare(b.created_at)
}

/**
 * Sugestão inicial: usa o ESTOQUE primeiro (até o saldo positivo do item +
 * variação), o resto vai ao fornecedor padrão do item. Itens do escritório e
 * texto livre não recebem quantidade (o tipo de destino é implícito).
 */
export function sugerirDestinos(linhas: LinhaPrevia[]): Record<string, DestinoLinha> {
  const porItem = new Map<string, LinhaPrevia[]>()
  for (const l of linhas) {
    if (!l.item_id || l.preparo_escritorio) continue
    const k = chaveItemCompra(l.item_id, l.variacao_id)
    porItem.set(k, [...(porItem.get(k) ?? []), l])
  }
  const out: Record<string, DestinoLinha> = {}
  for (const grupo of porItem.values()) {
    let saldo = Math.max(0, grupo[0].saldo_estoque ?? 0)
    for (const l of [...grupo].sort(ordemConsumo)) {
      const doEstoque = Math.min(saldo, l.qtd_aprovada)
      saldo -= doEstoque
      out[l.linha_id] = {
        qtdEstoque: doEstoque,
        qtdCompra: l.qtd_aprovada - doEstoque,
        fornecedorId: l.fornecedor_padrao_id,
        naoAtender: false,
        motivo: '',
      }
    }
  }
  return out
}

/** Primeiro problema da linha, ou null. Espelha as travas da RPC mat_gerar_compras. */
export function erroDestino(l: LinhaPrevia, d: DestinoLinha | undefined): string | null {
  const t = tipoDestino(l, d)
  const motivo = d?.motivo.trim() ?? ''
  if (t === 'texto_livre') return 'Texto livre: ligue ao catálogo no pedido ou marque "Não atender".'
  if (t === 'nao_atendido') return motivo ? null : 'Informe o motivo de não atender.'
  if (t === 'escritorio' || !d) return null
  if (d.qtdEstoque < 0 || d.qtdCompra < 0 || rem(d) < 0) return 'Quantidade negativa.'
  const soma = totalDestino(d)
  if (soma > l.qtd_aprovada) return `Passa do aprovado (${l.qtd_aprovada}).`
  if (soma < l.qtd_aprovada && !motivo) return 'Atendendo menos que o aprovado: informe o motivo.'
  if (d.qtdCompra > 0 && !d.fornecedorId) return 'Escolha o fornecedor.'
  if (rem(d) > 0 && !d.remanejadoDe) return 'Remanejado: escolha de qual posto vem.'
  if (rem(d) > 0 && d.remanejadoDe === l.contrato_id) return 'Remanejado: o posto de origem não pode ser o próprio posto.'
  return null
}

export interface PayloadLinhaCompra {
  id: string
  qtd_estoque?: number
  qtd_compra?: number
  fornecedor_id?: string | null
  nao_atender?: boolean
  motivo?: string | null
  qtd_remanejada?: number
  remanejado_de_contrato_id?: string | null
  remanejamento_obs?: string | null
}

/**
 * Payload de mat_gerar_compras para as linhas escolhidas. Devolve os erros
 * (linha a linha) em vez de mandar algo que o banco recusaria.
 */
export function montarPayloadCompra(
  linhas: LinhaPrevia[],
  destinos: Record<string, DestinoLinha>,
  selecionadas?: Set<string>
): { payload: PayloadLinhaCompra[]; erros: { linhaId: string; erro: string }[] } {
  const payload: PayloadLinhaCompra[] = []
  const erros: { linhaId: string; erro: string }[] = []
  for (const l of linhas) {
    if (selecionadas && !selecionadas.has(l.linha_id)) continue
    const d = destinos[l.linha_id]
    const erro = erroDestino(l, d)
    if (erro) {
      erros.push({ linhaId: l.linha_id, erro })
      continue
    }
    const t = tipoDestino(l, d)
    const motivo = d?.motivo.trim() || null
    if (t === 'nao_atendido') payload.push({ id: l.linha_id, nao_atender: true, motivo })
    else if (t === 'escritorio') payload.push({ id: l.linha_id })
    else
      payload.push({
        id: l.linha_id,
        qtd_estoque: d?.qtdEstoque ?? 0,
        qtd_compra: d?.qtdCompra ?? 0,
        fornecedor_id: (d?.qtdCompra ?? 0) > 0 ? d?.fornecedorId ?? null : null,
        motivo,
        ...(rem(d) > 0
          ? {
              qtd_remanejada: rem(d),
              remanejado_de_contrato_id: d?.remanejadoDe ?? null,
              remanejamento_obs: d?.obsRemanejamento?.trim() || null,
            }
          : {}),
      })
  }
  return { payload, erros }
}

/** Uma linha da tabela "Preparar a compra": o item somado, com as linhas por contrato. */
export interface GrupoItemCompra {
  chave: string
  itemId: string | null
  variacaoId: string | null
  descricao: string
  unidade: string | null
  preparoEscritorio: boolean
  textoLivre: boolean
  saldo: number | null
  fornecedorPadraoId: string | null
  fornecedorPadraoNome: string | null
  precoVigente: number | null
  totalAprovado: number
  totalEstoque: number
  totalCompra: number
  /** Migration 151: levado de outro posto. */
  totalRemanejado: number
  /** Migration 152: múltiplo de compra e fracionamento no escritório. */
  fatorCompra: number
  unidadeCompra: string | null
  fracionado: boolean
  linhas: LinhaPrevia[]
}

export function agruparPorItem(linhas: LinhaPrevia[], destinos: Record<string, DestinoLinha>): GrupoItemCompra[] {
  const grupos = new Map<string, GrupoItemCompra>()
  for (const l of linhas) {
    const chave = l.item_id ? chaveItemCompra(l.item_id, l.variacao_id) : `livre|${l.linha_id}`
    let g = grupos.get(chave)
    if (!g) {
      g = {
        chave,
        itemId: l.item_id,
        variacaoId: l.variacao_id,
        descricao: l.item_id ? descricaoItemCompra(l.item_nome, l.variacao_rotulo) : `“${l.descricao_livre ?? 'texto livre'}”`,
        unidade: l.unidade,
        preparoEscritorio: l.preparo_escritorio,
        textoLivre: !l.item_id,
        saldo: l.saldo_estoque,
        fornecedorPadraoId: l.fornecedor_padrao_id,
        fornecedorPadraoNome: l.fornecedor_padrao_nome,
        precoVigente: l.preco_vigente,
        totalAprovado: 0,
        totalEstoque: 0,
        totalCompra: 0,
        totalRemanejado: 0,
        fatorCompra: fatorValido(l.fator_compra ?? 1),
        unidadeCompra: l.unidade_compra ?? null,
        fracionado: l.fracionado_escritorio === true,
        linhas: [],
      }
      grupos.set(chave, g)
    }
    g.linhas.push(l)
    g.totalAprovado += l.qtd_aprovada
    const d = destinos[l.linha_id]
    const t = tipoDestino(l, d)
    if (t === 'escritorio') continue
    if (d && t !== 'nao_atendido') {
      g.totalEstoque += d.qtdEstoque
      g.totalCompra += d.qtdCompra
      g.totalRemanejado += rem(d)
    }
  }
  const lista = [...grupos.values()]
  for (const g of lista) g.linhas.sort(ordemConsumo)
  return lista.sort((a, b) => Number(a.textoLivre) - Number(b.textoLivre) || a.descricao.localeCompare(b.descricao, 'pt-BR'))
}

/**
 * "Comprar a mais para o estoque" (migration 152): uma entrada por item + variação,
 * na compra do fornecedor escolhido. Vai como célula de reposição (sem contrato).
 */
export interface PayloadReposicao {
  item_id: string
  variacao_id: string | null
  fornecedor_id: string | null
  quantidade: number
}

/**
 * Payload de p_reposicao a partir do que o comprador digitou por item (chave do
 * grupo → quantidade). Ignora grupos fora desta geração, texto livre e itens do
 * escritório; o fornecedor é o do item nesta compra (ou o padrão).
 */
export function montarPayloadReposicao(
  grupos: GrupoItemCompra[],
  aMais: Record<string, number>,
  fornecedorDoGrupo: (g: GrupoItemCompra) => string | null,
  fora?: Set<string>
): { payload: PayloadReposicao[]; erros: { chave: string; erro: string }[] } {
  const payload: PayloadReposicao[] = []
  const erros: { chave: string; erro: string }[] = []
  for (const g of grupos) {
    const q = aMais[g.chave] ?? 0
    if (!(q > 0) || fora?.has(g.chave) || g.textoLivre || g.preparoEscritorio || !g.itemId) continue
    const forn = fornecedorDoGrupo(g) ?? g.fornecedorPadraoId
    if (!forn) {
      erros.push({ chave: g.chave, erro: 'A mais para o estoque: escolha o fornecedor do item.' })
      continue
    }
    payload.push({ item_id: g.itemId, variacao_id: g.variacaoId, fornecedor_id: forn, quantidade: q })
  }
  return { payload, erros }
}

/**
 * O que o item vai pedir ao fornecedor nesta geração (prévia; quem grava é o
 * banco): pedido dos postos + a mais para o estoque, arredondado ao múltiplo.
 */
export function compraDoGrupo(
  g: Pick<GrupoItemCompra, 'totalCompra' | 'fatorCompra' | 'unidadeCompra'>,
  aMais = 0
): { postos: number; aMais: number; total: number; sobra: number; embalagem: string | null } {
  const extra = aMais > 0 ? aMais : 0
  const a = arredondarMultiplo(g.totalCompra + extra, g.fatorCompra)
  return {
    postos: g.totalCompra,
    aMais: extra,
    total: a.total,
    sobra: a.sobra,
    embalagem: textoEmbalagem(a.total, g.fatorCompra, g.unidadeCompra),
  }
}

/**
 * Resumo do que vai a cada fornecedor (prévia da confirmação). Com o múltiplo de
 * compra (152): soma o a mais para o estoque e arredonda cada item ao múltiplo,
 * como o banco fará; `sobra` = o que passa do pedido e vai para o estoque.
 */
export function resumoPorFornecedor(
  linhas: LinhaPrevia[],
  destinos: Record<string, DestinoLinha>,
  selecionadas?: Set<string>,
  reposicao: PayloadReposicao[] = []
): { fornecedorId: string; itens: number; quantidade: number; valor: number; semPreco: number; sobra: number }[] {
  // fornecedor → item → { quantidade, fator, preço }
  const m = new Map<string, Map<string, { q: number; fator: number; preco: number | null }>>()
  const infoItem = new Map<string, { fator: number; preco: number | null }>()
  for (const l of linhas)
    if (l.item_id) infoItem.set(chaveItemCompra(l.item_id, l.variacao_id), { fator: fatorValido(l.fator_compra ?? 1), preco: l.preco_vigente })
  const somar = (forn: string, chave: string, q: number) => {
    const porItem = m.get(forn) ?? new Map<string, { q: number; fator: number; preco: number | null }>()
    const info = infoItem.get(chave) ?? { fator: 1, preco: null }
    const r = porItem.get(chave) ?? { q: 0, fator: info.fator, preco: info.preco }
    r.q += q
    porItem.set(chave, r)
    m.set(forn, porItem)
  }
  for (const l of linhas) {
    if (selecionadas && !selecionadas.has(l.linha_id)) continue
    const d = destinos[l.linha_id]
    if (!d || !d.fornecedorId || d.qtdCompra <= 0 || d.naoAtender || !l.item_id || l.preparo_escritorio) continue
    somar(d.fornecedorId, chaveItemCompra(l.item_id, l.variacao_id), d.qtdCompra)
  }
  for (const r of reposicao) if (r.fornecedor_id && r.quantidade > 0) somar(r.fornecedor_id, chaveItemCompra(r.item_id, r.variacao_id), r.quantidade)
  return [...m.entries()].map(([fornecedorId, porItem]) => {
    let quantidade = 0
    let valor = 0
    let semPreco = 0
    let sobra = 0
    for (const it of porItem.values()) {
      const a = arredondarMultiplo(it.q, it.fator)
      quantidade += a.total
      sobra += a.sobra
      if (it.preco == null) semPreco++
      else valor += a.total * it.preco
    }
    return {
      fornecedorId,
      itens: porItem.size,
      quantidade: Math.round(quantidade * 100) / 100,
      valor: Math.round(valor * 100) / 100,
      semPreco,
      sobra: Math.round(sobra * 100) / 100,
    }
  })
}

/**
 * Aviso (NUNCA trava — decisão da gestora: "pode haver exceções") quando a
 * compra é gerada antes do dia de início ou no último dia de aprovação do gestor.
 */
export function avisoJanelaCompra(
  hoje: string,
  competencia: string,
  diaInicio: number,
  diaLimiteAprovacao: number,
  extrasPendentes: number
): string | null {
  if (!hoje || hoje.slice(0, 7) !== competencia.slice(0, 7)) return null
  const dia = Number(hoje.slice(8, 10))
  const pend = extrasPendentes > 0 ? ` ${extrasPendentes} pedido(s) do mês ainda têm extras aguardando inspetor/gestor e ficarão de fora.` : ''
  if (dia < diaInicio) return `Ainda não é o dia da compra (começa no dia ${diaInicio}).${pend}`
  if (dia === diaLimiteAprovacao && extrasPendentes > 0)
    return `Hoje o gestor ainda pode aprovar. O que for aprovado depois de gerar a compra fica para o mês seguinte ou para uma compra avulsa.${pend}`
  return null
}

/** Dias desde a última contagem fechada (null = nunca contou). */
export function diasDesdeContagem(ultima: string | null, hoje: string): number | null {
  if (!ultima || !hoje) return null
  const a = Date.UTC(Number(ultima.slice(0, 4)), Number(ultima.slice(5, 7)) - 1, Number(ultima.slice(8, 10)))
  const b = Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)) - 1, Number(hoje.slice(8, 10)))
  return Math.round((b - a) / 86400000)
}
