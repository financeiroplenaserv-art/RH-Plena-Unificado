import type { MatCompra, MatCompraItem } from '@/types/materiais'
import { chaveItemCompra, descricaoItemCompra } from './compra'

// Excel ao fornecedor (docs/PLANO_MATERIAIS_FASE2.md §6) — reproduz as abas
// "Pedido ao Fornecedor por Cliente" e "Compra ao Fornecedor" da planilha:
// itens nas linhas, contratos nas colunas AGRUPADOS POR ROTA (1 a 4; "Sem rota"
// no fim), coluna "Estoque" só quando há reposição, e totais. O fornecedor usa
// essa matriz para separar e entregar posto a posto (rotina real, 17/10/2026).
// Versão ao fornecedor SEM preço (decisão 11); versão interna "com valores"
// para o financeiro. Lógica pura (testada sem arquivo); a gravação do .xlsx
// fica em excelCompraArquivo.ts.

export interface ColunaContrato {
  contratoId: string
  nome: string
  rota: number | null
}

export interface LinhaMatriz {
  chave: string
  descricao: string
  unidade: string | null
  porContrato: Record<string, number>
  estoque: number
  total: number
  preco: number | null
  valor: number | null
}

export interface MatrizCompra {
  colunas: ColunaContrato[]
  temEstoque: boolean
  linhas: LinhaMatriz[]
  totalPorContrato: Record<string, number>
  totalEstoque: number
  totalGeral: number
  valorGeral: number
  itensSemPreco: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function rotuloRota(rota: number | null): string {
  return rota ? `Rota ${rota}` : 'Sem rota'
}

/** Título da coluna do contrato: agrupado, só o nome (a rota está no cabeçalho do grupo); senão leva a rota entre parênteses. */
export function tituloColuna(c: ColunaContrato, agrupar: boolean): string {
  return agrupar || !c.rota ? c.nome : `${c.nome} (R${c.rota})`
}

/** agrupar=true: contratos por rota (sem rota no fim); false: ordem alfabética pura. */
export function montarMatrizCompra(itens: MatCompraItem[], agrupar = true): MatrizCompra {
  const colunasMap = new Map<string, ColunaContrato>()
  const linhasMap = new Map<string, LinhaMatriz>()
  const totalPorContrato: Record<string, number> = {}
  let totalEstoque = 0
  let totalGeral = 0
  for (const c of itens) {
    const q = Number(c.quantidade)
    if (!(q > 0)) continue
    const chave = chaveItemCompra(c.item_id, c.variacao_id)
    let l = linhasMap.get(chave)
    if (!l) {
      l = {
        chave,
        descricao: descricaoItemCompra(c.item_nome, c.variacao_rotulo),
        unidade: c.unidade,
        porContrato: {},
        estoque: 0,
        total: 0,
        preco: c.preco_unitario == null ? null : Number(c.preco_unitario),
        valor: null,
      }
      linhasMap.set(chave, l)
    }
    if (c.contrato_id) {
      if (!colunasMap.has(c.contrato_id)) {
        colunasMap.set(c.contrato_id, { contratoId: c.contrato_id, nome: c.contrato_nome ?? 'Contrato', rota: c.rota ?? null })
      }
      l.porContrato[c.contrato_id] = (l.porContrato[c.contrato_id] ?? 0) + q
      totalPorContrato[c.contrato_id] = (totalPorContrato[c.contrato_id] ?? 0) + q
    } else {
      l.estoque += q
      totalEstoque += q
    }
    l.total += q
    totalGeral += q
    // Mesmo item com preços diferentes entre células não acontece (o preço é
    // o vigente na geração); se acontecer, vale o maior para não subestimar.
    if (c.preco_unitario != null) l.preco = Math.max(l.preco ?? 0, Number(c.preco_unitario))
  }
  const colunas = [...colunasMap.values()].sort((a, b) =>
    agrupar
      ? (a.rota ?? 99) - (b.rota ?? 99) || a.nome.localeCompare(b.nome, 'pt-BR')
      : a.nome.localeCompare(b.nome, 'pt-BR') || (a.rota ?? 99) - (b.rota ?? 99)
  )
  const linhas = [...linhasMap.values()].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
  let valorGeral = 0
  let itensSemPreco = 0
  for (const l of linhas) {
    if (l.preco == null) itensSemPreco++
    else {
      l.valor = r2(l.total * l.preco)
      valorGeral += l.valor
    }
  }
  return {
    colunas,
    temEstoque: totalEstoque > 0,
    linhas,
    totalPorContrato,
    totalEstoque,
    totalGeral,
    valorGeral: r2(valorGeral),
    itensSemPreco,
  }
}

export type Celula = string | number | null

export interface CabecalhoExcel {
  fornecedor: string
  competencia: string // AAAA-MM-01
  numero: string
  data?: string // data da compra já formatada (dd/mm/aaaa)
}

export const TITULO_EXCEL = 'Plena Facilities — Pedido de materiais'
/** Linhas do bloco de identificação no topo de cada aba (título, 3 dados e uma em branco). */
export const LINHAS_CABECALHO = 5

const mesAno = (competencia: string) => `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}`

function blocoCabecalho(cab: CabecalhoExcel): Celula[][] {
  return [
    [TITULO_EXCEL],
    ['Fornecedor', cab.fornecedor],
    ['Mês', mesAno(cab.competencia)],
    ['Compra', cab.data ? `${cab.numero} · ${cab.data}` : cab.numero],
    [],
  ]
}

/** Aba "Pedido por Cliente": (agrupado) linha das rotas, linha dos contratos, itens e Total. */
export function aoaPedidoPorCliente(m: MatrizCompra, cab: CabecalhoExcel, comValores: boolean, agrupar = true): Celula[][] {
  const aoa: Celula[][] = blocoCabecalho(cab)
  const extras = (m.temEstoque ? ['Estoque'] : []).concat(['Total'], comValores ? ['Preço unitário', 'Valor'] : [])
  if (agrupar) {
    // Linha das rotas: o rótulo só na primeira coluna de cada rota (a mesclagem é feita no arquivo).
    const linhaRota: Celula[] = ['']
    let rotaAnterior: string | null = null
    for (const c of m.colunas) {
      const r = rotuloRota(c.rota)
      linhaRota.push(r === rotaAnterior ? '' : r)
      rotaAnterior = r
    }
    aoa.push(linhaRota.concat(extras.map(() => '')))
  }
  aoa.push((['Item'] as Celula[]).concat(m.colunas.map((c) => tituloColuna(c, agrupar)), extras))
  for (const l of m.linhas) {
    const linha: Celula[] = [l.descricao]
    for (const c of m.colunas) linha.push(l.porContrato[c.contratoId] ?? null)
    if (m.temEstoque) linha.push(l.estoque || null)
    linha.push(l.total)
    if (comValores) linha.push(l.preco, l.valor)
    aoa.push(linha)
  }
  const total: Celula[] = ['Total']
  for (const c of m.colunas) total.push(m.totalPorContrato[c.contratoId] ?? 0)
  if (m.temEstoque) total.push(m.totalEstoque)
  total.push(m.totalGeral)
  if (comValores) total.push(null, m.valorGeral)
  aoa.push(total)
  return aoa
}

/** Aba "Compra ao Fornecedor": Item | Quantidade (+ preço e valor na versão interna) | Total Geral. */
export function aoaCompraAoFornecedor(m: MatrizCompra, cab: CabecalhoExcel, comValores: boolean): Celula[][] {
  const aoa: Celula[][] = [
    ...blocoCabecalho(cab),
    comValores ? ['Item', 'Quantidade', 'Preço unitário', 'Valor'] : ['Item', 'Quantidade'],
  ]
  for (const l of m.linhas) aoa.push(comValores ? [l.descricao, l.total, l.preco, l.valor] : [l.descricao, l.total])
  aoa.push(comValores ? ['Total Geral', m.totalGeral, null, m.valorGeral] : ['Total Geral', m.totalGeral])
  return aoa
}

/**
 * Aba de entrega para o fornecedor separar as caixas. Agrupado: Rota | Contrato | Item | Quantidade.
 * Não agrupado: Contrato | Item | Quantidade (rota só no nome, "Contrato (R1)").
 */
export function aoaEntregaPorRota(m: MatrizCompra, agrupar = true): Celula[][] {
  const aoa: Celula[][] = agrupar ? [['Rota', 'Contrato', 'Item', 'Quantidade']] : [['Contrato', 'Item', 'Quantidade']]
  for (const c of m.colunas) {
    for (const l of m.linhas) {
      const q = l.porContrato[c.contratoId]
      if (!q) continue
      aoa.push(agrupar ? [rotuloRota(c.rota), c.nome, l.descricao, q] : [tituloColuna(c, false), l.descricao, q])
    }
  }
  if (m.temEstoque) {
    for (const l of m.linhas) {
      if (!l.estoque) continue
      aoa.push(agrupar ? ['Escritório', 'Estoque (reposição)', l.descricao, l.estoque] : ['Estoque (reposição)', l.descricao, l.estoque])
    }
  }
  return aoa
}

/** Nome do arquivo sem acento nem espaço: Pedido_Antolimp_10-2026_COMP-2026-10-001.xlsx */
export function nomeArquivoCompra(fornecedor: string, compra: Pick<MatCompra, 'competencia' | 'numero'>, comValores: boolean): string {
  const limpo = (fornecedor || 'Fornecedor')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const mes = `${compra.competencia.slice(5, 7)}-${compra.competencia.slice(0, 4)}`
  return `Pedido_${limpo || 'Fornecedor'}_${mes}_${compra.numero}${comValores ? '_com-valores' : ''}.xlsx`
}
