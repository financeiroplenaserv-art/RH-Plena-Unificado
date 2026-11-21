import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RESPOSTA_ACACIO, RESPOSTA_ALCEMIR } from '@/lib/vt/googleRoutesFixture'
import type { FatosCartaoMotor } from '@/lib/vt/motor/tipos'

const mocks = vi.hoisted(() => ({
  sugerirRotasGoogle: vi.fn(),
  salvarEscolhaComRevisao: vi.fn(),
  buscarDecisaoPorTrajeto: vi.fn(),
  buscarTurnosDoPosto: vi.fn(),
}))

vi.mock('@/services/vtRotaApi', async (importar) => ({
  ...(await importar<typeof import('@/services/vtRotaApi')>()),
  sugerirRotasGoogle: mocks.sugerirRotasGoogle,
}))
vi.mock('@/lib/vt/turnosDoPosto', () => ({ buscarTurnosDoPosto: mocks.buscarTurnosDoPosto }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/vt/repositorioItinerarioSupabase', () => ({
  RepositorioItinerarioSupabase: class {
    buscarDecisaoPorTrajeto = mocks.buscarDecisaoPorTrajeto
    buscarItinerarioPorId = vi.fn().mockResolvedValue(null)
    salvarEscolhaComRevisao = mocks.salvarEscolhaComRevisao
    confirmarDecisaoAberta = vi.fn()
  },
}))

import { hojeBrasil } from '@/lib/utils'
import { VtRevisaoRota, type ContextoRevisaoRotaReal } from './VtRevisaoRota'

const DECISAO_ID = '10000000-0000-4000-8000-000000000001'
const ATIVADO: FatosCartaoMotor = { situacaoBu: 'Ativado', consultadoEm: '2026-10-28', bunConfirmadoNoPortal: null }

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
    departamentosApoio: [],
  }
}

function diaRecente(): string {
  const [a, m, d] = hojeBrasil().split('-').map(Number)
  const dt = new Date(a, m - 1, d - 3)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

async function consultarEEscolher() {
  fireEvent.click(screen.getByRole('button', { name: 'Consultar ida no Google' }))
  await screen.findByRole('button', { name: 'Ida — alternativa 4' })
  fireEvent.click(screen.getByRole('button', { name: 'Consultar volta no Google' }))
  await screen.findByRole('button', { name: 'Volta — alternativa 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Ida — alternativa 4' }))
  fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))
}

async function salvar() {
  fireEvent.click(screen.getByRole('button', { name: 'Salvar itinerário escolhido' }))
  await waitFor(() => expect(mocks.salvarEscolhaComRevisao).toHaveBeenCalledTimes(1))
  return mocks.salvarEscolhaComRevisao.mock.calls[0][0].alternativa.itinerario.calculoMotor.horarioReferencia
}

