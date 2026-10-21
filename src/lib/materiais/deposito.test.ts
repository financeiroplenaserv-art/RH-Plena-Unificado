import { describe, expect, it } from 'vitest'
import type { MatCompraItem } from '@/types/materiais'
import {
  agruparChegadaPorItem,
  agruparSeparacaoPorContrato,
  aoaLevarDoDeposito,
  aoaListaSeparacao,
  compraEntregaNoDeposito,
  distribuirTotalNasCelulas,
  erroChegadaItemDeposito,
  erroSeparacao,
  levarDoDeposito,
  montarPayloadChegadaDeposito,
  montarPayloadSeparacao,
  normalizarSeparacao,
  postosDepositoPlena,
  situacaoSeparacao,
  type LinhaLevarDoDeposito,
  type LinhaSeparacao,
} from './deposito'
import { aoaCompraDeposito, montarMatrizCompra, rotuloRota, TEXTO_ENTREGA_DEPOSITO } from './excelCompra'
import { montarWorkbookCompra } from './excelCompraArquivo'
import { lerRota, ordemRota, ROTAS_SELECIONAVEIS, textoRota } from './pedidos'

const prot = (ws: unknown) => (ws as { sheetProtection?: Record<string, unknown> }).sheetProtection

const cel = (p: Partial<MatCompraItem>): MatCompraItem =>
  ({
    id: Math.random().toString(36).slice(2),
    compra_id: 'c',
    item_id: 'rzk',
    variacao_id: null,
    contrato_id: 'abaete',
    item_nome: 'RZK 101 5L',
    variacao_rotulo: null,
    unidade: 'GL',
    categoria: 'limpeza',
    contrato_nome: 'Abaeté',
    rota: 1,
    quantidade: 3,
    preco_unitario: 40,
    qtd_recebida: null,
    motivo_recebimento: null,
    recebido_em: null,
    entrega_local: 'posto',
    ...p,
  }) as MatCompraItem

const sep = (p: Partial<LinhaSeparacao>): LinhaSeparacao => ({
  linha_id: Math.random().toString(36).slice(2),
  pedido_id: 'p',
  competencia: '2026-10-01',
  contrato_id: 'abaete',
  contrato_nome: 'Abaeté',
  rota: 1,
  parte: 'kit',
  item_id: 'rzk',
  variacao_id: null,
  item_nome: 'RZK 101 5L',
  variacao_rotulo: null,
  unidade: 'GL',
  qtd_compra: 3,
  qtd_recebida: 3,
  qtd_separada: null,
  separado_em: null,
  motivo_entrega: null,
  status_pedido: 'em_compra',
  compra_id: 'c1',
  compra_numero: 'COMP-2026-10-002',
  compra_status: 'recebida',
  competencia_compra: '2026-10-01',
  fornecedor_nome: 'Essex',
  ...p,
})

describe('rota "Depósito Plena" (rota 0)', () => {
  it('lê o select, rotula e ordena depois das rotas de entrega', () => {
    expect(lerRota('0')).toBe(0)
    expect(lerRota('')).toBeNull() // select "Sem rota" não vira rota 0
    expect(lerRota(null)).toBeNull()
    expect(lerRota('5')).toBeNull()
    expect(ROTAS_SELECIONAVEIS).toEqual([1, 2, 3, 4, 0])
    expect(textoRota(0)).toBe('Depósito Plena')
    expect(textoRota(2)).toBe('Rota 2')
    expect(textoRota(null)).toBe('—')
    expect(rotuloRota(0)).toBe('Depósito Plena')
    expect(rotuloRota(null)).toBe('Sem rota')
    expect([null, 0, 4, 1].sort((a, b) => ordemRota(a) - ordemRota(b))).toEqual([1, 4, 0, null])
  })

  it('a matriz agrupa "Depósito Plena" depois da rota 4 e antes de sem rota', () => {
    const m = montarMatrizCompra([
      cel({ contrato_id: 'a', contrato_nome: 'Sem', rota: null }),
      cel({ contrato_id: 'b', contrato_nome: 'Montreal', rota: 0 }),
      cel({ contrato_id: 'c', contrato_nome: 'CBO Macaé', rota: 4 }),
      cel({ contrato_id: 'd', contrato_nome: 'Abaeté', rota: 1 }),
    ])
    expect(m.colunas.map((c) => c.nome)).toEqual(['Abaeté', 'CBO Macaé', 'Montreal', 'Sem'])
  })
})

