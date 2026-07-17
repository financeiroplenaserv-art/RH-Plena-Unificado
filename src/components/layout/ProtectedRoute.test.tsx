import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import * as permissoes from '@/lib/permissoes'
import type { Perfil } from '@/types/database'

const mockVerificarPermissao = vi.fn()

vi.mock('@/lib/permissoes', async (importOriginal) => {
  const mod = await importOriginal<typeof permissoes>()
  return {
    ...mod,
    verificarPermissao: (...args: Parameters<typeof permissoes.verificarPermissao>) =>
      mockVerificarPermissao(...args),
  }
})

function usuarioMock(nivel: Perfil['nivel_acesso'] = 'visualizador'): Perfil {
  return {
    id: 'user-1',
    email: 'usuario@exemplo.com',
    nome: 'Usuário',
    nivel_acesso: nivel,
    empresa_id: null,
    consentimento_lgpd: false,
    consentimento_lgpd_data: null,
    consentimento_lgpd_versao: null,
    consentimento_lgpd_finalidades: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function renderWithRouter(
  element: React.ReactElement,
  initialEntry = '/protegida'
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<div data-testid="home">Home</div>} />
        <Route path="/protegida" element={element} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockVerificarPermissao.mockReset()
  })

  it('renderiza children quando permissão dinâmica é concedida', () => {
    mockVerificarPermissao.mockReturnValue(true)
    renderWithRouter(
      <ProtectedRoute user={usuarioMock('rh')} permissao={{ recurso: 'ocorrencia', acao: 'criar' }}>
        <div data-testid="conteudo">Conteúdo</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('conteudo')).toBeInTheDocument()
    expect(mockVerificarPermissao).toHaveBeenCalledWith('rh', 'ocorrencia', 'criar')
  })

  it('redireciona para / quando permissão dinâmica é negada', () => {
    mockVerificarPermissao.mockReturnValue(false)
    renderWithRouter(
      <ProtectedRoute user={usuarioMock('visualizador')} permissao={{ recurso: 'ocorrencia', acao: 'criar' }}>
        <div data-testid="conteudo">Conteúdo</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(screen.queryByTestId('conteudo')).not.toBeInTheDocument()
  })

  it('renderiza fallback quando permissão dinâmica é negada e fallback é fornecido', () => {
    mockVerificarPermissao.mockReturnValue(false)
    renderWithRouter(
      <ProtectedRoute
        user={usuarioMock('visualizador')}
        permissao={{ recurso: 'ocorrencia', acao: 'criar' }}
        fallback={<div data-testid="fallback">Acesso negado</div>}
      >
        <div data-testid="conteudo">Conteúdo</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('conteudo')).not.toBeInTheDocument()
  })

  it('renderiza children quando nível mínimo é satisfeito', () => {
    renderWithRouter(
      <ProtectedRoute user={usuarioMock('gestor')} nivelMinimo={['gestor', 'rh']}>
        <div data-testid="conteudo">Conteúdo</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('conteudo')).toBeInTheDocument()
  })

  it('redireciona para / quando nível mínimo é negado', () => {
    renderWithRouter(
      <ProtectedRoute user={usuarioMock('visualizador')} nivelMinimo="admin">
        <div data-testid="conteudo">Conteúdo</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(screen.queryByTestId('conteudo')).not.toBeInTheDocument()
  })

  it('renderiza fallback quando nível mínimo é negado e fallback é fornecido', () => {
    renderWithRouter(
      <ProtectedRoute
        user={usuarioMock('visualizador')}
        nivelMinimo="admin"
        fallback={<div data-testid="fallback">Acesso negado</div>}
      >
        <div data-testid="conteudo">Conteúdo</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('fallback')).toBeInTheDocument()
  })

  it('renderiza children quando nível mínimo é omitido', () => {
    renderWithRouter(
      <ProtectedRoute user={usuarioMock('visualizador')}>
        <div data-testid="conteudo">Conteúdo</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('conteudo')).toBeInTheDocument()
  })

  it('array de nível mínimo vazio significa qualquer usuário autenticado', () => {
    renderWithRouter(
      <ProtectedRoute user={usuarioMock('visualizador')} nivelMinimo={[]}>
        <div data-testid="conteudo">Conteúdo</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('conteudo')).toBeInTheDocument()
  })
})
