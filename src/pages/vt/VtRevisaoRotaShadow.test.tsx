import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { VtRevisaoRotaShadow, type ContextoRevisaoRotaReal } from './VtRevisaoRotaShadow'
import { sugerirRotasGoogle } from '@/services/vtRotaApi'
import { RESPOSTA_ACACIO } from '@/lib/vt/googleRoutesFixture'

const { buscarDecisaoMock, buscarItinerarioMock, salvarEscolhaMock, confirmarDecisaoMock } = vi.hoisted(() => ({
  buscarDecisaoMock: vi.fn(),
  buscarItinerarioMock: vi.fn(),
  salvarEscolhaMock: vi.fn(),
  confirmarDecisaoMock: vi.fn(),
}))

vi.mock('@/services/vtRotaApi', () => ({ sugerirRotasGoogle: vi.fn() }))
vi.mock('@/lib/vt/repositorioItinerarioSupabase', () => ({
  RepositorioItinerarioSupabase: class {
    buscarDecisaoPorTrajeto = buscarDecisaoMock
    buscarItinerarioPorId = buscarItinerarioMock
    salvarEscolhaComRevisao = salvarEscolhaMock
    confirmarDecisaoAberta = confirmarDecisaoMock
  },
}))
const consultaMock = vi.mocked(sugerirRotasGoogle)

const EVIDENCIA_MOCK = {
  id: '10000000-0000-4000-8000-000000000005',
  alternativa_id: 'google-4',
  consultado_em: '2026-11-17T12:00:00Z',
  evidencia_hash: 'a'.repeat(64),
  itinerario: { pernas: [{ linha: '62' }, { linha: '39A' }] },
}

const CONTEXTO_REAL: ContextoRevisaoRotaReal = {
  trajetoLegadoId: 'trajeto-real-id',
  colaboradorId: '10000000-0000-4000-8000-000000000002',
  departamentoId: '10000000-0000-4000-8000-000000000003',
  usuarioId: '10000000-0000-4000-8000-000000000004',
  origem: 'Rua de teste, 10, Niterói - RJ, 24000-000',
  destino: 'Posto de teste, Niterói - RJ',
  municipioOrigem: 'Niterói',
  municipioDestino: 'Niterói',
  precisao: 'exata',
  cartao: {
    personalizacao: 'usuario',
    vinculadoCpf: true,
    bui: 'ativo',
    bun: 'ativo',
    jae: 'disponivel',
    situacaoConsultadaEm: '2026-10-28',
  },
}

beforeEach(() => {
  consultaMock.mockReset()
  buscarDecisaoMock.mockReset()
  buscarItinerarioMock.mockReset()
  salvarEscolhaMock.mockReset()
  confirmarDecisaoMock.mockReset()
  buscarDecisaoMock.mockResolvedValue({
    id: '10000000-0000-4000-8000-000000000001',
    status: 'sugerida',
    itinerario_id: null,
  })
  buscarItinerarioMock.mockResolvedValue(EVIDENCIA_MOCK)
  salvarEscolhaMock.mockResolvedValue({
    decisaoId: '10000000-0000-4000-8000-000000000001',
    repetido: false,
    evidencia: EVIDENCIA_MOCK,
  })
  confirmarDecisaoMock.mockResolvedValue({ id: '10000000-0000-4000-8000-000000000001', status: 'confirmada' })
})

