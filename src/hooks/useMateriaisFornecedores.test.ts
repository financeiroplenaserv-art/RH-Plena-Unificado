import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const resposta: { data: unknown[] | null; error: { code: string; message: string } | null } = { data: [], error: null }

vi.mock('@/lib/supabase', () => {
  const builder = {
    select: () => builder,
    order: () => Promise.resolve(resposta),
    update: () => builder,
    insert: () => builder,
    eq: () => builder,
  }
  return { supabase: { from: () => builder } }
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { useMateriaisFornecedores } from './useMateriaisFornecedores'

describe('useMateriaisFornecedores', () => {
  beforeEach(() => {
    resposta.data = []
    resposta.error = null
  })

  it('coluna da migration 121 ausente vira "estrutura pendente", sem quebrar', async () => {
    resposta.data = null
    resposta.error = { code: '42703', message: 'column fornecedores.ativo does not exist' }
    const { result } = renderHook(() => useMateriaisFornecedores())
    await act(async () => {
      await result.current.carregar()
    })
    expect(result.current.estruturaPendente).toBe(true)
    expect(result.current.fornecedores).toEqual([])
  })

  it('carrega a lista quando a estrutura existe', async () => {
    resposta.data = [{ id: 'f1', nome: 'Alfa', ativo: true }]
    const { result } = renderHook(() => useMateriaisFornecedores())
    await act(async () => {
      await result.current.carregar()
    })
    expect(result.current.estruturaPendente).toBe(false)
    expect(result.current.fornecedores).toHaveLength(1)
  })
})
