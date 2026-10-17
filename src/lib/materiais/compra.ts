import type { RotaMaterial } from '@/types/materiais'

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

export interface PreviaCompra {
  competencia: string
  hoje: string
  linhas: LinhaPrevia[]
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
    qtd_aprovada: num(l.qtd_aprovada),
    preco_pedido: numOuNulo(l.preco_pedido),
    preco_vigente: numOuNulo(l.preco_vigente),
    saldo_estoque: numOuNulo(l.saldo_estoque),
  }))
  return {
    competencia: String(b.competencia ?? ''),
    hoje: String(b.hoje ?? ''),
    linhas,
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
}

export type TipoDestino = 'fornecedor' | 'estoque' | 'dividida' | 'escritorio' | 'nao_atendido' | 'texto_livre'

export function tipoDestino(l: Pick<LinhaPrevia, 'item_id' | 'preparo_escritorio'>, d: DestinoLinha | undefined): TipoDestino {
  if (d?.naoAtender) return 'nao_atendido'
  if (!l.item_id) return 'texto_livre'
  if (l.preparo_escritorio) return 'escritorio'
  if (!d) return 'fornecedor'
  if (d.qtdEstoque + d.qtdCompra === 0) return 'nao_atendido'
  if (d.qtdEstoque > 0 && d.qtdCompra > 0) return 'dividida'
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
  if (d.qtdEstoque < 0 || d.qtdCompra < 0) return 'Quantidade negativa.'
  const soma = d.qtdEstoque + d.qtdCompra
  if (soma > l.qtd_aprovada) return `Passa do aprovado (${l.qtd_aprovada}).`
  if (soma < l.qtd_aprovada && !motivo) return 'Atendendo menos que o aprovado: informe o motivo.'
  if (d.qtdCompra > 0 && !d.fornecedorId) return 'Escolha o fornecedor.'
  return null
}

export interface PayloadLinhaCompra {
  id: string
  qtd_estoque?: number
  qtd_compra?: number
  fornecedor_id?: string | null
  nao_atender?: boolean
  motivo?: string | null
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
    }
  }
  const lista = [...grupos.values()]
  for (const g of lista) g.linhas.sort(ordemConsumo)
  return lista.sort((a, b) => Number(a.textoLivre) - Number(b.textoLivre) || a.descricao.localeCompare(b.descricao, 'pt-BR'))
}

/** Resumo do que vai a cada fornecedor (prévia da confirmação). */
export function resumoPorFornecedor(
  linhas: LinhaPrevia[],
  destinos: Record<string, DestinoLinha>,
  selecionadas?: Set<string>
): { fornecedorId: string; itens: number; quantidade: number; valor: number; semPreco: number }[] {
  const m = new Map<string, { itens: Set<string>; quantidade: number; valor: number; semPreco: number }>()
  for (const l of linhas) {
    if (selecionadas && !selecionadas.has(l.linha_id)) continue
    const d = destinos[l.linha_id]
    if (!d || !d.fornecedorId || d.qtdCompra <= 0 || d.naoAtender || !l.item_id || l.preparo_escritorio) continue
    const r = m.get(d.fornecedorId) ?? { itens: new Set<string>(), quantidade: 0, valor: 0, semPreco: 0 }
    r.itens.add(chaveItemCompra(l.item_id, l.variacao_id))
    r.quantidade += d.qtdCompra
    if (l.preco_vigente == null) r.semPreco++
    else r.valor += d.qtdCompra * l.preco_vigente
    m.set(d.fornecedorId, r)
  }
  return [...m.entries()].map(([fornecedorId, r]) => ({
    fornecedorId,
    itens: r.itens.size,
    quantidade: r.quantidade,
    valor: Math.round(r.valor * 100) / 100,
    semPreco: r.semPreco,
  }))
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
