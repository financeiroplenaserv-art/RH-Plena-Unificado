import { describe, it, expect, vi } from 'vitest'
import { prepararGruposRecibo } from './emissaoRecibos'
import { caItem } from '@/pages/ceu/relatorios/relatorios.utils'
import type { EntregaCEU } from '@/types/database'

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