describe('compraEntregaNoDeposito', () => {
  it('rascunho vale pelo cadastro do fornecedor; enviada pelo snapshot da compra', () => {
    expect(compraEntregaNoDeposito({ status: 'rascunho', entrega_deposito: false }, { entrega_deposito: true })).toBe(true)
    expect(compraEntregaNoDeposito({ status: 'enviada', entrega_deposito: false }, { entrega_deposito: true })).toBe(false)
    expect(compraEntregaNoDeposito({ status: 'enviada', entrega_deposito: true }, { entrega_deposito: false })).toBe(true)
    expect(compraEntregaNoDeposito(null, { entrega_deposito: true })).toBe(false)
    expect(compraEntregaNoDeposito({ status: 'enviada' }, undefined)).toBe(false)
  })
})

describe('chegada por TOTAL do item (fornecedor de depósito)', () => {
  // 3 RZK do Abaeté, 2 da Telex e 4 de reposição do estoque
  const celulas = [
    cel({ id: 'est', contrato_id: null, contrato_nome: null, rota: null, quantidade: 4 }),
    cel({ id: 'tel', contrato_id: 'telex', contrato_nome: 'Telex', rota: 3, quantidade: 2 }),
    cel({ id: 'aba', quantidade: 3 }),
  ]

  it('agrupa as células por item e soma o comprado', () => {
    const itens = agruparChegadaPorItem([...celulas, cel({ item_id: 'lustro', item_nome: 'Lustro 1L', id: 'l1', quantidade: 5 })])
    expect(itens.map((i) => [i.descricao, i.comprado, i.registrado])).toEqual([
      ['Lustro 1L', 5, false],
      ['RZK 101 5L', 9, false],
    ])
  })

  it('distribui: postos por rota primeiro, estoque por último; a falta recai no fim', () => {
    const cheio = distribuirTotalNasCelulas(celulas, 9, null)
    expect(Object.fromEntries(cheio.map((p) => [p.id, p.qtd_recebida]))).toEqual({ aba: 3, tel: 2, est: 4 })
    const falta = distribuirTotalNasCelulas(celulas, 6, 'faltou')
    expect(Object.fromEntries(falta.map((p) => [p.id, [p.qtd_recebida, p.motivo]]))).toEqual({
      aba: [3, null],
      tel: [2, null],
      est: [1, 'faltou'],
    })
  })

  it('valida o total: maior que o comprado e falta sem motivo', () => {
    const [it] = agruparChegadaPorItem(celulas)
    expect(erroChegadaItemDeposito(it, { qtd: '10', motivo: '' })).toMatch(/Maior que o comprado/)
    expect(erroChegadaItemDeposito(it, { qtd: '8', motivo: '' })).toMatch(/motivo/)
    expect(erroChegadaItemDeposito(it, { qtd: '8', motivo: 'faltou' })).toBeNull()
    expect(erroChegadaItemDeposito(it, { qtd: 'x', motivo: '' })).toMatch(/inválida/)
  })

  it('"Chegou tudo" grava o comprado em todas as células; sem pendência não gera payload', () => {
    const itens = agruparChegadaPorItem(celulas)
    const { payload, erros } = montarPayloadChegadaDeposito(itens, {}, true)
    expect(erros).toEqual([])
    expect(payload.map((p) => p.qtd_recebida).sort()).toEqual([2, 3, 4])
    const jaRegistrado = agruparChegadaPorItem(celulas.map((c) => ({ ...c, qtd_recebida: c.quantidade })))
    expect(montarPayloadChegadaDeposito(jaRegistrado, {}, true).payload).toEqual([])
    expect(montarPayloadChegadaDeposito(jaRegistrado, {}, false).payload).toEqual([])
  })

  it('a reposição já recebida não pode ser reduzida pelo total', () => {
    const [it] = agruparChegadaPorItem(celulas.map((c) => (c.id === 'est' ? { ...c, qtd_recebida: 4 } : c)))
    expect(erroChegadaItemDeposito(it, { qtd: '3', motivo: 'x' })).toMatch(/estoque/)
  })
})

