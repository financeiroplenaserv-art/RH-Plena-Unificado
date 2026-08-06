import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { LocalTrabalhoDiario, LocalTrabalho } from '@/types/database'

// Dados de exemplo: 2 dias "Não identificado" do mesmo colaborador (caso DAMIAO)
const DIAS: LocalTrabalhoDiario[] = [
  {
    id: 'd1',
    colaborador_id: 'c1',
    data: '2026-06-24',
    local_trabalho_id: null,
    fonte: 'nao_identificado',
    usuario_confirmacao_id: null,
    confirmado_em: null,
    observacao: null,
    importacao_ref: null,
    created_at: '',
    updated_at: '',
    colaborador: { id: 'c1', nome_completo: 'DAMIAO SANTANA GADELHA', matricula: '000821', cargo: 'ASG' },
    local_trabalho: null,
  } as unknown as LocalTrabalhoDiario,
  {
    id: 'd2',
    colaborador_id: 'c1',
    data: '2026-06-26',
    local_trabalho_id: null,
    fonte: 'nao_identificado',
    usuario_confirmacao_id: null,
    confirmado_em: null,
    observacao: null,
    importacao_ref: null,
    created_at: '',
    updated_at: '',
    colaborador: { id: 'c1', nome_completo: 'DAMIAO SANTANA GADELHA', matricula: '000821', cargo: 'ASG' },
    local_trabalho: null,
  } as unknown as LocalTrabalhoDiario,
]

const LOCAIS: LocalTrabalho[] = [
  { id: 'l1', nome: 'Posto Alpha', nome_curto: 'Alpha', status: 'Ativo', observacao: null, created_at: '', updated_at: '' } as unknown as LocalTrabalho,
  { id: 'l2', nome: 'Posto Beta', nome_curto: 'Beta', status: 'Ativo', observacao: null, created_at: '', updated_at: '' } as unknown as LocalTrabalho,
]

const aplicarEmLoteMock = vi.fn().mockResolvedValue(true)
const confirmarManualMock = vi.fn().mockResolvedValue(true)
const buscarHistoricoMock = vi.fn().mockResolvedValue([])

// Objeto estável: o componente usa useEffect encadeado nos callbacks do hook;
// funções novas a cada render causariam loop infinito de rerenders no teste
// (no app real o hook usa useCallback, então as identidades são estáveis).
const hookEscalasDiario = {
  dias: DIAS,
  loading: false,
  listar: vi.fn().mockResolvedValue(DIAS),
  listarTodos: vi.fn().mockResolvedValue(DIAS),
  confirmarManual: confirmarManualMock,
  aplicarEmLote: aplicarEmLoteMock,
  buscarHistoricoColaborador: buscarHistoricoMock,
}

vi.mock('@/hooks/useEscalasDiario', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/hooks/useEscalasDiario')>()
  return {
    ...original,
    useEscalasDiario: () => hookEscalasDiario,
  }
})

vi.mock('@/hooks/useEscalasLocais', () => ({
  useEscalasLocais: () => ({ locais: LOCAIS, listar: vi.fn() }),
}))

vi.mock('@/hooks/useColaboradores', () => ({
  useColaboradores: () => ({ colaboradores: [], listarResumido: vi.fn() }),
}))

// Select nativo no lugar do Radix: jsdom não lida bem com pointer events do Radix.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))

import { AbaEscalasDiario } from './AbaEscalasDiario'

function renderizar() {
  return render(
    <MemoryRouter>
      <AbaEscalasDiario />
    </MemoryRouter>
  )
}

describe('AbaEscalasDiario — confirmação de local', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('selecionar vários dias mostra a barra "Confirmar em lote" e aplica o local nos dias marcados', async () => {
    renderizar()

    // 3 checkboxes: cabeçalho + 2 linhas
    const caixas = screen.getAllByRole('checkbox')
    expect(caixas).toHaveLength(3)

    fireEvent.click(caixas[1])
    fireEvent.click(caixas[2])

    // A barra de confirmação em lote aparece com a contagem de dias
    const barra = await screen.findByText('Aplicar local em 2 dia(s)')
    expect(barra).toBeTruthy()

    const card = barra.closest('section,div[class*="card"],div')!.parentElement!
    const selectLocal = within(card as HTMLElement).getByRole('combobox')
    fireEvent.change(selectLocal, { target: { value: 'l1' } })

    fireEvent.click(screen.getByRole('button', { name: /Confirmar em lote/i }))

    await waitFor(() => {
      expect(aplicarEmLoteMock).toHaveBeenCalledWith(['d1', 'd2'], 'l1', '')
    })
  })

  it('modal mostra "Locais usados recentemente" com contagem quando o colaborador tem histórico', async () => {
    buscarHistoricoMock.mockResolvedValue([
      { id: 'h1', colaborador_id: 'c1', data: '2026-05-01', local_trabalho_id: 'l1', fonte: 'manual', observacao: null, local_trabalho: LOCAIS[0] },
      { id: 'h2', colaborador_id: 'c1', data: '2026-05-03', local_trabalho_id: 'l1', fonte: 'dispositivo', observacao: null, local_trabalho: LOCAIS[0] },
      { id: 'h3', colaborador_id: 'c1', data: '2026-05-05', local_trabalho_id: 'l2', fonte: 'manual', observacao: null, local_trabalho: LOCAIS[1] },
    ])

    renderizar()
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirmar' })[0])

    expect(await screen.findByText('Locais usados recentemente por este colaborador')).toBeTruthy()
    // Local mais frequente aparece primeiro, com a contagem de usos
    expect(await screen.findByRole('button', { name: 'Alpha (2x)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Beta (1x)' })).toBeTruthy()
  })

  it('modal omite a seção de locais recentes quando o colaborador não tem nenhum dia identificado', async () => {
    buscarHistoricoMock.mockResolvedValue([])

    renderizar()
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirmar' })[0])

    expect(await screen.findByText('Confirmar local')).toBeTruthy()
    expect(screen.queryByText('Locais usados recentemente por este colaborador')).toBeNull()
  })
})
