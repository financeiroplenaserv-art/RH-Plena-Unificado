import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Perfil } from '@/types/database'

const perfilMesa: Perfil = {
  id: 'u1',
  email: 'teste.mesa@example.com',
  nome: 'Mesa Teste',
  nivel_acesso: 'mesa',
  empresa_id: null,
  consentimento_lgpd: true,
  consentimento_lgpd_data: null,
  consentimento_lgpd_versao: null,
  consentimento_lgpd_finalidades: null,
  created_at: '2026-01-01T00:00:00Z',
}

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: perfilMesa, loading: false }),
}))

vi.mock('@/hooks/useCEUEntregas', () => ({
  useCEUEntregas: () => ({
    entregas: [],
    loading: false,
    paginacao: null,
    listar: vi.fn(),
    listarPaginado: vi.fn(),
    devolver: vi.fn(),
    remover: vi.fn(),
    marcarReciboEmitido: vi.fn(),
    marcarLoteReciboEmitido: vi.fn(),
  }),
}))

vi.mock('@/hooks/useCEUItens', () => ({
  useCEUItens: () => ({ itens: [], loading: false, listar: vi.fn(), remover: vi.fn() }),
}))

vi.mock('@/hooks/useCEUFornecedores', () => ({
  useCEUFornecedores: () => ({ fornecedores: [], loading: false, listar: vi.fn(), criar: vi.fn(), atualizar: vi.fn(), remover: vi.fn() }),
}))

vi.mock('@/components/ceu/CeuReciboModal', () => ({
  CeuReciboModal: () => null,
}))

import { CeuMovimentacoesPage } from '@/pages/ceu/CeuMovimentacoesPage'
import { CeuItensPage } from '@/pages/ceu/CeuItensPage'
import { CeuFornecedoresPage } from '@/pages/ceu/CeuFornecedoresPage'

function renderizar(componente: React.ReactElement) {
  return render(<MemoryRouter>{componente}</MemoryRouter>)
}

describe('Páginas CEU — smoke test de renderização', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CeuMovimentacoesPage renderiza sem erro', () => {
    renderizar(<CeuMovimentacoesPage />)
    expect(screen.getAllByText('Movimentações').length).toBeGreaterThan(0)
  })

  it('CeuItensPage renderiza sem erro', () => {
    renderizar(<CeuItensPage />)
    expect(screen.getByText('Itens CEU')).toBeTruthy()
  })

  it('CeuFornecedoresPage renderiza sem erro', () => {
    renderizar(<CeuFornecedoresPage />)
    expect(screen.getAllByText('Fornecedores').length).toBeGreaterThan(0)
  })
})
