import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { sugerirRotasGoogle } from './vtRotaApi'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const sessaoMock = vi.mocked(supabase.auth.getSession)
const fetchOriginal = globalThis.fetch

beforeEach(() => {
  sessaoMock.mockReset()
  sessaoMock.mockResolvedValue({
    data: { session: { access_token: 'token-teste' } },
    error: null,
  } as never)
  globalThis.fetch = fetchOriginal
})

describe('sugerirRotasGoogle', () => {
  it('envia o JWT da sessão e o itinerário para a vt-rota', async () => {
    const chamadas: { url: string; init?: RequestInit }[] = []
    globalThis.fetch = vi.fn(async (url, init) => {
      chamadas.push({ url: String(url), init })
      return new Response(JSON.stringify({ routes: [] }), { status: 200 })
    }) as typeof fetch

    await sugerirRotasGoogle({
      origin: 'Origem',
      destination: 'Destino',
      departureTime: '2026-11-23T09:00:00Z',
    })

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].url).toContain('/functions/v1/vt-rota')
    expect(chamadas[0].init?.headers).toMatchObject({
      Authorization: 'Bearer token-teste',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(chamadas[0].init?.body))).toEqual({
      origin: 'Origem',
      destination: 'Destino',
      departureTime: '2026-11-23T09:00:00Z',
    })
  })

  it('exige sessão antes de chamar a function', async () => {
    sessaoMock.mockResolvedValue({ data: { session: null }, error: null } as never)
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof fetch

    await expect(sugerirRotasGoogle({
      origin: 'Origem',
      destination: 'Destino',
      departureTime: '2026-11-23T09:00:00Z',
    })).rejects.toThrow('Usuário não autenticado')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('propaga o erro da function', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401 }),
    ) as typeof fetch

    await expect(sugerirRotasGoogle({
      origin: 'Origem',
      destination: 'Destino',
      departureTime: '2026-11-23T09:00:00Z',
    })).rejects.toThrow('Sessão inválida')
  })
})
