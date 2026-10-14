import { describe, it, expect, vi } from 'vitest'
import { prepararGruposRecibo, gerarRecibosLoteHTML, numeroDoGrupo } from './emissaoRecibos'
import { caItem, nomeItem } from '@/pages/ceu/relatorios/relatorios.utils'
import type { EntregaCEU } from '@/types/database'

vi.mock('@/lib/empresas', () => ({
  buscarEmpresaPorId: vi.fn(async () => ({ nome: 'Plena EA Facilities', cnpj: '00.000.000/0001-00' })),
}))

// Regra permanente (04/08/2026): o recibo deve mostrar o CA vigente na DATA
// DA ENTREGA (snapshot), nunca o CA atual do cadastro do item — o fabricante
// pode alterar o CA ao longo do tempo e o recibo já emitido não muda.

function entregaFake(overrides: Record<string, unknown>): EntregaCEU {
  return {
    id: 'e1',
    colaborador_id: 'c1',
    item_id: 'i1',
    data_entrega: '2026-01-15',
    data_devolucao: null,
    quantidade: 1,
    situacao: 'Novo',
    observacao: null,
    usuario_id: 'u1',
    recibo_emitido: false,
    numero_recibo: null,
    created_at: '2026-01-15T00:00:00Z',
    colaborador: { nome_completo: 'Fulano', matricula: '123', cargo: 'Porteiro', departamento: 'Portaria', cpf: '00000000000' },
    ...overrides,
  } as unknown as EntregaCEU
}

function depsFake() {
  let sequencial = 0
  return {
    proximoNumeroRecibo: vi.fn(async () => `REC-2026-${String(++sequencial).padStart(5, '0')}`),
    registrarEmissaoRecibo: vi.fn(async () => true),
  }
}

describe('CA no recibo — prioridade do snapshot (data da entrega)', () => {
  it('prepararGruposRecibo usa o CA do snapshot, não o do cadastro atual', async () => {
    const entrega = entregaFake({
      item: { nome: 'LUVA LÁTEX G', tipo: 'EPI', ca: '99.999', subgrupo: 'LUVAS' }, // CA atual do cadastro
      snapshot_item: { nome: 'LUVA LÁTEX G', tipo: 'EPI', ca: '45.629' }, // CA da época da entrega
    })
    const deps = {
      proximoNumeroRecibo: vi.fn(async () => 'REC-2026-00001'),
      registrarEmissaoRecibo: vi.fn(async () => true),
    }
    const grupos = await prepararGruposRecibo([entrega], deps)
    expect(grupos).toHaveLength(1)
    expect(grupos[0].itens[0].ca).toBe('45.629')
  })

  it('cai no CA do cadastro quando o snapshot não tem CA (entregas antigas)', async () => {
    const entrega = entregaFake({
      item: { nome: 'LUVA LÁTEX G', tipo: 'EPI', ca: '99.999', subgrupo: 'LUVAS' },
      snapshot_item: { nome: 'LUVA LÁTEX G', tipo: 'EPI', ca: '' },
    })
    const deps = {
      proximoNumeroRecibo: vi.fn(async () => 'REC-2026-00002'),
      registrarEmissaoRecibo: vi.fn(async () => true),
    }
    const grupos = await prepararGruposRecibo([entrega], deps)
    expect(grupos[0].itens[0].ca).toBe('99.999')
  })

  it('caItem (relatórios/exportação) também prioriza o snapshot', () => {
    const e = entregaFake({
      item: { ca: '99.999' },
      snapshot_item: { ca: '45.629' },
    })
    expect(caItem(e)).toBe('45.629')
    expect(caItem(entregaFake({ item: { ca: '99.999' }, snapshot_item: {} }))).toBe('99.999')
  })
})

// Regra permanente (14/10/2026, revisão do incidente do histórico): nome e
// subgrupo do recibo vêm do snapshot da entrega — renomear o item no cadastro
// não pode reescrever um recibo já emitido/assinado.
describe('nome/subgrupo no recibo — prioridade do snapshot', () => {
  it('prepararGruposRecibo usa nome e subgrupo do snapshot, mesmo com item renomeado no cadastro', async () => {
    const entrega = entregaFake({
      item: { nome: 'LUVA NITRÍLICA PREMIUM G', tipo: 'EPI', subgrupo: 'LUVAS DE PROTEÇÃO' }, // cadastro atual
      snapshot_item: { nome: 'LUVA LATEX G/M/P', tipo: 'EPI', subgrupo: 'LUVAS' }, // nome na data da entrega
    })
    const grupos = await prepararGruposRecibo([entrega], depsFake())
    expect(grupos[0].itens[0].nome).toBe('LUVA LATEX G/M/P')
    expect(grupos[0].itens[0].subgrupo).toBe('LUVAS')
  })

  it('cai no cadastro quando o snapshot antigo não tem nome/subgrupo', async () => {
    const entrega = entregaFake({
      item: { nome: 'CAMISA MALHA AZUL', tipo: 'Uniforme', subgrupo: 'CAMISAS' },
      snapshot_item: { tipo: 'Uniforme' },
    })
    const grupos = await prepararGruposRecibo([entrega], depsFake())
    expect(grupos[0].itens[0].nome).toBe('CAMISA MALHA AZUL')
    expect(grupos[0].itens[0].subgrupo).toBe('CAMISAS')
  })

  it('nomeItem (relatórios/exportação) também prioriza o snapshot', () => {
    expect(nomeItem(entregaFake({ item: { nome: 'NOME ATUAL' }, snapshot_item: { nome: 'NOME NA ENTREGA' } }))).toBe('NOME NA ENTREGA')
    expect(nomeItem(entregaFake({ item: { nome: 'NOME ATUAL' }, snapshot_item: {} }))).toBe('NOME ATUAL')
  })

  it('gerarRecibosLoteHTML monta o recibo com o nome do snapshot', async () => {
    const entrega = entregaFake({
      item: { nome: 'NOME ATUAL DO ITEM', tipo: 'EPI' },
      snapshot_item: { nome: 'NOME DA ÉPOCA DA ENTREGA', tipo: 'EPI' },
    })
    const { html } = await gerarRecibosLoteHTML([entrega], depsFake())
    expect(html).toContain('NOME DA ÉPOCA DA ENTREGA')
    expect(html).not.toContain('NOME ATUAL DO ITEM')
  })
})