describe('VtRevisaoRota — horário do turno', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buscarTurnosDoPosto.mockResolvedValue([])
    mocks.buscarDecisaoPorTrajeto.mockResolvedValue({ id: DECISAO_ID, status: 'sugerida', itinerario_id: null })
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

  it('pré-preenche pelo turno: ida chega até a entrada (arrivalTime) e a volta sai na saída', async () => {
    mocks.buscarTurnosDoPosto.mockResolvedValue([
      { data: diaRecente(), turno: '7:00 às 15:20h Faltista ASG' },
      { data: diaRecente(), turno: '07:00 às 16:00 e sáb 7 às 11hs CBO - ASG - 8' },
      { data: diaRecente(), turno: '7:00 às 15:20h Faltista ASG' },
    ])
    render(<VtRevisaoRota contextoReal={contexto()} />)

    const aviso = await screen.findByTestId('vt-horario-turno')
    expect(aviso).toHaveTextContent('07:00 às 15:20 (visto em 2 dias)')
    expect(aviso).toHaveTextContent('07:00 às 16:00 (1 dia)')
    expect((screen.getByLabelText('Chegar até (ida)') as HTMLInputElement).value).toBe('07:00')
    expect((screen.getByLabelText('Saída do posto (volta)') as HTMLInputElement).value).toBe('15:20')

    await consultarEEscolher()
    const [ida, volta] = mocks.sugerirRotasGoogle.mock.calls.map((c) => c[0])
    // Entrada 07:00 BRT (10:00Z) − folga de 10 min = 09:50Z; saída 15:20 BRT = 18:20Z.
    expect(ida.arrivalTime).toMatch(/T09:50:00\.000Z$/)
    expect(ida.departureTime).toBeUndefined()
    expect(volta.departureTime).toMatch(/T18:20:00\.000Z$/)
    expect(volta.arrivalTime).toBeUndefined()

    expect(await salvar()).toMatchObject({
      origem: 'turno_escala', modoIda: 'chegada', folgaMinutos: 10, entrada: '07:00', saida: '15:20', texto: '07:00 às 15:20', noturno: false,
    })
  })

  it('turno noturno: a volta parte no dia seguinte ao da ida', async () => {
    mocks.buscarTurnosDoPosto.mockResolvedValue([{ data: diaRecente(), turno: '19 ÀS 07HS ENSEADA PORTARIA NOT. (PAR) COM INTERVALO' }])
    render(<VtRevisaoRota contextoReal={contexto()} />)
    expect(await screen.findByTestId('vt-horario-turno')).toHaveTextContent('turno noturno')

    fireEvent.click(screen.getByRole('button', { name: 'Consultar ida no Google' }))
    await screen.findByRole('button', { name: 'Ida — alternativa 4' })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar volta no Google' }))
    await waitFor(() => expect(mocks.sugerirRotasGoogle).toHaveBeenCalledTimes(2))

    const [ida, volta] = mocks.sugerirRotasGoogle.mock.calls.map((c) => c[0])
    // Chegar até 19:00 BRT − 10 min = 21:50Z na segunda; volta 07:00 BRT (10:00Z) na terça.
    expect(ida.arrivalTime).toMatch(/T21:50:00\.000Z$/)
    expect(volta.departureTime).toMatch(/T10:00:00\.000Z$/)
    expect(new Date(volta.departureTime).getTime() - new Date(ida.arrivalTime).getTime()).toBe(12 * 3600_000 + 10 * 60_000)
  })

  it('o operador pode editar o horário e a evidência passa a dizer "manual"', async () => {
    mocks.buscarTurnosDoPosto.mockResolvedValue([{ data: diaRecente(), turno: '8 ÀS 16:20h CALLE ASG - 1' }])
    render(<VtRevisaoRota contextoReal={contexto()} />)
    await screen.findByTestId('vt-horario-turno')
    fireEvent.change(screen.getByLabelText('Chegar até (ida)'), { target: { value: '0730' } })
    expect((screen.getByLabelText('Chegar até (ida)') as HTMLInputElement).value).toBe('07:30')

    await consultarEEscolher()
    expect(mocks.sugerirRotasGoogle.mock.calls[0][0].arrivalTime).toMatch(/T10:20:00\.000Z$/)
    expect(await salvar()).toMatchObject({ origem: 'manual', entrada: '07:30', saida: '16:20' })
  })

  it('sem turno mantém 06:00 / 18:00 editáveis, consulta por departureTime e grava origem manual', async () => {
    render(<VtRevisaoRota contextoReal={contexto()} />)
    await waitFor(() => expect(mocks.buscarTurnosDoPosto).toHaveBeenCalled())
    expect(screen.queryByTestId('vt-horario-turno')).not.toBeInTheDocument()
    expect((screen.getByLabelText('Saída de casa (ida)') as HTMLInputElement).value).toBe('06:00')
    expect((screen.getByLabelText('Saída do posto (volta)') as HTMLInputElement).value).toBe('18:00')

    await consultarEEscolher()
    const ida = mocks.sugerirRotasGoogle.mock.calls[0][0]
    expect(ida.departureTime).toMatch(/T09:00:00\.000Z$/)
    expect(ida.arrivalTime).toBeUndefined()
    expect(await salvar()).toMatchObject({ origem: 'manual', modoIda: 'saida', entrada: '06:00', saida: '18:00' })
  })

  it('mostra a folga de 10 minutos e não mostra hora prevista de chegada', async () => {
    mocks.buscarTurnosDoPosto.mockResolvedValue([{ data: diaRecente(), turno: '7:00 às 15:20h Faltista ASG' }])
    render(<VtRevisaoRota contextoReal={contexto()} />)
    const aviso = await screen.findByTestId('vt-horario-turno')
    expect(aviso).toHaveTextContent('folga de 10 minutos')
    expect(aviso).not.toHaveTextContent(/chegando às/i)
  })
})
