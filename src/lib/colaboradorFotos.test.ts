import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { limparCacheFotos, urlsAssinadasFotos } from './colaboradorFotos'

function clienteFalso(resposta: unknown) {
  const createSignedUrls = vi.fn().mockResolvedValue(resposta)
  return { cliente: { storage: { from: vi.fn(() => ({ createSignedUrls })) } }, createSignedUrls }
}

describe('urlsAssinadasFotos', () => {
  beforeEach(() => limparCacheFotos())

  it('gera URLs em uma única chamada, ignorando vazios e duplicados', async () => {
    const { cliente, createSignedUrls } = clienteFalso({
      data: [
        { path: 'a.jpg', signedUrl: 'u-a', error: null },
        { path: 'b.jpg', signedUrl: 'u-b', error: null },
      ],
      error: null,
    })
    const m = await urlsAssinadasFotos(['a.jpg', null, 'b.jpg', 'a.jpg', undefined], cliente)
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(createSignedUrls).toHaveBeenCalledWith(['a.jpg', 'b.jpg'], 3600)
    expect(m.get('a.jpg')).toBe('u-a')
    expect(m.get('b.jpg')).toBe('u-b')
  })

  it('usa o cache e só pede o que falta', async () => {
    const um = clienteFalso({ data: [{ path: 'a.jpg', signedUrl: 'u-a', error: null }], error: null })
    await urlsAssinadasFotos(['a.jpg'], um.cliente)
    const dois = clienteFalso({ data: [{ path: 'b.jpg', signedUrl: 'u-b', error: null }], error: null })
    const m = await urlsAssinadasFotos(['a.jpg', 'b.jpg'], dois.cliente)
    expect(dois.createSignedUrls).toHaveBeenCalledWith(['b.jpg'], 3600)
    expect(m.size).toBe(2)
  })

  it('renova quando o cache expirou', async () => {
    const um = clienteFalso({ data: [{ path: 'a.jpg', signedUrl: 'u1', error: null }], error: null })
    await urlsAssinadasFotos(['a.jpg'], um.cliente, 0)
    const dois = clienteFalso({ data: [{ path: 'a.jpg', signedUrl: 'u2', error: null }], error: null })
    const m = await urlsAssinadasFotos(['a.jpg'], dois.cliente, 3600 * 1000)
    expect(m.get('a.jpg')).toBe('u2')
  })

  it('falha ou item com erro devolve mapa parcial sem lançar', async () => {
    const { cliente } = clienteFalso({
      data: [
        { path: 'a.jpg', signedUrl: '', error: 'Object not found' },
        { path: 'b.jpg', signedUrl: 'u-b', error: null },
      ],
      error: null,
    })
    const m = await urlsAssinadasFotos(['a.jpg', 'b.jpg'], cliente)
    expect(m.has('a.jpg')).toBe(false)
    expect(m.get('b.jpg')).toBe('u-b')
    const ruim = clienteFalso({ data: null, error: { message: 'x' } })
    expect((await urlsAssinadasFotos(['c.jpg'], ruim.cliente)).size).toBe(0)
  })
})