// Recibo de UMA data e UM tipo só (incidente de 04/08/2026: lote gravou 7
// números em duas datas e 41 recibos misturando EPI com uniforme).
describe('agrupamento colaborador + data + tipo', () => {
  it('prepararGruposRecibo separa grupos por data de entrega', async () => {
    const entregas = [
      entregaFake({ id: 'e1', data_entrega: '2026-01-15', item: { nome: 'LUVA', tipo: 'EPI' } }),
      entregaFake({ id: 'e2', data_entrega: '2026-02-01', item: { nome: 'LUVA', tipo: 'EPI' } }),
    ]
    const grupos = await prepararGruposRecibo(entregas, depsFake())
    expect(grupos).toHaveLength(2)
    expect(grupos[0].dataEntrega).toBe('2026-01-15')
    expect(grupos[1].dataEntrega).toBe('2026-02-01')
    // Cada grupo recebe o seu próprio número de recibo.
    expect(grupos[0].numeroRecibo).not.toBe(grupos[1].numeroRecibo)
  })

  it('lote com 2 datas gera 2 recibos para o mesmo colaborador', async () => {
    const entregas = [
      entregaFake({ id: 'e1', data_entrega: '2026-01-15', item: { nome: 'LUVA', tipo: 'EPI' } }),
      entregaFake({ id: 'e2', data_entrega: '2026-02-01', item: { nome: 'LUVA', tipo: 'EPI' } }),
    ]
    const { html, total } = await gerarRecibosLoteHTML(entregas, depsFake())
    expect(total).toBe(2)
    expect(html.match(/class="recibo-page"/g)).toHaveLength(2)
  })

  it('lote com EPI + uniforme na mesma data gera 2 recibos', async () => {
    const entregas = [
      entregaFake({ id: 'e1', item: { nome: 'LUVA', tipo: 'EPI' } }),
      entregaFake({ id: 'e2', item: { nome: 'CAMISA', tipo: 'Uniforme' } }),
    ]
    const { html, total } = await gerarRecibosLoteHTML(entregas, depsFake())
    expect(total).toBe(2)
    expect(html.match(/class="recibo-page"/g)).toHaveLength(2)
  })
})

// Trava defensiva: número gravado em entrega de outra data/tipo (resíduo do
// incidente de 04/08/2026) nunca é herdado — gera número novo e avisa.
describe('numeroDoGrupo — não herda número de outra data/tipo', () => {
  it('reutiliza o número quando todas as numeradas são da mesma data e tipo', async () => {
    const deps = depsFake()
    const lista = [
      entregaFake({ id: 'e1', numero_recibo: 'REC-2026-00100', item: { tipo: 'EPI' } }),
      entregaFake({ id: 'e2', numero_recibo: null, item: { tipo: 'EPI' } }),
    ]
    const numero = await numeroDoGrupo(lista, deps)
    expect(numero).toBe('REC-2026-00100')
    expect(deps.proximoNumeroRecibo).not.toHaveBeenCalled()
    expect(deps.registrarEmissaoRecibo).toHaveBeenCalledWith(['e2'], 'REC-2026-00100')
  })

  it('não herda número de entrega numerada de OUTRA data — gera número novo e avisa', async () => {
    const deps = depsFake()
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lista = [
      entregaFake({ id: 'e1', data_entrega: '2026-02-01', item: { tipo: 'EPI' } }),
      // Resíduo: entrega de 15/01 com número gravado por emissão que misturou datas.
      entregaFake({ id: 'e2', data_entrega: '2026-01-15', numero_recibo: 'REC-2026-00100', item: { tipo: 'EPI' } }),
    ]
    const numero = await numeroDoGrupo(lista, deps)
    expect(numero).toBe('REC-2026-00001')
    expect(numero).not.toBe('REC-2026-00100')
    expect(deps.proximoNumeroRecibo).toHaveBeenCalledTimes(1)
    expect(aviso).toHaveBeenCalledOnce()
    aviso.mockRestore()
  })

  it('não herda número de entrega numerada de OUTRO tipo (EPI × uniforme)', async () => {
    const deps = depsFake()
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lista = [
      entregaFake({ id: 'e1', item: { tipo: 'EPI' } }),
      entregaFake({ id: 'e2', numero_recibo: 'REC-2026-00100', item: { tipo: 'Uniforme' } }),
    ]
    const numero = await numeroDoGrupo(lista, deps)
    expect(numero).toBe('REC-2026-00001')
    expect(aviso).toHaveBeenCalledOnce()
    aviso.mockRestore()
  })
})
