import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// Consultas encadeadas do supabase-js simuladas: cada select devolve a próxima resposta da fila.
const respostas: Array<{ data: unknown; error: { code?: string; message?: string } | null }> = []
const selects: string[] = []

vi.mock('@/lib/supabase', () => {
  const cadeia = (colunas: string) => {
    selects.push(colunas)
    const resposta = respostas.shift() ?? { data: [], error: null }
    const obj = {
      eq: () => obj,
      order: () => Promise.resolve(resposta),
    }
    return obj
  }
  return { supabase: { from: () => ({ select: cadeia }) } }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { erroColunaTarifaCheiaAusente, useVt } from '@/hooks/useVt'

describe('useVt — exceção tarifa cheia (migration 174)', () => {
  beforeEach(() => {
    respostas.length = 0
    selects.length = 0
  })

  it('reconhece o erro de coluna inexistente', () => {
    expect(erroColunaTarifaCheiaAusente({ code: '42703', message: 'column colaboradores.vt_tarifa_cheia does not exist' })).toBe(true)
    expect(erroColunaTarifaCheiaAusente({ code: 'XX', message: 'outro erro' })).toBe(false)
    expect(erroColunaTarifaCheiaAusente(null)).toBe(false)
  })

  it('sem a migration: relê sem as colunas novas e trata todos como integração presumida', async () => {
    respostas.push({ data: null, error: { code: '42703', message: 'column colaboradores.vt_tarifa_cheia does not exist' } })
    respostas.push({ data: [{ id: 'a', nome_completo: 'A' }], error: null })
    const { result } = renderHook(() => useVt())
    let ok = false
    await act(async () => {
      ok = await result.current.listarColaboradores()
    })
    expect(ok).toBe(true)
    expect(selects[0]).toContain('vt_tarifa_cheia')
    expect(selects[1]).not.toContain('vt_tarifa_cheia')
    expect(result.current.colaboradores[0].vt_tarifa_cheia).toBe(false)
  })

  it('com a migration: lê a exceção', async () => {
    respostas.push({ data: [{ id: 'a', nome_completo: 'A', vt_tarifa_cheia: true, vt_tarifa_cheia_motivo: 'm' }], error: null })
    const { result } = renderHook(() => useVt())
    await act(async () => {
      await result.current.listarColaboradores()
    })
    expect(selects).toHaveLength(1)
    expect(result.current.colaboradores[0]).toMatchObject({ vt_tarifa_cheia: true, vt_tarifa_cheia_motivo: 'm' })
  })
})
