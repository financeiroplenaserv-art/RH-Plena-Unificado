import type { Workbook, Worksheet, Borders } from 'exceljs'
import type { MatCompra, MatCompraItem } from '@/types/materiais'
import { formatarDataDeTimestamp } from '@/lib/utils'
import {
  aoaCompraAoFornecedor,
  aoaEntregaPorRota,
  aoaPedidoPorCliente,
  LINHAS_CABECALHO,
  montarMatrizCompra,
  nomeArquivoCompra,
  rotuloRota,
  type Celula,
  type CabecalhoExcel,
  type MatrizCompra,
} from './excelCompra'

// Gera e baixa o .xlsx da compra, com o visual da planilha (lógica da matriz em
// excelCompra.ts). Usa o exceljs (o @e965/xlsx não grava estilos), carregado por
// import dinâmico só na hora de baixar — não pesa no bundle inicial.

const AZUL = 'FF0F6CBD'
const AZUL_CLARO = 'FFDCEBF8'
const ZEBRA = 'FFF3F7FB'
const CINZA_TOTAL = 'FFE5E7EB'
const BORDA = 'FFB8C4D0'
const FMT_QTD = '0'
const FMT_MOEDA = '"R$" #,##0.00'

const linhaFina = { style: 'thin' as const, color: { argb: BORDA } }
const BORDAS: Partial<Borders> = { top: linhaFina, bottom: linhaFina, left: linhaFina, right: linhaFina }

interface OpcoesAba {
  /** índice (0-based, no aoa) da linha de cabeçalho das colunas */
  linhaCab: number
  /** índice da linha das rotas (mescladas), quando agrupado */
  linhaRota?: number
  /** colunas (0-based) com valor em R$ */
  colunasMoeda?: number[]
  /** colunas (0-based) numéricas (alinhadas à direita); as demais são texto */
  primeiraNumerica: number
  /** aba sem linha de total no fim (ex.: Entrega) */
  semTotal?: boolean
  /** coluna (0-based) do total por item, em negrito */
  colunaTotal?: number
  /** grupos de colunas (1-based, inclusive) para mesclar na linha das rotas */
  gruposRota?: { de: number; ate: number }[]
}

const tamanhoTexto = (v: Celula) => (v == null ? 0 : String(v).length)

function montarAba(ws: Worksheet, aoa: Celula[][], op: OpcoesAba) {
  const ncols = Math.max(...aoa.map((l) => l.length))
  const moeda = new Set(op.colunasMoeda ?? [])
  aoa.forEach((l, i) => {
    const r = ws.getRow(i + 1)
    l.forEach((v, j) => {
      if (v !== null && v !== '') r.getCell(j + 1).value = v
    })
  })

  // Título e bloco de identificação
  ws.mergeCells(1, 1, 1, ncols)
  const t = ws.getCell(1, 1)
  t.font = { name: 'Calibri', size: 15, bold: true, color: { argb: AZUL } }
  t.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 26
  for (let i = 2; i <= 4; i++) {
    ws.getCell(i, 1).font = { bold: true, color: { argb: 'FF475569' } }
    ws.getCell(i, 2).font = { bold: true }
    ws.getCell(i, 2).alignment = { horizontal: 'left' }
  }

  // Cabeçalho das colunas
  const hdr = op.linhaCab + 1
  const rowH = ws.getRow(hdr)
  const longo = aoa[op.linhaCab].some((v) => tamanhoTexto(v) > 14)
  rowH.height = longo ? 34 : 22
  for (let c = 1; c <= ncols; c++) {
    const cell = rowH.getCell(c)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.border = BORDAS
    cell.alignment = { horizontal: c - 1 >= op.primeiraNumerica ? 'center' : 'left', vertical: 'middle', wrapText: true }
  }

  // Linha das rotas (mesclada por grupo)
  if (op.linhaRota != null) {
    const rr = ws.getRow(op.linhaRota + 1)
    rr.height = 20
    for (let c = 1; c <= ncols; c++) {
      const cell = rr.getCell(c)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
      cell.font = { bold: true, color: { argb: AZUL } }
      cell.border = BORDAS
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    for (const g of op.gruposRota ?? []) if (g.ate > g.de) ws.mergeCells(op.linhaRota + 1, g.de, op.linhaRota + 1, g.ate)
  }

  // Dados (zebrados) e total
  for (let i = op.linhaCab + 1; i < aoa.length; i++) {
    const total = !op.semTotal && i === aoa.length - 1
    const row = ws.getRow(i + 1)
    const zebra = !total && (i - op.linhaCab) % 2 === 0
    for (let c = 1; c <= ncols; c++) {
      const cell = row.getCell(c)
      cell.border = total ? { ...BORDAS, top: { style: 'medium', color: { argb: AZUL } } } : BORDAS
      if (total) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_TOTAL } }
        cell.font = { bold: true }
      } else if (zebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
      }
      if (c - 1 >= op.primeiraNumerica) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
        cell.numFmt = moeda.has(c - 1) ? FMT_MOEDA : FMT_QTD
        if (!total && c - 1 === op.colunaTotal) cell.font = { bold: true }
      } else {
        cell.alignment = { vertical: 'middle', wrapText: true }
      }
    }
  }

  // Larguras pelo conteúdo
  for (let c = 0; c < ncols; c++) {
    let w = 0
    for (let i = op.linhaCab; i < aoa.length; i++) {
      const txt = tamanhoTexto(aoa[i][c])
      w = Math.max(w, i === op.linhaCab && c >= op.primeiraNumerica ? Math.ceil(txt * 0.75) : txt)
    }
    const num = c >= op.primeiraNumerica
    ws.getColumn(c + 1).width = num ? Math.min(Math.max(w + 3, moeda.has(c) ? 15 : 11), 20) : Math.min(Math.max(w + 3, 14), 58)
  }

  // Congelar cabeçalho e primeira coluna; impressão paisagem em 1 página de largura
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: hdr, showGridLines: false }]
  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printTitlesRow: `${op.linhaRota != null ? op.linhaRota + 1 : hdr}:${hdr}`,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  }
  ws.headerFooter = { oddFooter: '&LPlena Facilities&CPágina &P de &N&R&D' }
}