describe('separação por posto', () => {
  it('situação: aguardando, a separar, separada (0 recebido também fecha)', () => {
    expect(situacaoSeparacao({ qtd_recebida: null, qtd_separada: null })).toBe('aguardando')
    expect(situacaoSeparacao({ qtd_recebida: 3, qtd_separada: null })).toBe('a_separar')
    expect(situacaoSeparacao({ qtd_recebida: 3, qtd_separada: 3 })).toBe('separada')
    expect(situacaoSeparacao({ qtd_recebida: 0, qtd_separada: null })).toBe('separada')
  })

  it('agrupa por posto: rotas 1 a 4, Depósito Plena, sem rota', () => {
    const g = agruparSeparacaoPorContrato([
      sep({ contrato_id: 'a', contrato_nome: 'Z sem', rota: null }),
      sep({ contrato_id: 'b', contrato_nome: 'Montreal', rota: 0 }),
      sep({ contrato_id: 'c', contrato_nome: 'Telex Sede', rota: 3 }),
      sep({ contrato_id: 'd', contrato_nome: 'Abaeté', rota: 1, qtd_separada: 3 }),
      sep({ contrato_id: 'd', contrato_nome: 'Abaeté', rota: 1, item_nome: 'Lustro', qtd_recebida: null }),
    ])
    expect(g.map((x) => x.contratoNome)).toEqual(['Abaeté', 'Telex Sede', 'Montreal', 'Z sem'])
    expect(g[0]).toMatchObject({ aguardando: 1, aSeparar: 0, concluido: false })
    expect(g[0].linhas).toHaveLength(2)
  })

  it('"Separei tudo" usa o que chegou; só vai o que ainda falta', () => {
    const a = sep({ linha_id: 'a' })
    const b = sep({ linha_id: 'b', qtd_separada: 3, separado_em: '2026-10-22' })
    const c = sep({ linha_id: 'c', qtd_recebida: null })
    const { payload } = montarPayloadSeparacao([a, b, c], {}, true)
    expect(payload).toEqual([{ id: 'a', qtd: 3, motivo: null }])
  })

  it('separar menos do que chegou exige motivo; mais do que chegou é recusado', () => {
    const a = sep({ linha_id: 'a' })
    expect(erroSeparacao(a, { qtd: '2', motivo: '' })).toMatch(/motivo/)
    expect(erroSeparacao(a, { qtd: '4', motivo: '' })).toMatch(/Maior que o que chegou/)
    expect(erroSeparacao(sep({ qtd_recebida: null }), { qtd: '1', motivo: '' })).toMatch(/Ainda não chegou/)
    const r = montarPayloadSeparacao([a], { a: { qtd: '2', motivo: 'quebrou' } })
    expect(r.erros).toEqual([])
    expect(r.payload).toEqual([{ id: 'a', qtd: 2, motivo: 'quebrou' }])
    expect(montarPayloadSeparacao([a], { a: { qtd: '2', motivo: '' } }).erros).toHaveLength(1)
  })

  it('exemplo da gestora: 20 RZK chegam; 2 vão para o Abaeté', () => {
    // Essex entrega 20 no depósito → distribuído (Abaeté 3 comprados? aqui 2) → inspetor separa 2
    const aba = sep({ linha_id: 'aba', qtd_compra: 2, qtd_recebida: 2 })
    expect(montarPayloadSeparacao([aba], {}, true).payload).toEqual([{ id: 'aba', qtd: 2, motivo: null }])
  })

  it('normaliza o retorno da RPC (números como texto, rota nula)', () => {
    const d = normalizarSeparacao({ competencia: '2026-10-01', hoje: '2026-10-21', linhas: [{ ...sep({}), qtd_compra: '3', qtd_recebida: '3', qtd_separada: null, rota: '0' }] })
    expect(d.linhas[0]).toMatchObject({ qtd_compra: 3, qtd_recebida: 3, qtd_separada: null, rota: 0 })
    expect(normalizarSeparacao(null).linhas).toEqual([])
  })

  it('lista para imprimir soma kit + extra do mesmo item e posto', () => {
    const aoa = aoaListaSeparacao(
      [sep({ parte: 'kit', qtd_compra: 2, qtd_recebida: 2 }), sep({ parte: 'extra', qtd_compra: 1, qtd_recebida: 1, qtd_separada: 1, separado_em: '2026-10-22' }), sep({ contrato_id: 'm', contrato_nome: 'Montreal', rota: 0 })],
      '2026-10-01'
    )
    const corpo = aoa.slice(5)
    expect(corpo[0]).toEqual(['Rota', 'Posto', 'Item', 'Comprado', 'Chegou', 'Separado'])
    expect(corpo[1]).toEqual(['Rota 1', 'Abaeté', 'RZK 101 5L', 3, 3, 1])
    expect(corpo[2][0]).toBe('Depósito Plena')
  })
})

