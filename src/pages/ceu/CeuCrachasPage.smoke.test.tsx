import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Perfil } from '@/types/database'
import { setPermissoesCache } from '@/lib/permissoes'

const perfilDp3: Perfil = {
  id: 'u3',
  email: 'estagiaria@example.com',
  nome: 'Estagiária',
  nivel_acesso: 'dp3',
  empresa_id: null,
  consentimento_lgpd: true,
  consentimento_lgpd_data: null,
  consentimento_lgpd_versao: null,
  consentimento_lgpd_finalidades: null,
  created_at: '2026-01-01T00:00:00Z',
}

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: perfilDp3, loading: false }),
}))

const colaboradores = [
  {
    id: 'c1',
    matricula: '000001',
    nome_completo: 'Maria Aparecida da Silva',
    cargo: 'Copeira',
    departamento: 'Posto A',
    departamento_id: null,
    empresa_id: null,
    nome_cracha: null,
    foto_path: null,
  },
  {
    id: 'c2',
    matricula: '000002',
    nome_completo: 'José Pereira',
    cargo: null,
    departamento: 'Posto A',
    departamento_id: null,
    empresa_id: null,
    nome_cracha: 'Zé',
    foto_path: null,
  },
]

// Query builder encadeável: resolve com os dados da tabela consultada
function consulta(tabela: string) {
  const dados = tabela === 'colaboradores' ? colaboradores : []
  const resultado = { data: dados, error: null }
  const builder: Record<string, unknown> = {}
  const encadeaveis = ['select', 'eq', 'neq', 'not', 'order', 'range']
  encadeaveis.forEach((m) => {
    builder[m] = () => builder
  })
  // .in('id', ids) filtra as linhas pelos ids pedidos
  builder.in = (_coluna: string, ids: string[]) => {
    resultado.data = dados.filter((d) => ids.includes(d.id))
    return builder
  }
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
  builder.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok)
  return builder
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabela: string) => consulta(tabela),
    rpc: vi.fn(),
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}))

// Autocomplete real faz buscas com debounce; aqui basta um botão que "escolhe" colaboradores
vi.mock('@/components/AutocompleteColaborador', () => ({
  AutocompleteColaborador: ({ onChange }: { onChange: (c: { id: string; nome_completo: string } | null) => void }) => (
    <div>
      <button onClick={() => onChange({ id: 'c1', nome_completo: 'Maria Aparecida da Silva' })}>escolher Maria</button>
      <button onClick={() => onChange({ id: 'c2', nome_completo: 'José Pereira' })}>escolher José</button>
    </div>
  ),
}))

import { CeuCrachasPage } from '@/pages/ceu/CeuCrachasPage'

function renderizar() {
  return render(
    <MemoryRouter>
      <CeuCrachasPage />
    </MemoryRouter>
  )
}

describe('CeuCrachasPage — smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // linhas dinâmicas do dp3 (migration 117)
    setPermissoesCache([
      { perfil: 'dp3', recurso: 'ceu', acao: 'emitir_cracha', permitido: true },
      { perfil: 'dp3', recurso: 'menu', acao: 'crachas', permitido: true },
    ])
  })

  it('mostra só a aba Crachás para o dp3, a orientação de impressão e avisa seleção vazia', async () => {
    renderizar()
    expect(screen.getByText('Adicionar colaborador')).toBeTruthy()
    // dp3 não tem rota.ceu: sem as demais abas do CEU
    expect(screen.queryByText('Movimentações')).toBeNull()
    expect(screen.getAllByText('Crachás').length).toBeGreaterThan(0)
    expect(screen.getByText(/Tamanho real/)).toBeTruthy()
    // sem lista completa de colaboradores nem seção de aparência para o dp3
    expect(screen.queryByText('Colaboradores ativos')).toBeNull()
    expect(screen.queryByText('Aparência dos crachás por empresa')).toBeNull()

    fireEvent.click(screen.getByText('Emitir crachás'))
    expect((await screen.findAllByText('Selecione ao menos um colaborador')).length).toBeGreaterThan(0)
  })

  it('escolher colaborador monta a fila com nome e função pré-preenchidos; sem função avisa', async () => {
    renderizar()
    fireEvent.click(screen.getByText('escolher José'))
    await waitFor(() => expect(screen.getByText('Fila de crachás (1)')).toBeTruthy())
    // nome_cracha salvo vem pré-preenchido
    expect((screen.getByDisplayValue('Zé') as HTMLInputElement).value).toBe('Zé')
    expect(screen.getByText('Voltar ao nome do cadastro')).toBeTruthy()
    // cargo vazio: aviso e campo de função editável
    expect(screen.getByText(/Sem função/)).toBeTruthy()
    expect(screen.getByText('Função no crachá')).toBeTruthy()
    expect(screen.getByText(/1 crachá\(s\) em 1 folha\(s\) A4/)).toBeTruthy()
  })

  it('editar a função mostra "Voltar à função do cadastro" e tira o aviso', async () => {
    renderizar()
    fireEvent.click(screen.getByText('escolher José'))
    await waitFor(() => expect(screen.getByText('Fila de crachás (1)')).toBeTruthy())
    const campo = screen.getByText('Função no crachá').nextElementSibling as HTMLInputElement
    fireEvent.change(campo, { target: { value: 'Vigia' } })
    expect(screen.getByText('Voltar à função do cadastro')).toBeTruthy()
    expect(screen.queryByText(/Sem função/)).toBeNull()
  })

  it('colaborador repetido não duplica na fila', async () => {
    renderizar()
    fireEvent.click(screen.getByText('escolher Maria'))
    await waitFor(() => expect(screen.getByText('Fila de crachás (1)')).toBeTruthy())
    fireEvent.click(screen.getByText('escolher Maria'))
    await waitFor(() => expect(screen.getByText('Fila de crachás (1)')).toBeTruthy())
  })
})
