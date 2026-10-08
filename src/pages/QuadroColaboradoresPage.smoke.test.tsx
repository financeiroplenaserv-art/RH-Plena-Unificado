import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Perfil } from '@/types/database'

const perfilAdmin: Perfil = {
  id: 'u1',
  email: 'admin@example.com',
  nome: 'Admin Teste',
  nivel_acesso: 'admin',
  empresa_id: null,
  consentimento_lgpd: true,
  consentimento_lgpd_data: null,
  consentimento_lgpd_versao: null,
  consentimento_lgpd_finalidades: null,
  created_at: '2026-01-01T00:00:00Z',
}

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: perfilAdmin, loading: false }),
}))

// builder encadeável que resolve listas vazias em qualquer consulta
function criarBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {}
  const metodos = ['select', 'eq', 'in', 'gte', 'not', 'order', 'limit', 'update', 'insert', 'upsert', 'neq']
  for (const m of metodos) b[m] = vi.fn(() => criarBuilder())
  b.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null })
  return b
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => criarBuilder()), storage: { from: vi.fn() } },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import { QuadroColaboradoresPage } from '@/pages/QuadroColaboradoresPage'

describe('QuadroColaboradoresPage (smoke)', () => {
  it('renderiza sem travar', async () => {
    render(
      <MemoryRouter>
        <QuadroColaboradoresPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Quadro de Colaboradores')).toBeTruthy()
    expect(screen.getByText(/Adicionar posto/i)).toBeTruthy()
  })
})
