import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAuth } from './useAuth'
import type { Perfil } from '@/types/database'

const {
  mockFrom,
  mockGetSession,
  mockOnAuthStateChange,
  mockUnsubscribe,
  mockSignIn,
  mockSignUp,
  mockSignOut,
  mockSetPermissoesCache,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockUnsubscribe: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockSetPermissoesCache: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
}))

vi.mock('@/lib/permissoes', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/permissoes')>()
  return {
    ...mod,
    setPermissoesCache: (...args: Parameters<typeof import('@/lib/permissoes').setPermissoesCache>) =>
      mockSetPermissoesCache(...args),
  }
})

function criarPerfil(nivel: Perfil['nivel_acesso'] = 'visualizador'): Perfil {
  return {
    id: 'auth-1',
    email: 'usuario@exemplo.com',
    nome: 'usuario',
    nivel_acesso: nivel,
    empresa_id: null,
    consentimento_lgpd: false,
    consentimento_lgpd_data: null,
    consentimento_lgpd_versao: null,
    consentimento_lgpd_finalidades: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function mockarPerfilExistente(perfil: Perfil) {
  const single = vi.fn().mockResolvedValue({ data: perfil, error: null })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mockFrom.mockImplementation((tabela: string) => {
    if (tabela === 'perfis') {
      return { select }
    }
    if (tabela === 'permissoes_perfil') {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) }
    }
    return { select: vi.fn() }
  })
  return { select, eq, single }
}

// O useAuth usa apenas onAuthStateChange (INITIAL_SESSION) para a sessão
// inicial. Este helper faz o mock disparar o callback com a sessão dada.
function mockarSessaoInicial(session: { user?: { id: string; email?: string | null } } | null) {
  mockOnAuthStateChange.mockImplementation((cb: (event: string, sessao: unknown) => void) => {
    queueMicrotask(() => cb('INITIAL_SESSION', session))
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
  })
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } })
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockarSessaoInicial(null)
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('inicializa sem sessão: user null e loading false', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })

  it('inicializa com sessão ativa e carrega perfil', async () => {
    const perfil = criarPerfil('rh')
    mockarSessaoInicial({ user: { id: 'auth-1', email: 'usuario@exemplo.com' } })
    mockarPerfilExistente(perfil)

    const { result, unmount } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.user).not.toBeNull())

    expect(result.current.user).toEqual(perfil)
    expect(result.current.loading).toBe(false)
    expect(mockSetPermissoesCache).toHaveBeenCalledWith([])
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('login chama signInWithPassword e carrega perfil', async () => {
    const perfil = criarPerfil('gestor')
    mockSignIn.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'usuario@exemplo.com' }, session: {} },
      error: null,
    })
    mockarPerfilExistente(perfil)

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.login('usuario@exemplo.com', 'senha123')
    })

    await waitFor(() => expect(result.current.user).not.toBeNull())
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'usuario@exemplo.com', password: 'senha123' })
    expect(result.current.user).toEqual(perfil)
    // O perfil nunca é persistido no localStorage (PII fora de alcance de XSS)
    expect(localStorage.getItem('plena_perfil')).toBeNull()
  })

  it('signUp cria perfil com nível padrão visualizador, nunca admin', async () => {
    const novoPerfil = criarPerfil('visualizador')
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'usuario@exemplo.com' }, session: {} },
      error: null,
    })
    const { single, select } = mockarPerfilExistente(novoPerfil)
    single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: novoPerfil, error: null }) }) })
    mockFrom.mockImplementation((tabela: string) => {
      if (tabela === 'perfis') {
        return {
          select,
          insert,
        }
      }
      if (tabela === 'permissoes_perfil') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) }
      }
      return { select: vi.fn() }
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const authUser = await act(async () => {
      return await result.current.signUp('usuario@exemplo.com', 'senha123')
    })

    expect(mockSignUp).toHaveBeenCalledWith({ email: 'usuario@exemplo.com', password: 'senha123' })
    expect(authUser).toEqual({ id: 'auth-1', email: 'usuario@exemplo.com' })
    await waitFor(() => {
      expect(result.current.user).not.toBeNull()
    })
    expect(result.current.user?.nivel_acesso).toBe('visualizador')
    expect(result.current.user?.nivel_acesso).not.toBe('admin')
  })

  it('logout limpa estado e localStorage', async () => {
    const perfil = criarPerfil('rh')
    mockarSessaoInicial({ user: { id: 'auth-1', email: 'usuario@exemplo.com' } })
    mockarPerfilExistente(perfil)

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.user).not.toBeNull())
    localStorage.setItem('plena_perfil', JSON.stringify(perfil))

    mockSignOut.mockResolvedValue({ error: null })
    await act(async () => {
      await result.current.logout()
    })

    await waitFor(() => expect(result.current.user).toBeNull())
    expect(localStorage.getItem('plena_perfil')).toBeNull()
  })

  it('temAcesso retorna true para perfil autorizado e false para não autorizado', async () => {
    const perfil = criarPerfil('rh')
    mockarSessaoInicial({ user: { id: 'auth-1', email: 'usuario@exemplo.com' } })
    mockarPerfilExistente(perfil)

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.user).not.toBeNull())

    expect(result.current.temAcesso('rh')).toBe(true)
    expect(result.current.temAcesso('admin')).toBe(false)
    expect(result.current.temAcesso()).toBe(true)
    expect(result.current.temAcesso([])).toBe(true)
  })

  it('ehAdmin e ehEditor retornam corretamente por perfil', async () => {
    const perfil = criarPerfil('admin')
    mockarSessaoInicial({ user: { id: 'auth-1', email: 'usuario@exemplo.com' } })
    mockarPerfilExistente(perfil)

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.user).not.toBeNull())

    expect(result.current.ehAdmin()).toBe(true)
    expect(result.current.ehEditor()).toBe(true)
  })

  it('visualizador não é admin nem editor', async () => {
    const perfil = criarPerfil('visualizador')
    mockarSessaoInicial({ user: { id: 'auth-1', email: 'usuario@exemplo.com' } })
    mockarPerfilExistente(perfil)

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.user).not.toBeNull())

    expect(result.current.ehAdmin()).toBe(false)
    expect(result.current.ehEditor()).toBe(false)
  })
})
