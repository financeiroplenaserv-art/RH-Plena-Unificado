import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEscalasDiario } from './useEscalasDiario'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

function criarQueryBuilder(retorno: unknown[] = []) {
  const chamadas: { metodo: string; args: unknown[] }[] = []

  const chain = {
    select: vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'select', args })
      return chain
    }),
    gte: vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'gte', args })
      return chain
    }),
    lte: vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'lte', args })
      return chain
    }),
    order: vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'order', args })
      return chain
    }),
    range: vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'range', args })
      return chain
    }),
    eq: vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'eq', args })
      return chain
    }),
    not: vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'not', args })
      return chain
    }),
    is: vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'is', args })
      return chain
    }),
    then: vi.fn().mockImplementation((cb: (v: { data: unknown[]; error: null }) => unknown) => {
      chamadas.push({ metodo: 'then', args: [cb] })
      return Promise.resolve(cb({ data: retorno, error: null }))
    }),
  }

  return { chain, chamadas }
}

describe('useEscalasDiario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aplica filtro de colaborador quando listar é chamado com colaboradorId', async () => {
    const { chain, chamadas } = criarQueryBuilder([])
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useEscalasDiario())

    await act(async () => {
      await result.current.listar(
        { ano: 2026, mes: 6, inicio: '2026-06-20', fim: '2026-07-19', label: 'Junho/2026' },
        { colaboradorId: 'col-acacio' }
      )
    })

    expect(mockFrom).toHaveBeenCalledWith('locais_trabalho_diario')
    const eqCalls = chamadas.filter((c) => c.metodo === 'eq')
    expect(eqCalls).toContainEqual({ metodo: 'eq', args: ['colaborador_id', 'col-acacio'] })
  })

  it('não aplica filtro de colaborador quando colaboradorId é vazio', async () => {
    const { chain, chamadas } = criarQueryBuilder([])
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useEscalasDiario())

    await act(async () => {
      await result.current.listar(
        { ano: 2026, mes: 6, inicio: '2026-06-20', fim: '2026-07-19', label: 'Junho/2026' },
        { colaboradorId: '' }
      )
    })

    const eqCalls = chamadas.filter((c) => c.metodo === 'eq')
    expect(eqCalls).toHaveLength(0)
  })
})
