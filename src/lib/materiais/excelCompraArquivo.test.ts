import { describe, expect, it } from 'vitest'
import type { MatCompraItem } from '@/types/materiais'
import { montarMatrizCompra } from './excelCompra'
import { aoaRemanejados, montarWorkbookCompra } from './excelCompraArquivo'
import type { RemanejamentoChegada } from './chegadas'

/** O exceljs grava ws.sheetProtection, mas a tipagem não expõe a propriedade. */
const prot = (ws: unknown) => (ws as { sheetProtection?: Record<string, unknown> }).sheetProtection

const cel = (p: Partial<MatCompraItem>): MatCompraItem =>
  ({
    id: Math.random().toString(36),
    compra_id: 'c',
    item_id: 'cloro',
    variacao_id: null,
    contrato_id: 'abaete',
    item_nome: 'Cloro 5L',
    variacao_rotulo: null,
    unidade: 'GL',
    categoria: 'limpeza',
    contrato_nome: 'Abaeté',
    rota: 1,
    quantidade: 6,
    preco_unitario: 12.5,
    qtd_recebida: null,
    motivo_recebimento: null,
    recebido_em: null,
    entrega_local: 'posto',
    ...p,
  }) as MatCompraItem

const itens = [cel({}), cel({ contrato_id: 'telex', contrato_nome: 'Telex', rota: 3, quantidade: 3 })]
const cab = { fornecedor: 'Antolimp', competencia: '2026-10-01', numero: 'COMP-1', data: '18/10/2026' }

describe('montarWorkbookCompra', () => {
  it('cabeçalho azul em negrito, congelado, paisagem; rotas mescladas quando agrupado', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens, true), cab, true, true)
    const ws = wb.getWorksheet('Por Cliente')!
    const h = ws.getCell(7, 1)
    expect(h.value).toBe('Item')
    expect(h.fill).toMatchObject({ fgColor: { argb: 'FF0F6CBD' } })
    expect(h.font).toMatchObject({ bold: true })
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 7 })
    expect(ws.pageSetup).toMatchObject({ orientation: 'landscape', fitToWidth: 1 })
    expect(ws.getCell(6, 2).value).toBe('Rota 1')
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Por Cliente', 'Compra', 'Entrega'])
    // grava e reabre
    const buf = await wb.xlsx.writeBuffer()
    expect(buf.byteLength).toBeGreaterThan(1000)
  })
  it('sem agrupar: cabeçalho de colunas logo após o bloco de identificação', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens, false), cab, false, false)
    const ws = wb.getWorksheet('Por Cliente')!
    expect(ws.getCell(6, 1).value).toBe('Item')
    expect(ws.getCell(6, 3).value).toBe('Telex (R3)')
  })

  it('TODAS as abas saem protegidas contra edição (sem senha), também depois de gravar e reabrir', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens, true), cab, false, true)
    for (const ws of wb.worksheets) {
      expect(prot(ws)).toMatchObject({ sheet: true, selectLockedCells: true, formatCells: false, insertRows: false, deleteRows: false })
      expect(prot(ws)).not.toHaveProperty('hashValue')
    }
    const ExcelJS = (await import('exceljs')).default
    const lido = new ExcelJS.Workbook()
    await lido.xlsx.load(await wb.xlsx.writeBuffer())
    expect(lido.worksheets.length).toBe(3)
    for (const ws of lido.worksheets) expect(prot(ws)?.sheet).toBe(true)
  })
})

const rem = {
  linha_id: 'l1', pedido_id: 'p', competencia: '2026-10-01', contrato_id: 'b', contrato_nome: 'Back Art', rota: 2,
  origem_id: 'a', origem_nome: 'Abaeté', item_id: 'cloro', variacao_id: null, item_nome: 'Cloro 5L', variacao_rotulo: null,
  unidade: 'GL', qtd_remanejada: 3, qtd_entregue_remanejada: null, remanejamento_obs: 'sobrou', motivo_entrega: null,
  confirmado_em: null, status_pedido: 'em_compra', compras: ['c'],
} as RemanejamentoChegada

describe('remanejado de outro posto no Excel', () => {
  it('o Excel do FORNECEDOR nunca tem a aba Remanejados', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens, true), cab, false, true, [rem])
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Por Cliente', 'Compra', 'Entrega'])
  })
  it('o Excel interno (com valores) lista o que levar de onde, também protegido', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens, true), cab, true, true, [rem])
    const ws = wb.getWorksheet('Remanejados')!
    expect(prot(ws)?.sheet).toBe(true)
    const aoa = aoaRemanejados(cab, [rem])
    expect(aoa[5]).toEqual(['Levar de', 'Para', 'Item', 'Quantidade', 'Situação', 'Observação'])
    expect(aoa[6]).toEqual(['Abaeté', 'Back Art', 'Cloro 5L', 3, 'a levar', 'sobrou'])
  })
})

describe('múltiplo de compra no arquivo (migration 152)', () => {
  it('coluna Embalagem em texto na aba Compra, moeda deslocada e proteção mantida', async () => {
    const comKit = [
      cel({ item_id: 'fl', item_nome: 'Flanela branca', quantidade: 3, preco_unitario: 1.8, fator_compra: 100, unidade_compra: 'kit' }),
      cel({ item_id: 'fl', item_nome: 'Flanela branca', quantidade: 97, preco_unitario: 1.8, contrato_id: null, contrato_nome: null, rota: null, entrega_local: 'escritorio', fator_compra: 100, unidade_compra: 'kit', qtd_arredondamento: 97 }),
    ]
    const wb = await montarWorkbookCompra(montarMatrizCompra(comKit, true), cab, true, true)
    const ws = wb.getWorksheet('Compra')!
    expect(ws.getCell(6, 3).value).toBe('Embalagem (como comprar)')
    expect(ws.getCell(7, 3).value).toBe('1 kit c/ 100')
    expect(ws.getCell(7, 3).alignment).toMatchObject({ horizontal: 'left' })
    expect(ws.getCell(7, 4).numFmt).toContain('R$')
    expect(prot(ws)?.sheet).toBe(true)
  })
})
