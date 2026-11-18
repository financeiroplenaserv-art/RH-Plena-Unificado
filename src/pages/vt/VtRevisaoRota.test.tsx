import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RESPOSTA_ACACIO, RESPOSTA_ALCEMIR } from '@/lib/vt/googleRoutesFixture'
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

function contexto(cartao: FatosCartaoMotor): ContextoRevisaoRotaReal {
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
    cartao,
  }
}

const ATIVADO: FatosCartaoMotor = { situacaoBu: 'Ativado', consultadoEm: '2026-10-28', bunConfirmadoNoPortal: null }
const SUSPENSO: FatosCartaoMotor = { situacaoBu: 'Suspenso Setrans', consultadoEm: '2026-10-28', bunConfirmadoNoPortal: null }

async function consultarIdaEVolta() {
  await waitFor(() => expect(mocks.buscarDecisaoPorTrajeto).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar ida no Google' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Consultar ida no Google' }))
  await screen.findByRole('button', { name: 'Ida — alternativa 4' })
  fireEvent.change(screen.getByLabelText('Saída do posto (volta)'), { target: { value: '17:30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Consultar volta no Google' }))
  await screen.findByRole('button', { name: 'Volta — alternativa 1' })
}

describe('VtRevisaoRota com o motor novo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buscarDecisaoPorTrajeto.mockResolvedValue({ id: DECISAO_ID, status: 'sugerida', itinerario_id: null })
    // Ida: alternativas reais do Alcemir. Volta: 39A (uma condução) do Acacio.
    mocks.sugerirRotasGoogle.mockImplementation(async ({ origin }: { origin: string }) =>
      origin.startsWith('CASA') ? RESPOSTA_ALCEMIR : RESPOSTA_ACACIO)
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

  it('consulta a volta com origem e destino invertidos e horário editável', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await consultarIdaEVolta()

    const [ida, volta] = mocks.sugerirRotasGoogle.mock.calls.map((c) => c[0])
    expect(ida).toMatchObject({ origin: 'CASA, São Gonçalo - RJ', destination: 'POSTO, Niterói - RJ' })
    expect(volta).toMatchObject({ origin: 'POSTO, Niterói - RJ', destination: 'CASA, São Gonçalo - RJ' })
    // 06:00 e 17:30 em Brasília = 09:00 e 20:30 UTC.
    expect(ida.departureTime).toMatch(/T09:00:00\.000Z$/)
    expect(volta.departureTime).toMatch(/T20:30:00\.000Z$/)
  })

  it('ordena por custo, marca "Mais em conta" sem escolher e só salva com ida + volta', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await consultarIdaEVolta()

    const secaoIda = screen.getByRole('region', { name: 'Ida (casa → posto)' })
    const cartoes = within(secaoIda).getAllByRole('button', { name: /^Ida — alternativa/ })
    expect(cartoes[0]).toHaveAccessibleName('Ida — alternativa 4')
    expect(within(cartoes[0]).getByText('Mais em conta')).toBeInTheDocument()
    expect(within(cartoes[0]).getByText('R$ 5,60 por sentido')).toBeInTheDocument()
    expect(cartoes.every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(true)

    const salvar = screen.getByRole('button', { name: 'Salvar itinerário escolhido' })
    expect(salvar).toBeDisabled()
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent('Escolha uma alternativa de ida e uma de volta.')

    fireEvent.click(cartoes[0])
    expect(salvar).toBeDisabled()
    expect(screen.getAllByText(/Como o valor foi calculado/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))
    const resumo = screen.getByRole('region', { name: 'Valor do dia' })
    expect(resumo).toHaveTextContent('Total do dia: R$ 11,20')
    expect(salvar).toBeEnabled()

    fireEvent.click(salvar)
    await waitFor(() => expect(mocks.salvarEscolhaComRevisao).toHaveBeenCalledTimes(1))
    const [entrada, trajetoId] = mocks.salvarEscolhaComRevisao.mock.calls[0]
    expect(trajetoId).toBe('trajeto-1')
    expect(entrada).toMatchObject({ cotacaoId: 'motor_v1', cotacaoStatus: 'confirmavel', custoDiarioCentavos: 1120 })
    expect(entrada.alternativa.itinerario.pernas.map((p: { sentido: string; linha: string }) => `${p.sentido}:${p.linha}`))
      .toEqual(['ida:62', 'ida:39A', 'volta:39A'])
    expect(entrada.alternativa.itinerario.calculoMotor).toMatchObject({ valorDiaCentavos: 1120, versao: 'motor_v1' })
  })

  it('BU Suspenso Setrans: 62 + 39A custa R$ 11,20 por sentido, fica pendente e bloqueia o salvar', async () => {
    render(<VtRevisaoRota contextoReal={contexto(SUSPENSO)} />)
    await consultarIdaEVolta()

    const cartao62 = screen.getByRole('button', { name: 'Ida — alternativa 4' })
    expect(within(cartao62).getByText('R$ 11,20 por sentido')).toBeInTheDocument()
    expect(within(cartao62).getByText('Pendente')).toBeInTheDocument()

    fireEvent.click(cartao62)
    fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))

    const resumo = screen.getByRole('region', { name: 'Valor do dia' })
    expect(resumo).toHaveTextContent('Total do dia: R$ 16,80')
    expect(within(resumo).getByText(/BUN provável, mas não comprovado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeDisabled()
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent(/pendente/)
    expect(mocks.salvarEscolhaComRevisao).not.toHaveBeenCalled()
  })

  it('alternativa indeterminada fica por último e bloqueia o salvar', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await consultarIdaEVolta()

    const cartoes = within(screen.getByRole('region', { name: 'Ida (casa → posto)' })).getAllByRole('button', { name: /^Ida — alternativa/ })
    const ultimo = cartoes[cartoes.length - 1]
    expect(within(ultimo).getByText('Valor indeterminado')).toBeInTheDocument()

    fireEvent.click(ultimo)
    fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))
    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeDisabled()
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent(/indeterminado|pendente/)
  })

  it('horário inválido da volta mostra erro e não consulta', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar volta no Google' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Saída do posto (volta)'), { target: { value: '25:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar volta no Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Horário inválido')
    expect(mocks.sugerirRotasGoogle).not.toHaveBeenCalled()
  })
})
