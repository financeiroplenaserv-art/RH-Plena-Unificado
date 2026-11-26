import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

function contexto(): ContextoRevisaoRotaReal {
  return {
    trajetoLegadoId: 'trajeto-1',
    colaboradorId: '20000000-0000-4000-8000-000000000002',
    departamentoId: '30000000-0000-4000-8000-000000000003',
    usuarioId: '40000000-0000-4000-8000-000000000004',
    origem: 'Guaxindiba, São Gonçalo - RJ',
    destino: 'Mérito Barreto, Niterói - RJ',
    municipioOrigem: 'São Gonçalo',
    municipioDestino: 'Niterói',
    precisao: 'exata',
    cartao: ATIVADO,
  }
}

async function abrirPainel() {
  render(<VtRevisaoRota contextoReal={contexto()} />)
  await waitFor(() => expect(mocks.buscarDecisaoPorTrajeto).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByRole('button', { name: /Informar a rota que a pessoa usa/ })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: /Informar a rota que a pessoa usa/ }))
}

function adicionarLinha(sentido: 'ida' | 'volta', codigo: string) {
  fireEvent.change(screen.getByLabelText(`Código da linha (${sentido})`), { target: { value: codigo } })
  fireEvent.click(screen.getByRole('button', { name: `Adicionar linha (${sentido})` }))
}