describe('VtRevisaoRotaShadow', () => {
  it('só calcula a rota direta depois da escolha e mostra R$ 11,20 por dia', () => {
    render(<VtRevisaoRotaShadow />)

    expect(screen.getByText('Nenhuma alternativa selecionada.')).toBeInTheDocument()
    expect(screen.queryByText('Estimativa da catraca, não confirmação do pacote patronal.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Alternativa 1/ }))

    expect(screen.getByText('confirmavel')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s*11,20/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('39A').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Riocard Mais — tarifas vigentes/ })).toHaveAttribute('href', 'http://www.riocardmais.com.br/Tarifas')
    expect(screen.getByText('Estimativa da catraca, não confirmação do pacote patronal.')).toBeInTheDocument()
  })

  it('alternativa com 1910D fica indeterminada por falta de tarifa', () => {
    render(<VtRevisaoRotaShadow />)

    fireEvent.click(screen.getByRole('button', { name: /Alternativa 2/ }))

    expect(screen.getAllByText('indeterminado').length).toBeGreaterThan(0)
    expect(screen.getByText('1910D')).toBeInTheDocument()
    expect(screen.getByText('Desconhecida')).toBeInTheDocument()
    expect(screen.getByText(/Informe a tarifa vigente da linha\/modal/)).toBeInTheDocument()
    expect(screen.getByText('Estimativa da catraca, não confirmação do pacote patronal.')).toBeInTheDocument()
  })

  it('Alcemir com BU suspenso paga a tarifa integral de 536R + 35', () => {
    render(<VtRevisaoRotaShadow />)

    fireEvent.click(screen.getByRole('button', { name: 'Alcemir — São Gonçalo' }))
    fireEvent.click(screen.getByRole('button', { name: /Alternativa 1/ }))

    expect(screen.getByText('536R')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$\s*29,40/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Desconhecida')).not.toBeInTheDocument()
  })

  it('62 + 39A é marcada como a alternativa mais em conta e aparece primeiro', () => {
    render(<VtRevisaoRotaShadow />)

    fireEvent.click(screen.getByRole('button', { name: 'Alcemir — São Gonçalo' }))

    const alternativas = screen.getAllByRole('button', { name: /Alternativa/ })
    expect(alternativas[0]).toHaveTextContent('62 → 39A')
    expect(alternativas[0]).toHaveTextContent('Mais em conta')
    expect(alternativas[0]).toHaveTextContent(/R\$\s*22,40\/dia/)
  })

  it('sequência de três conduções fica fora da confirmação automática', () => {
    render(<VtRevisaoRotaShadow />)

    fireEvent.click(screen.getByRole('button', { name: 'Alcemir — São Gonçalo' }))
    fireEvent.click(screen.getByRole('button', { name: /Alternativa 2/ }))

    expect(screen.getByText(/Sequências com três ou mais pernas exigem avaliação separada/)).toBeInTheDocument()
    expect(screen.getAllByText('indeterminado').length).toBeGreaterThan(0)
  })

  it('permite tirar o segundo ônibus e recalcula somente com a condução restante', () => {
    render(<VtRevisaoRotaShadow />)

    fireEvent.click(screen.getByRole('button', { name: 'Alcemir — São Gonçalo' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Alternativa/ })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Tirar condução 2' }))

    const tabela = screen.getByRole('table')
    expect(within(tabela).getByText('62')).toBeInTheDocument()
    expect(within(tabela).queryByText('39A')).not.toBeInTheDocument()
    expect(screen.getByText(/Condução 39A retirada manualmente/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tirar condução 1' })).toBeDisabled()
    expect(screen.getAllByText(/R\$\s*11,20\/dia/).length).toBeGreaterThan(0)
  })

  it('mantém Salvar bloqueado nos cenários fictícios', () => {
    render(<VtRevisaoRotaShadow />)

    fireEvent.click(screen.getByRole('button', { name: /Alternativa 1/ }))

    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeDisabled()
    expect(screen.getByText(/gravação está disponível somente ao revisar um trajeto real/)).toBeInTheDocument()
  })
})


describe('VtRevisaoRotaShadow — consulta ao vivo', () => {
  it('consulta a vt-rota com a sessão e usa a resposta recebida', async () => {
    consultaMock.mockResolvedValue(RESPOSTA_ACACIO)
    render(<VtRevisaoRotaShadow />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Google agora' }))

    expect(await screen.findByText('Resposta ao vivo da vt-rota; nenhuma decisão é persistida.')).toBeInTheDocument()
    expect(consultaMock).toHaveBeenCalledOnce()
    expect(consultaMock).toHaveBeenCalledWith(expect.objectContaining({
      origin: expect.stringContaining('QUINZE DE NOVEMBRO'),
      destination: expect.stringContaining('PIRATININGA'),
      departureTime: expect.any(String),
    }))
    expect(screen.getByRole('button', { name: /Alternativa 1/ })).toBeInTheDocument()
  })

  it('mostra erro sem apagar as alternativas arquivadas', async () => {
    consultaMock.mockRejectedValue(new Error('Sessão inválida'))
    render(<VtRevisaoRotaShadow />)

    fireEvent.click(screen.getByRole('button', { name: 'Consultar Google agora' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sessão inválida')
    expect(screen.getByRole('button', { name: /Alternativa 1/ })).toBeInTheDocument()
    await waitFor(() => expect(consultaMock).toHaveBeenCalledOnce())
  })
})


describe('VtRevisaoRotaShadow — trajeto real', () => {
  it('carrega a decisão, consulta e salva a alternativa escolhida com os IDs reais', async () => {
    consultaMock.mockResolvedValue(RESPOSTA_ACACIO)
    render(<VtRevisaoRotaShadow contextoReal={CONTEXTO_REAL} />)

    await waitFor(() => expect(buscarDecisaoMock).toHaveBeenCalledWith('trajeto-real-id'))
    fireEvent.click(screen.getByRole('button', { name: 'Consultar Google agora' }))
    fireEvent.click(await screen.findByRole('button', { name: /Alternativa 1/ }))
    const botaoSalvar = screen.getByRole('button', { name: 'Salvar itinerário escolhido' })
    await waitFor(() => expect(botaoSalvar).toBeEnabled())
    fireEvent.click(botaoSalvar)

    await waitFor(() => expect(salvarEscolhaMock).toHaveBeenCalledOnce())
    expect(salvarEscolhaMock).toHaveBeenCalledWith(expect.objectContaining({
      decisaoId: '10000000-0000-4000-8000-000000000001',
      colaboradorId: CONTEXTO_REAL.colaboradorId,
      departamentoId: CONTEXTO_REAL.departamentoId,
      usuarioId: CONTEXTO_REAL.usuarioId,
    }), CONTEXTO_REAL.trajetoLegadoId, expect.any(String))
    expect(consultaMock).toHaveBeenCalledWith(expect.objectContaining({
      origin: CONTEXTO_REAL.origem,
      destination: CONTEXTO_REAL.destino,
    }))
    expect(screen.getByRole('button', { name: 'Itinerário salvo' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar trajeto e preço' }))
    await waitFor(() => expect(confirmarDecisaoMock).toHaveBeenCalledOnce())
    expect(confirmarDecisaoMock).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000001',
      CONTEXTO_REAL.usuarioId,
      expect.any(String),
    )
    expect(screen.getByText('Trajeto e preço confirmados')).toBeInTheDocument()
  })

  it('restaura a evidência existente ao reabrir sem consultar o Google', async () => {
    buscarDecisaoMock.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001',
      status: 'sugerida',
      itinerario_id: EVIDENCIA_MOCK.id,
    })
    render(<VtRevisaoRotaShadow contextoReal={CONTEXTO_REAL} />)

    expect(await screen.findByText('Itinerário salvo neste trajeto')).toBeInTheDocument()
    expect(screen.getByText('62 → 39A')).toBeInTheDocument()
    expect(screen.getByText(`SHA-256: ${'a'.repeat(64)}`)).toBeInTheDocument()
    expect(buscarItinerarioMock).toHaveBeenCalledWith(EVIDENCIA_MOCK.id)
    expect(consultaMock).not.toHaveBeenCalled()
  })
})