describe('Antolimp: levar do depósito', () => {
  const lev = (p: Partial<LinhaLevarDoDeposito>): LinhaLevarDoDeposito => ({
    celula_id: Math.random().toString(36).slice(2),
    compra_id: 'c1',
    compra_numero: 'COMP-2',
    compra_status: 'enviada',
    fornecedor_nome: 'Essex',
    contrato_id: 'abaete',
    contrato_nome: 'Abaeté',
    rota: 1,
    item_id: 'rzk',
    variacao_id: null,
    item_nome: 'RZK 101 5L',
    variacao_rotulo: null,
    unidade: 'GL',
    quantidade: 3,
    qtd_recebida: null,
    ...p,
  })

  it('soma o mesmo item do mesmo posto vindo de compras diferentes e mantém a origem', () => {
    const r = levarDoDeposito([lev({}), lev({ fornecedor_nome: 'Compra Avulsa', quantidade: 2 })])
    expect(r).toEqual([{ rota: 1, contrato: 'Abaeté', item: 'RZK 101 5L', unidade: 'GL', quantidade: 5, origem: 'Compra Avulsa / Essex' }])
  })

  it('postos de "Depósito Plena" ficam de fora (a Plena leva) e são listados à parte', () => {
    const linhas = [lev({}), lev({ contrato_id: 'm', contrato_nome: 'Montreal', rota: 0 })]
    expect(levarDoDeposito(linhas).map((x) => x.contrato)).toEqual(['Abaeté'])
    expect(postosDepositoPlena(linhas)).toEqual(['Montreal'])
  })

  it('ordena por rota e gera a aba com cabeçalho de 5 linhas', () => {
    const r = levarDoDeposito([lev({ contrato_id: 't', contrato_nome: 'Telex Sede', rota: 3 }), lev({}), lev({ contrato_id: 'c', contrato_nome: 'CBO Macaé', rota: 4 })])
    expect(r.map((x) => x.rota)).toEqual([1, 3, 4])
    const aoa = aoaLevarDoDeposito(r, { fornecedor: 'Antolimp', competencia: '2026-10-01', numero: 'COMP-1' })
    expect(aoa).toHaveLength(5 + 1 + 3)
    expect(aoa[5]).toEqual(['Rota', 'Posto', 'Item', 'Quantidade', 'Sai de'])
    expect(aoa[6]).toEqual(['Rota 1', 'Abaeté', 'RZK 101 5L', 3, 'Essex'])
  })
})

