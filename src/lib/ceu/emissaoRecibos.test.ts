import { describe, it, expect, vi } from 'vitest'
import { gerarRecibosLoteHTML, prepararGruposRecibo, resumirEntregasPorCategoria } from './emissaoRecibos'
import { caItem } from '@/pages/ceu/relatorios/relatorios.utils'
import type { EntregaCEU } from '@/types/database'

vi.mock('@/lib/empresas', () => ({
  buscarEmpresaPorId: vi.fn(async () => ({ nome: 'Empresa teste', cnpj: '00000000000000' })),
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

describe('recibos CEU em lote', () => {
  it('resume entregas e colaboradores por categoria como os recibos serão emitidos', () => {
    const entregas = [
      entregaFake({ id: 'epi-1', item: { tipo: 'EPI' }, snapshot_item: {} }),
      entregaFake({ id: 'epi-2', item: { tipo: 'EPI' }, snapshot_item: {} }),
      entregaFake({ id: 'uniforme-1', colaborador_id: 'c2', item: { tipo: 'Uniforme' }, snapshot_item: {} }),
    ]

    expect(resumirEntregasPorCategoria(entregas)).toEqual({
      epi: { entregas: 2, colaboradores: 1 },
      uniforme: { entregas: 1, colaboradores: 1 },
    })
  })

  it('separa EPI de uniforme/crachá e mantém as cores de cada modelo', async () => {
    const epi = entregaFake({
      id: 'epi-1',
      item: { nome: 'CAPACETE', tipo: 'EPI', ca: '12345', subgrupo: 'CAPACETE' },
      snapshot_item: { nome: 'CAPACETE', tipo: 'EPI', ca: '12345' },
    })
    const uniforme = entregaFake({
      id: 'uniforme-1',
      colaborador_id: 'c1',
      item_id: 'i2',
      item: { nome: 'CAMISA', tipo: 'Uniforme', ca: null, subgrupo: 'CAMISA' },
      snapshot_item: { nome: 'CAMISA', tipo: 'Uniforme' },
    })
    const registrarEmissaoRecibo = vi.fn(async () => true)
    let sequencial = 0
    const lote = await gerarRecibosLoteHTML([epi, uniforme], {
      proximoNumeroRecibo: vi.fn(async () => `REC-2026-${String(++sequencial).padStart(5, '0')}`),
      registrarEmissaoRecibo,
    })

    expect(lote.total).toBe(2)
    expect(lote.epi?.total).toBe(1)
    expect(lote.uniforme?.total).toBe(1)
    expect(lote.epi?.html).toContain('RECIBO DE ENTREGA - EPI')
    expect(lote.epi?.html).toContain('linear-gradient(135deg, #EA580C 0%, #F97316 100%)')
    expect(lote.epi?.html).not.toContain('linear-gradient(135deg, #16A34A 0%, #22C55E 100%)')
    expect(lote.epi?.html).not.toContain('CAMISA')
    expect(lote.uniforme?.html).toContain('RECIBO DE ENTREGA - UNIFORME/CRACHÁ')
    expect(lote.uniforme?.html).toContain('linear-gradient(135deg, #16A34A 0%, #22C55E 100%)')
    expect(lote.uniforme?.html).not.toContain('linear-gradient(135deg, #EA580C 0%, #F97316 100%)')
    expect(lote.uniforme?.html).not.toContain('CAPACETE')
    expect(registrarEmissaoRecibo).toHaveBeenNthCalledWith(1, ['epi-1'], 'REC-2026-00001')
    expect(registrarEmissaoRecibo).toHaveBeenNthCalledWith(2, ['uniforme-1'], 'REC-2026-00002')
  })

  it('gera número diferente quando o recibo antigo agrupava EPI e uniforme', async () => {
    const epi = entregaFake({
      id: 'epi-1',
      numero_recibo: 'REC-2026-00010',
      item: { nome: 'LUVA', tipo: 'EPI', ca: '12345' },
      snapshot_item: { nome: 'LUVA', tipo: 'EPI', ca: '12345' },
    })
    const uniforme = entregaFake({
      id: 'uniforme-1',
      numero_recibo: 'REC-2026-00010',
      item_id: 'i2',
      item: { nome: 'CAMISA', tipo: 'Uniforme', ca: null },
      snapshot_item: { nome: 'CAMISA', tipo: 'Uniforme' },
    })
    const registrarEmissaoRecibo = vi.fn(async () => true)
    const lote = await gerarRecibosLoteHTML([epi, uniforme], {
      proximoNumeroRecibo: vi.fn(async () => 'REC-2026-00011'),
      registrarEmissaoRecibo,
    })

    expect(lote.epi?.html).toContain('REC-2026-00010')
    expect(lote.uniforme?.html).toContain('REC-2026-00011')
    expect(registrarEmissaoRecibo).toHaveBeenCalledExactlyOnceWith(['uniforme-1'], 'REC-2026-00011')
  })
})
