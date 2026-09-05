import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    listar: vi.fn().mockResolvedValue([]),
    listarPaginado: vi.fn(),
    criarLote: vi.fn().mockResolvedValue([]),
    devolver: vi.fn(),
    remover: vi.fn(),
    marcarReciboEmitido: vi.fn(),
    marcarLoteReciboEmitido: vi.fn(),
    proximoNumeroRecibo: vi.fn().mockResolvedValue('REC-2026-00001'),
    registrarEmissaoRecibo: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('@/hooks/useColaboradores', () => ({
  useColaboradores: () => ({ colaboradores: [], loading: false, listarResumido: vi.fn().mockResolvedValue([]) }),
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
import { CeuImportarPage } from '@/pages/ceu/CeuImportarPage'

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

  it('CeuImportarPage renderiza sem erro e oferece importação de entregas', async () => {
    renderizar(<CeuImportarPage />)
    expect(screen.getByText('Importar CEU')).toBeTruthy()
    // abre o tipo "Entregas" e mostra os campos de data/situação
    fireEvent.click(screen.getByText('Entregas (EPI/Uniforme)'))
    expect(await screen.findByText('Data da entrega')).toBeTruthy()
    expect(screen.getByText('Situação')).toBeTruthy()
  })
})