describe('VtRevisaoRota — rota informada manualmente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buscarDecisaoPorTrajeto.mockResolvedValue({ id: DECISAO_ID, status: 'sugerida', itinerario_id: null })
    mocks.salvarEscolhaComRevisao.mockImplementation(async (entrada) => ({
      decisaoId: DECISAO_ID,
      repetido: false,
      evidencia: {
        id: 'ev-1',
        provedor: entrada.alternativa.itinerario.provedor,
        alternativa_id: entrada.alternativa.id,
        itinerario: entrada.alternativa.itinerario,
        consultado_em: entrada.alternativa.itinerario.consultadoEm,
        evidencia_hash: 'hash',
      },
    }))
  })

  it('caso Ana Bela: 489M + 532M, volta invertida, R$ 9,40 por sentido e R$ 18,80 no dia — sem consultar o Google', async () => {
    await abrirPainel()
    adicionarLinha('ida', '489m')
    adicionarLinha('ida', '532M')

    expect(within(screen.getByTestId('manual-conducao-ida-1')).getByText('Intermunicipal (DETRO)')).toBeInTheDocument()
    expect(screen.getByTestId('manual-valor-ida')).toHaveTextContent('R$ 9,40 por sentido')
    // volta pré-preenchida ao contrário
    expect(screen.getByTestId('manual-conducao-volta-1')).toHaveTextContent('532M')
    expect(screen.getByTestId('manual-conducao-volta-2')).toHaveTextContent('489M')
    expect(screen.getByTestId('manual-valor-volta')).toHaveTextContent('R$ 9,40 por sentido')
    expect(screen.getByRole('region', { name: 'Valor do dia' })).toHaveTextContent('Total do dia: R$ 18,80')
    expect(mocks.sugerirRotasGoogle).not.toHaveBeenCalled()
  })

  it('motivo é obrigatório: sem ele o salvar fica desabilitado', async () => {
    await abrirPainel()
    adicionarLinha('ida', '489M')
    adicionarLinha('ida', '532M')

    const salvar = screen.getByRole('button', { name: 'Salvar itinerário escolhido' })
    expect(salvar).toBeDisabled()
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent(/motivo/i)

    fireEvent.change(screen.getByLabelText('Motivo da rota informada'), { target: { value: '   ' } })
    expect(salvar).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Motivo da rota informada'), { target: { value: 'confirmado com a colaboradora' } })
    expect(salvar).toBeEnabled()
  })

  it('linha inexistente 999X: avisa "não encontrada", sem valor, e bloqueia o salvar', async () => {
    await abrirPainel()
    adicionarLinha('ida', '999X')
    fireEvent.change(screen.getByLabelText('Motivo da rota informada'), { target: { value: 'teste' } })

    expect(within(screen.getByTestId('manual-conducao-ida-1')).getByText(/Linha não encontrada/)).toBeInTheDocument()
    expect(screen.getByTestId('manual-valor-ida')).toHaveTextContent('Valor indeterminado')
    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeDisabled()
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent(/indeterminado/)
  })

  it('salva com provedor manual, motivo e autor na evidência', async () => {
    await abrirPainel()
    adicionarLinha('ida', '489M')
    adicionarLinha('ida', '532M')
    fireEvent.change(screen.getByLabelText('Motivo da rota informada'), { target: { value: 'confirmado com a colaboradora' } })

    fireEvent.click(screen.getByRole('button', { name: 'Salvar itinerário escolhido' }))
    await waitFor(() => expect(mocks.salvarEscolhaComRevisao).toHaveBeenCalledTimes(1))
    const [entrada, trajetoId] = mocks.salvarEscolhaComRevisao.mock.calls[0]
    expect(trajetoId).toBe('trajeto-1')
    expect(entrada).toMatchObject({ cotacaoId: 'motor_v1', cotacaoStatus: 'confirmavel', custoDiarioCentavos: 1880 })
    expect(entrada.alternativa.itinerario.provedor).toBe('manual')
    expect(entrada.alternativa.itinerario.rotaManual).toMatchObject({
      motivo: 'confirmado com a colaboradora',
      autorId: '40000000-0000-4000-8000-000000000004',
      horariosPresumidos: true,
    })
    expect(entrada.alternativa.itinerario.pernas.map((p: { sentido: string; linha: string }) => `${p.sentido}:${p.linha}`))
      .toEqual(['ida:489M', 'ida:532M', 'volta:532M', 'volta:489M'])

    expect(await screen.findByTestId('evidencia-rota-manual')).toHaveTextContent('Rota informada manualmente — motivo: confirmado com a colaboradora')
  })

  it('caso Andressa: depois de salvar, a fila recarrega (contexto e cartão recriados) e o Confirmar continua visível', async () => {
    const { rerender } = render(<VtRevisaoRota contextoReal={contexto()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Informar a rota que a pessoa usa/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /Informar a rota que a pessoa usa/ }))
    adicionarLinha('ida', '489M')
    adicionarLinha('ida', '532M')
    fireEvent.change(screen.getByLabelText('Motivo da rota informada'), { target: { value: 'confirmado com a colaboradora' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar itinerário escolhido' }))
    expect(await screen.findByRole('button', { name: 'Confirmar trajeto e preço' })).toBeInTheDocument()

    // A fila "Rotas a confirmar" recarrega após salvar e recria o contexto (cartão é objeto novo).
    rerender(<VtRevisaoRota contextoReal={{ ...contexto(), cartao: { ...ATIVADO } }} />)
    expect(screen.getByRole('button', { name: 'Confirmar trajeto e preço' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Itinerário salvo' })).toBeDisabled()

    // Mudar a rota de verdade continua invalidando o "salvo".
    adicionarLinha('ida', '33')
    expect(screen.queryByRole('button', { name: 'Confirmar trajeto e preço' })).not.toBeInTheDocument()
  })

  it('volta editável: dá para informar uma volta diferente da ida', async () => {
    await abrirPainel()
    adicionarLinha('ida', '39A')
    fireEvent.click(screen.getByRole('button', { name: /Volta diferente\? Editar a volta/ }))
    expect(screen.getByTestId('manual-conducao-volta-1')).toHaveTextContent('39A')
    fireEvent.click(screen.getByRole('button', { name: 'Remover condução 1 (volta)' }))
    adicionarLinha('volta', '33')
    expect(screen.getByTestId('manual-conducao-volta-1')).toHaveTextContent('33')
    expect(screen.getByTestId('manual-conducao-volta-1')).toHaveTextContent('Ônibus municipal de Niterói')
  })

  it('linha D com casa e posto fora do Rio: aviso e bloqueio', async () => {
    await abrirPainel()
    adicionarLinha('ida', '709D')
    fireEvent.change(screen.getByLabelText('Motivo da rota informada'), { target: { value: 'teste' } })
    expect(screen.getByTestId('manual-linha-d-ida')).toHaveTextContent(/Linha para o Rio/)
    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeDisabled()
  })
})
