import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEscalasDiario } from './useEscalasDiario'
import { parseExcelFlit, encontrarColaborador } from '@/lib/escalas/importarFlit'
import { inferirLocalTrabalho } from '@/lib/escalas/inferirLocalTrabalho'
import { toast } from 'sonner'

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

vi.mock('@/lib/escalas/importarFlit', () => ({
  parseExcelFlit: vi.fn(),
  encontrarColaborador: vi.fn(),
}))

vi.mock('@/lib/escalas/inferirLocalTrabalho', () => ({
  inferirLocalTrabalho: vi.fn(),
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

describe('useEscalasDiario — preservação de confirmações manuais na reimportação', () => {
  function criarQueryBuilderImportacao(retorno: unknown[]) {
    const chamadas: { metodo: string; args: unknown[] }[] = []

    const chain: Record<string, unknown> = {}
    const registrar = (nome: string) =>
      vi.fn().mockImplementation((...args: unknown[]) => {
        chamadas.push({ metodo: nome, args })
        return chain
      })
    chain.select = registrar('select')
    chain.in = registrar('in')
    chain.gte = registrar('gte')
    chain.lte = registrar('lte')
    chain.eq = registrar('eq')
    chain.range = registrar('range')
    chain.upsert = vi.fn().mockImplementation((...args: unknown[]) => {
      chamadas.push({ metodo: 'upsert', args })
      return Promise.resolve({ error: null })
    })
    chain.then = vi.fn().mockImplementation((cb: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve(cb({ data: retorno, error: null }))
    )

    return { chain, chamadas }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta as confirmações com filtro fonte=manual e não sobrescreve dias confirmados manualmente', async () => {
    // O Excel traz 1 dia do colaborador c1; no banco esse mesmo dia já está
    // confirmado manualmente — ele deve ser preservado (sem upsert).
    const { chain, chamadas } = criarQueryBuilderImportacao([
      { colaborador_id: 'c1', data: '2026-07-01' },
    ])
    mockFrom.mockReturnValue(chain)

    vi.mocked(parseExcelFlit).mockResolvedValue([
      {
        nomeColaborador: 'FULANO',
        matricula: '000001',
        data: '2026-07-01',
        tipoDispositivo: null,
        nomeDispositivo: null,
        perimetro: null,
        departamento: null,
        turno: null,
        localTrabalhoNome: null,
      },
    ] as never)
    vi.mocked(encontrarColaborador).mockReturnValue({ id: 'c1' } as never)
    vi.mocked(inferirLocalTrabalho).mockReturnValue(null as never)

    const { result } = renderHook(() => useEscalasDiario())

    let resultado!: Awaited<ReturnType<typeof result.current.importarExcelFlit>>
    await act(async () => {
      resultado = await result.current.importarExcelFlit(
        new File(['x'], 'escala.xlsx'),
        [],
        [],
        [],
        null
      )
    })

    // A consulta de confirmações filtra fonte='manual' direto no banco
    // (e pagina via range) para não perder confirmações além de 1000 linhas.
    expect(chamadas).toContainEqual({ metodo: 'eq', args: ['fonte', 'manual'] })
    expect(chamadas.some((c) => c.metodo === 'range')).toBe(true)

    // O dia confirmado manualmente não vai para o upsert
    expect(chamadas.some((c) => c.metodo === 'upsert')).toBe(false)
    expect(resultado.preservados).toBe(1)
    expect(resultado.sucesso).toBe(0)
    expect(toast.success).toHaveBeenCalled()
  })
})