describe('Excel do fornecedor de depósito', () => {
  const itens = [cel({}), cel({ contrato_id: 'telex', contrato_nome: 'Telex', rota: 3, quantidade: 2 })]
  const cab = { fornecedor: 'Essex', competencia: '2026-10-01', numero: 'COMP-2', data: '21/10/2026' }

  it('aba Compra com o total por item e "Entregar no depósito Plena" no cabeçalho', () => {
    const aoa = aoaCompraDeposito(montarMatrizCompra(itens), cab, false)
    expect(aoa[4]).toEqual(['Entrega', TEXTO_ENTREGA_DEPOSITO])
    expect(aoa[5]).toEqual(['Item', 'Quantidade'])
    expect(aoa[6]).toEqual(['RZK 101 5L', 5])
    expect(aoa.length).toBe(8) // 5 de cabeçalho + título das colunas + 1 item + Total Geral
  })

  it('sem valores: só a aba Compra, sem colunas por contrato; tudo protegido', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens), cab, false, true, [], { deposito: true })
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Compra'])
    const ws = wb.getWorksheet('Compra')!
    expect(ws.getCell(5, 2).value).toBe(TEXTO_ENTREGA_DEPOSITO)
    const todas: unknown[] = []
    ws.eachRow((r) => r.eachCell((c) => todas.push(c.value)))
    expect(todas).not.toContain('Abaeté')
    expect(todas).not.toContain('Telex')
    expect(prot(ws)).toMatchObject({ sheet: true, formatCells: false })
    expect(prot(ws)).not.toHaveProperty('hashValue')
  })

  it('com valores (interno): mantém a matriz por posto e as demais abas', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens), cab, true, true, [], { deposito: true })
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Por Cliente', 'Compra', 'Entrega'])
    expect(wb.getWorksheet('Compra')!.getCell(5, 2).value).toBe(TEXTO_ENTREGA_DEPOSITO)
    for (const ws of wb.worksheets) expect(prot(ws)?.sheet).toBe(true)
  })
})

describe('Excel da Antolimp: aba "Levar do depósito"', () => {
  const itens = [cel({})]
  const cab = { fornecedor: 'Antolimp', competencia: '2026-10-01', numero: 'COMP-1' }
  const levar = [
    {
      celula_id: 'x', compra_id: 'c2', compra_numero: 'COMP-2', compra_status: 'enviada', fornecedor_nome: 'Essex',
      contrato_id: 'abaete', contrato_nome: 'Abaeté', rota: 1 as const, item_id: 'rzk', variacao_id: null,
      item_nome: 'RZK 101 5L', variacao_rotulo: null, unidade: 'GL', quantidade: 3, qtd_recebida: null,
    },
    {
      celula_id: 'y', compra_id: 'c2', compra_numero: 'COMP-2', compra_status: 'enviada', fornecedor_nome: 'Essex',
      contrato_id: 'montreal', contrato_nome: 'Montreal', rota: 0 as const, item_id: 'rzk', variacao_id: null,
      item_nome: 'RZK 101 5L', variacao_rotulo: null, unidade: 'GL', quantidade: 2, qtd_recebida: null,
    },
  ]

  it('entra depois de Entrega, protegida, só com postos em rota', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens), cab, false, true, [], { levar })
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Por Cliente', 'Compra', 'Entrega', 'Levar do depósito'])
    const ws = wb.getWorksheet('Levar do depósito')!
    expect(ws.getCell(6, 1).value).toBe('Rota')
    expect(ws.getCell(7, 1).value).toBe('Rota 1')
    expect(ws.getCell(7, 2).value).toBe('Abaeté')
    expect(ws.getCell(7, 4).value).toBe(3)
    expect(ws.getCell(7, 5).value).toBe('Essex')
    expect(ws.getCell(8, 2).value).toBeNull() // Montreal (Depósito Plena) fica de fora
    for (const w of wb.worksheets) expect(prot(w)?.sheet).toBe(true)
  })

  it('sem células de depósito a aba não existe', async () => {
    const wb = await montarWorkbookCompra(montarMatrizCompra(itens), cab, false, true, [], { levar: [] })
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Por Cliente', 'Compra', 'Entrega'])
  })
})
