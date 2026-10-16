import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Cenário configurável das respostas do supabase mockado
const cenario = {
  uploadError: null as { message: string } | null,
  listError: null as { message: string } | null,
  objetos: [] as Array<{ name: string; metadata: { size: number } }>,
  insertError: null as { message: string } | null,
  insertData: { id: 'a1' } as Record<string, unknown> | null,
}

const chamadas = {
  upload: [] as string[],
  remove: [] as string[],
  insert: [] as Array<Record<string, unknown>>,
}

vi.mock('@/lib/supabase', () => {
  const storage = {
    from: () => ({
      upload: (path: string) => {
        chamadas.upload.push(path)
        return Promise.resolve({ error: cenario.uploadError })
      },
      list: (_folder: string, opts?: { search?: string }) =>
        Promise.resolve({
          data: cenario.objetos.map((o) => ({ ...o, name: opts?.search ?? o.name })),
          error: cenario.listError,
        }),
      remove: (paths: string[]) => {
        chamadas.remove.push(...paths)
        return Promise.resolve({ error: null })
      },
    }),
  }
  const builder = {
    insert: (linha: Record<string, unknown>) => {
      chamadas.insert.push(linha)
      return builder
    },
    select: () => builder,
    single: () => Promise.resolve({ data: cenario.insertData, error: cenario.insertError }),
  }
  return {
    supabase: {
      storage,
      from: () => builder,
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
      },
    },
  }
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { toast } from 'sonner'
import { useAnexos } from './useAnexos'

function arquivo(nome: string, tamanho: number): File {
  return new File([new Uint8Array(tamanho)], nome, { type: 'image/jpeg' })
}

describe('useAnexos.uploadAnexo', () => {
  beforeEach(() => {
    cenario.uploadError = null
    cenario.listError = null
    cenario.objetos = []
    cenario.insertError = null
    cenario.insertData = { id: 'a1' }
    chamadas.upload = []
    chamadas.remove = []
    chamadas.insert = []
    vi.clearAllMocks()
  })

  it('recusa arquivo de 0 bytes sem chamar o upload', async () => {
    const { result } = renderHook(() => useAnexos())
    let retorno: unknown
    await act(async () => {
      retorno = await result.current.uploadAnexo('oc1', arquivo('vazio.jpeg', 0))
    })
    expect(retorno).toBeNull()
    expect(chamadas.upload).toHaveLength(0)
    expect(toast.error).toHaveBeenCalledOnce()
  })

  it('envia, confere o tamanho gravado e registra com usuario_id', async () => {
    cenario.objetos = [{ name: 'x.jpeg', metadata: { size: 10 } }]
    const { result } = renderHook(() => useAnexos())
    let retorno: unknown
    await act(async () => {
      retorno = await result.current.uploadAnexo('oc1', arquivo('ok.jpeg', 10))
    })
    expect(retorno).toEqual({ id: 'a1' })
    expect(chamadas.upload).toHaveLength(1)
    expect(chamadas.remove).toHaveLength(0)
    expect(chamadas.insert).toHaveLength(1)
    expect(chamadas.insert[0].usuario_id).toBe('u1')
    expect(chamadas.insert[0].tamanho_bytes).toBe(10)
    expect(toast.success).toHaveBeenCalledOnce()
  })

  it('tamanho gravado divergente: apaga o objeto e não registra', async () => {
    cenario.objetos = [{ name: 'x.jpeg', metadata: { size: 0 } }]
    const { result } = renderHook(() => useAnexos())
    let retorno: unknown
    await act(async () => {
      retorno = await result.current.uploadAnexo('oc1', arquivo('truncado.jpeg', 10))
    })
    expect(retorno).toBeNull()
    expect(chamadas.remove).toHaveLength(1)
    expect(chamadas.insert).toHaveLength(0)
    expect(toast.error).toHaveBeenCalledOnce()
  })

  it('objeto não encontrado após o upload: apaga e não registra', async () => {
    cenario.objetos = []
    const { result } = renderHook(() => useAnexos())
    let retorno: unknown
    await act(async () => {
      retorno = await result.current.uploadAnexo('oc1', arquivo('sumiu.jpeg', 10))
    })
    expect(retorno).toBeNull()
    expect(chamadas.remove).toHaveLength(1)
    expect(chamadas.insert).toHaveLength(0)
  })

  it('falha no registro: desfaz o upload (sem objeto órfão)', async () => {
    cenario.objetos = [{ name: 'x.jpeg', metadata: { size: 10 } }]
    cenario.insertError = { message: 'row-level security' }
    const { result } = renderHook(() => useAnexos())
    let retorno: unknown
    await act(async () => {
      retorno = await result.current.uploadAnexo('oc1', arquivo('ok.jpeg', 10))
    })
    expect(retorno).toBeNull()
    expect(chamadas.remove).toEqual(chamadas.upload)
    expect(toast.error).toHaveBeenCalledOnce()
  })
})
