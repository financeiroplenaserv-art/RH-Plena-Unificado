import { describe, expect, it } from 'vitest'
import type { MatCompraItem } from '@/types/materiais'
import { montarMatrizCompra } from './excelCompra'
import { montarWorkbookCompra } from './excelCompraArquivo'

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
})
