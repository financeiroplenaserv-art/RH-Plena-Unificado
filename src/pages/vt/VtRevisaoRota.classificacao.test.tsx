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

function passo(linha: string, partida: string, chegada: string) {
  return {
    travelMode: 'TRANSIT',
    transitDetails: {
      stopDetails: { departureStop: { name: 'A' }, arrivalStop: { name: 'B' }, departureTime: partida, arrivalTime: chegada },
      transitLine: { nameShort: linha, vehicle: { type: 'BUS' }, agencies: [{ name: 'Prefeitura de Niterói' }] },
    },
  }
}

// Ida: 39 (que o Google rotula de Niterói) + 532M. Volta: o inverso.
const RESPOSTA_IDA = {
  routes: [{ legs: [{ steps: [passo('39', '2026-11-30T09:00:00Z', '2026-11-30T09:20:00Z'), passo('532M', '2026-11-30T09:30:00Z', '2026-11-30T10:00:00Z')] }] }],
}
const RESPOSTA_VOLTA = {
  routes: [{ legs: [{ steps: [passo('532M', '2026-11-30T20:00:00Z', '2026-11-30T20:30:00Z'), passo('39', '2026-11-30T20:40:00Z', '2026-11-30T21:00:00Z')] }] }],
}

function contexto(): ContextoRevisaoRotaReal {
  return {
    trajetoLegadoId: 'trajeto-1',
    colaboradorId: '20000000-0000-4000-8000-000000000002',
    departamentoId: '30000000-0000-4000-8000-000000000003',
    usuarioId: '40000000-0000-4000-8000-000000000004',
    origem: 'CASA, Itaboraí - RJ',
    destino: 'POSTO, Niterói - RJ',
    municipioOrigem: 'Itaboraí',
    municipioDestino: 'Niterói',
    precisao: 'exata',
    cartao: ATIVADO,
  }
}

async function abrirComRotaSelecionada() {
  render(<VtRevisaoRota contextoReal={contexto()} />)
  await waitFor(() => expect(mocks.buscarDecisaoPorTrajeto).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar ida e volta' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Consultar ida e volta' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Ida — alternativa 1' }))
  await screen.findByTestId('volta-recolhida')
}

describe('VtRevisaoRota — corrigir o tipo da linha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buscarDecisaoPorTrajeto.mockResolvedValue({ id: DECISAO_ID, status: 'sugerida', itinerario_id: null })
    mocks.sugerirRotasGoogle.mockImplementation(async ({ origin }: { origin: string }) =>
      origin.startsWith('CASA') ? RESPOSTA_IDA : RESPOSTA_VOLTA)
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

  it('trocar a 39 de Niterói para gratuito muda o valor, a volta herda e a correção vai na evidência', async () => {
    await abrirComRotaSelecionada()
    const resumo = screen.getByRole('region', { name: 'Valor do dia' })
    const seletor = screen.getByLabelText('Esta linha é de — condução 1 (ida)') as HTMLSelectElement
    expect(seletor.value).toBe('niteroi')
    expect(resumo).toHaveTextContent('Total do dia: R$ 18,80')

    fireEvent.change(seletor, { target: { value: 'gratuito' } })
    // 39 gratuita: só a 532M é cobrada (R$ 7,10) em cada sentido — a volta espelhada herdou a correção.
    expect(screen.getByRole('region', { name: 'Valor do dia' })).toHaveTextContent('Total do dia: R$ 14,20')
    expect((screen.getByLabelText('Esta linha é de — condução 1 (ida)') as HTMLSelectElement).value).toBe('gratuito')

    fireEvent.click(screen.getByRole('button', { name: 'Salvar itinerário escolhido' }))
    await waitFor(() => expect(mocks.salvarEscolhaComRevisao).toHaveBeenCalledTimes(1))
    const [entrada] = mocks.salvarEscolhaComRevisao.mock.calls[0]
    expect(entrada.custoDiarioCentavos).toBe(1420)
    const ajustes = entrada.alternativa.itinerario.ajustesManuais.filter((a: { tipo: string }) => a.tipo === 'correcao_classificacao_perna')
    expect(ajustes.map((a: { sentido: string; linha: string }) => `${a.sentido}:${a.linha}`).sort()).toEqual(['ida:39', 'volta:39'])
    expect(ajustes[0]).toMatchObject({
      original: { sistemaTarifario: 'riocard', municipioOrigem: 'Niterói' },
      escolhida: { sistemaTarifario: 'gratuito', tipoLinha: 'gratuito' },
    })
  })

  it('consultar de novo limpa as correções', async () => {
    await abrirComRotaSelecionada()
    fireEvent.change(screen.getByLabelText('Esta linha é de — condução 1 (ida)'), { target: { value: 'gratuito' } })
    expect(screen.getByRole('region', { name: 'Valor do dia' })).toHaveTextContent('R$ 14,20')

    fireEvent.click(screen.getByRole('button', { name: 'Consultar ida no Google' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ida — alternativa 1' }))
    await waitFor(() => expect((screen.getByLabelText('Esta linha é de — condução 1 (ida)') as HTMLSelectElement).value).toBe('niteroi'))
  })
})