function gruposDeRota(m: MatrizCompra): { de: number; ate: number }[] {
  const g: { rotulo: string; de: number; ate: number }[] = []
  m.colunas.forEach((col, i) => {
    const rotulo = rotuloRota(col.rota)
    const c = i + 2 // coluna 1 = Item
    if (g.length && g[g.length - 1].rotulo === rotulo) g[g.length - 1].ate = c
    else g.push({ rotulo, de: c, ate: c })
  })
  return g
}

/** Monta o workbook estilizado (separado do download para poder ser testado). */
export async function montarWorkbookCompra(
  m: MatrizCompra,
  cab: CabecalhoExcel,
  comValores: boolean,
  agrupar: boolean
): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Plena Facilities'
  wb.created = new Date()

  const aoa1 = aoaPedidoPorCliente(m, cab, comValores, agrupar)
  const ws1 = wb.addWorksheet('Por Cliente')
  const colTotal = m.colunas.length + (m.temEstoque ? 1 : 0) + 1 // 0-based: Item=0, contratos, [Estoque], Total
  const colPreco = colTotal + 1
  montarAba(ws1, aoa1, {
    linhaCab: LINHAS_CABECALHO + (agrupar ? 1 : 0),
    linhaRota: agrupar ? LINHAS_CABECALHO : undefined,
    gruposRota: agrupar ? gruposDeRota(m) : undefined,
    primeiraNumerica: 1,
    colunaTotal: colTotal,
    colunasMoeda: comValores ? [colPreco, colPreco + 1] : [],
  })

  const ws2 = wb.addWorksheet('Compra')
  montarAba(ws2, aoaCompraAoFornecedor(m, cab, comValores), {
    linhaCab: LINHAS_CABECALHO,
    primeiraNumerica: 1,
    colunaTotal: 1,
    colunasMoeda: comValores ? [2, 3] : [],
  })

  const ws3 = wb.addWorksheet('Entrega')
  const aoa3: Celula[][] = [...aoa1.slice(0, LINHAS_CABECALHO), ...aoaEntregaPorRota(m, agrupar)]
  montarAba(ws3, aoa3, { linhaCab: LINHAS_CABECALHO, primeiraNumerica: agrupar ? 3 : 2, semTotal: true })
  return wb
}

export async function baixarExcelCompra(
  compra: MatCompra,
  itens: MatCompraItem[],
  fornecedorNome: string,
  comValores: boolean,
  agrupar = true
): Promise<void> {
  const m = montarMatrizCompra(itens, agrupar)
  const cab: CabecalhoExcel = {
    fornecedor: fornecedorNome,
    competencia: compra.competencia,
    numero: compra.numero,
    data: compra.created_at ? formatarDataDeTimestamp(compra.created_at) : undefined,
  }
  const wb = await montarWorkbookCompra(m, cab, comValores, agrupar)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivoCompra(fornecedorNome, compra, comValores)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
