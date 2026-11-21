import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FatosCartaoMotor } from '@/lib/vt/motor/tipos'

const mocks = vi.hoisted(() => ({
  sugerirRotasGoogle: vi.fn(),
  salvarEscolhaComRevisao: vi.fn(),
  buscarDecisaoPorTrajeto: vi.fn(),
}))

vi.mock('@/services/vtRotaApi', () => ({ sugerirRotasGoogle: mocks.sugerirRotasGoogle }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/vt/repositorioItinerarioSupabase', () => ({
  RepositorioItinerarioSupabase: class {
    buscarDecisaoPorTrajeto = mocks.buscarDecisaoPorTrajeto
    buscarItinerarioPorId = vi.fn().mockResolvedValue(null)
    salvarEscolhaComRevisao = mocks.salvarEscolhaComRevisao
    confirmarDecisaoAberta = vi.fn()
  },
}))

import { VtRevisaoRota, type ContextoRevisaoRotaReal } from './VtRevisaoRota'

const DECISAO_ID = '10000000-0000-4000-8000-000000000001'
const ATIVADO: FatosCartaoMotor = { situacaoBu: 'Ativado', consultadoEm: '2026-10-28', bunConfirmadoNoPortal: null }

const RESPOSTA_416M = {
  routes: [{
    distanceMeters: 15000,
    duration: '2400s',
    legs: [{
      steps: [{
        travelMode: 'TRANSIT',
        transitDetails: {
          stopDetails: {
            departureStop: { name: 'Alcântara, terminal' },
            arrivalStop: { name: 'Centro de Niterói' },
            departureTime: '2026-11-23T09:00:00Z',
            arrivalTime: '2026-11-23T09:40:00Z',
          },
          transitLine: { nameShort: '416M', name: 'Niterói - Manilha', vehicle: { type: 'BUS' }, agencies: [{ name: 'Viação Teste' }] },
        },
      }],
    }],
  }],
}

function contexto(): ContextoRevisaoRotaReal {
  return {
    trajetoLegadoId: 'trajeto-1',
    colaboradorId: '20000000-0000-4000-8000-000000000002',
    departamentoId: '30000000-0000-4000-8000-000000000003',
    usuarioId: '40000000-0000-4000-8000-000000000004',
    origem: 'CASA, São Gonçalo - RJ',
    destino: 'POSTO, Niterói - RJ',
    municipioOrigem: 'São Gonçalo',
    municipioDestino: 'Niterói',
    precisao: 'exata',
    cartao: ATIVADO,
  }
}

describe('VtRevisaoRota — trecho (seção) DETRO', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buscarDecisaoPorTrajeto.mockResolvedValue({ id: DECISAO_ID, status: 'sugerida', itinerario_id: null })
    mocks.sugerirRotasGoogle.mockResolvedValue(RESPOSTA_416M)
    mocks.salvarEscolhaComRevisao.mockImplementation(async (entrada) => ({
      decisaoId: DECISAO_ID,
      repetido: false,
      evidencia: {
        id: 'ev-1',
        alternativa_id: entrada.alternativa.id,
        itinerario: entrada.alternativa.itinerario,
        consultado_em: entrada.alternativa.itinerario.consultadoEm,
        evidencia_hash: 'hash',
      },
    }))
  })

  it('mostra o seletor, bloqueia sem escolha, calcula pelo trecho e grava a seção na evidência', async () => {
    render(<VtRevisaoRota contextoReal={contexto()} />)
    await waitFor(() => expect(mocks.buscarDecisaoPorTrajeto).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar ida e volta' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Consultar ida e volta' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Ida — alternativa 1' }))
    // A volta (mesma rota, sentido contrário) é pré-marcada; sem trecho escolhido, nada é salvável.
    await screen.findByTestId('volta-recolhida')

    const seletor = screen.getByLabelText('Trecho pago — condução 1 (ida)') as HTMLSelectElement
    expect(seletor.value).toBe('')
    expect(screen.getByRole('option', { name: /Alcântara - Niterói — R\$\s*7,10/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Percurso inteiro .* — R\$\s*15,10/ })).toBeInTheDocument()
    expect(screen.getByTestId('secao-linha-1')).toHaveTextContent('Alcântara, terminal')
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent('Escolha o trecho (seção) pago da linha 416M')
    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeDisabled()

    fireEvent.change(seletor, { target: { value: '2' } })
    // A volta pré-marcada herda o trecho da ida.
    expect(screen.getByRole('region', { name: 'Valor do dia' })).toHaveTextContent('Total do dia: R$ 14,20')
    const salvar = screen.getByRole('button', { name: 'Salvar itinerário escolhido' })
    expect(salvar).toBeEnabled()

    fireEvent.click(salvar)
    await waitFor(() => expect(mocks.salvarEscolhaComRevisao).toHaveBeenCalledTimes(1))
    const [entrada] = mocks.salvarEscolhaComRevisao.mock.calls[0]
    expect(entrada.custoDiarioCentavos).toBe(1420)
    const pernas = entrada.alternativa.itinerario.pernas
    expect(pernas.map((p: { sentido: string; secaoDetro?: number }) => `${p.sentido}:${p.secaoDetro}`)).toEqual(['ida:2', 'volta:2'])
    expect(entrada.alternativa.itinerario.calculoMotor.secoesDetro).toEqual([
      expect.objectContaining({ sentido: 'ida', linha: '416M', secao: 2, valorCentavos: 710 }),
      expect.objectContaining({ sentido: 'volta', linha: '416M', secao: 2, valorCentavos: 710 }),
    ])
  })
})
