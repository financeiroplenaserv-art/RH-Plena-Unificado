import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

type Resp = { data: unknown; error: { code?: string; message?: string } | null }

// Respostas por tabela/operação e por RPC; registra as chamadas.
const respostas: Record<string, Resp> = {}
const rpcs: Record<string, Resp> = {}
const chamadas: string[] = []

vi.mock('@/lib/supabase', () => {
  const builder = (tabela: string) => {
    let op = 'select'
    const b: Record<string, unknown> = {}
    const fim = () => Promise.resolve(respostas[`${tabela}.${op}`] ?? { data: [], error: null })
    for (const m of ['eq', 'in', 'order', 'limit', 'gte', 'lt', 'range', 'not', 'maybeSingle']) b[m] = () => b
    b.insert = () => ((op = 'insert'), chamadas.push(`${tabela}.insert`), b)
    b.update = () => ((op = 'update'), b)
    b.delete = () => ((op = 'delete'), chamadas.push(`${tabela}.delete`), b)
    b.select = () => b
    b.then = (ok: (r: Resp) => unknown, erro: (e: unknown) => unknown) => fim().then(ok, erro)
    return b
  }
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: (nome: string) => {
        chamadas.push(`rpc.${nome}`)
        return Promise.resolve(rpcs[nome] ?? { data: null, error: null })
      },
    },
  }
})

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { criarPedidoExtra, usePedidoMaterial, useMateriaisPainel } from './useMateriaisPedidos'
import { useCeuPedidos } from './useCeuPedidos'

const ausente = { code: 'PGRST202', message: 'Could not find the function public.atender_linhas_pedido_ceu' }

describe('filas de Materiais — anti-falso-sucesso', () => {
  beforeEach(() => {
    for (const k of Object.keys(respostas)) delete respostas[k]
    for (const k of Object.keys(rpcs)) delete rpcs[k]
    chamadas.length = 0
    vi.clearAllMocks()
  })

  it('comentário bloqueado pela RLS (0 linhas) não finge sucesso', async () => {
    respostas['mat_comentarios.insert'] = { data: [], error: null }
    const { result } = renderHook(() => usePedidoMaterial())
    let ok = true
    await act(async () => {
      ok = await result.current.comentar({ pedidoId: 'p1', texto: 'esclarecer', autorNome: 'Ana' })
    })
    expect(ok).toBe(false)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it('pedido extra: falha ao gravar as linhas apaga o rascunho', async () => {
    respostas['mat_pedidos.insert'] = { data: [{ id: 'p1' }], error: null }
    respostas['mat_pedido_itens.insert'] = { data: [], error: null }
    const id = await criarPedidoExtra({
      contratoId: 'c1',
      competencia: '2026-10-09',
      observacao: 'urgência',
      userId: 'u1',
      produtos: [
        { item_id: 'i1', variacao_id: null, descricao_livre: null, qtd_kit: 1, qtd_pedida: 1, preco_unitario: 10, justificativa: null, excecao_acima_kit: false, excecao_validade: false, excecao_fora_kit: false },
      ],
      ceu: [],
    })
    expect(id).toBeNull()
    expect(chamadas).toContain('mat_pedidos.delete')
    expect(chamadas).not.toContain('rpc.enviar_pedido_interno')
  })

  it('aprovação em lote que não aprovou nada avisa em vez de comemorar', async () => {
    rpcs.aprovar_lote_materiais = { data: 0, error: null }
    const { result } = renderHook(() => useMateriaisPainel())
    let ok = true
    await act(async () => {
      ok = await result.current.aprovarLote('2026-10-01', ['c1'])
    })
    expect(ok).toBe(false)
    expect(toast.warning).toHaveBeenCalled()
  })

  it('identificação que gravou menos linhas que o pedido falha', async () => {
    rpcs.identificar_linhas_pedido_ceu = { data: 1, error: null }
    const { result } = renderHook(() => useCeuPedidos())
    let ok = true
    await act(async () => {
      ok = await result.current.identificar([
        { id: 'l1', colaborador_id: 'c1', tamanho_cadastro: null, alerta_tamanho: false, fora_da_equipe: false },
        { id: 'l2', colaborador_id: 'c2', tamanho_cadastro: null, alerta_tamanho: false, fora_da_equipe: false },
      ])
    })
    expect(ok).toBe(false)
  })

  it('atendimento: sem a migration 124, só atende pela quantidade conferida (RPC da 122)', async () => {
    rpcs.atender_linhas_pedido_ceu = { data: null, error: ausente }
    rpcs.atender_itens_pedido_ceu = { data: 1, error: null }
    const { result } = renderHook(() => useCeuPedidos())
    let ok = false
    await act(async () => {
      ok = await result.current.atender([{ id: 'l1', qtd_atendida: 2, motivo: null }], new Map([['l1', 2]]))
    })
    expect(ok).toBe(true)
    expect(chamadas).toContain('rpc.atender_itens_pedido_ceu')

    chamadas.length = 0
    await act(async () => {
      ok = await result.current.atender([{ id: 'l1', qtd_atendida: 1, motivo: 'faltou no estoque' }], new Map([['l1', 2]]))
    })
    expect(ok).toBe(false)
    expect(chamadas).not.toContain('rpc.atender_itens_pedido_ceu')
  })
})
