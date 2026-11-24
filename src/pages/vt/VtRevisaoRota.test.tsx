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

    // Consultar a ida já busca a volta (1ª chamada de volta, horário padrão);
    // a última chamada é a volta reconsultada com o horário editado.
    const chamadas = mocks.sugerirRotasGoogle.mock.calls.map((c) => c[0])
    expect(chamadas).toHaveLength(3)
    const ida = chamadas[0]
    const volta = chamadas[chamadas.length - 1]
    expect(chamadas[1]).toMatchObject({ origin: 'POSTO, Niterói - RJ', destination: 'CASA, São Gonçalo - RJ' })
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
    expect(within(cartoes[0]).getByText('R$ 4,45 por sentido')).toBeInTheDocument()
    expect(cartoes.every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(true)

    const salvar = screen.getByRole('button', { name: 'Salvar itinerário escolhido' })
    expect(salvar).toBeDisabled()
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent('Escolha uma alternativa de ida e uma de volta.')

    fireEvent.click(cartoes[0])
    expect(salvar).toBeDisabled()
    expect(screen.getAllByText(/Como o valor foi calculado/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))
    const resumo = screen.getByRole('region', { name: 'Valor do dia' })
    expect(resumo).toHaveTextContent('Total do dia: R$ 8,90')
    expect(salvar).toBeEnabled()

    fireEvent.click(salvar)
    await waitFor(() => expect(mocks.salvarEscolhaComRevisao).toHaveBeenCalledTimes(1))
    const [entrada, trajetoId] = mocks.salvarEscolhaComRevisao.mock.calls[0]
    expect(trajetoId).toBe('trajeto-1')
    expect(entrada).toMatchObject({ cotacaoId: 'motor_v1', cotacaoStatus: 'confirmavel', custoDiarioCentavos: 890 })
    expect(entrada.alternativa.itinerario.pernas.map((p: { sentido: string; linha: string }) => `${p.sentido}:${p.linha}`))
      .toEqual(['ida:62', 'ida:39A', 'volta:39A'])
    expect(entrada.alternativa.itinerario.calculoMotor).toMatchObject({ valorDiaCentavos: 890, versao: 'motor_v1' })
  })

  it('BU Suspenso Setrans: integração presumida — 62 + 39A custa R$ 4,45 por sentido e mostra o aviso de regularizar', async () => {
    render(<VtRevisaoRota contextoReal={contexto(SUSPENSO)} />)
    await consultarIdaEVolta()

    expect(screen.getByTestId('vt-politica-integracao')).toHaveTextContent(/política da empresa/)
    expect(screen.getByRole('note')).toHaveTextContent(
      'Seu Bilhete Único consta como Suspenso Setrans na Riocard. O VT é calculado com a integração; regularize seu cartão para não pagar a diferença.',
    )

    const cartao62 = screen.getByRole('button', { name: 'Ida — alternativa 4' })
    expect(within(cartao62).getByText('R$ 4,45 por sentido')).toBeInTheDocument()

    fireEvent.click(cartao62)
    fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))

    const resumo = screen.getByRole('region', { name: 'Valor do dia' })
    expect(resumo).toHaveTextContent('Total do dia: R$ 8,90')
    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeEnabled()
  })

  it('exceção tarifa cheia: 62 + 39A custa R$ 11,20 por sentido, sem aviso de regularizar', async () => {
    render(
      <VtRevisaoRota
        contextoReal={contexto({ ...SUSPENSO, politicaIntegracao: 'tarifa_cheia', motivoTarifaCheia: 'decisão da diretoria' })}
      />,
    )
    await consultarIdaEVolta()

    expect(screen.getByTestId('vt-politica-integracao')).toHaveTextContent(/Exceção da empresa: tarifa cheia.*decisão da diretoria/)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()

    const cartao62 = screen.getByRole('button', { name: 'Ida — alternativa 4' })
    expect(within(cartao62).getByText('R$ 11,20 por sentido')).toBeInTheDocument()
    fireEvent.click(cartao62)
    fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))
    expect(screen.getByRole('region', { name: 'Valor do dia' })).toHaveTextContent('Total do dia: R$ 16,80')
    expect(mocks.salvarEscolhaComRevisao).not.toHaveBeenCalled()
  })

  it('alternativa indeterminada fica por último e bloqueia o salvar', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await consultarIdaEVolta()

    const cartoes = within(screen.getByRole('region', { name: 'Ida (casa → posto)' })).getAllByRole('button', { name: /^Ida — alternativa/ })
    // As alternativas com linha D (proibidas nesta cidade) vão ao fim; a indeterminada vem antes delas.
    const ultimo = cartoes.filter((c) => !within(c).queryByTestId('linha-d-proibida')).pop()!
    expect(within(ultimo).getByText('Valor indeterminado')).toBeInTheDocument()

    fireEvent.click(ultimo)
    fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))
    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeDisabled()
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent(/indeterminado|pendente/)
  })

  it('linha D com casa e posto fora do Rio: marcada, nunca "Mais em conta" e não deixa salvar (24/11/2026)', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await consultarIdaEVolta()

    const regiao = within(screen.getByRole('region', { name: 'Ida (casa → posto)' }))
    const cartoes = regiao.getAllByRole('button', { name: /^Ida — alternativa/ })
    const comD = cartoes.filter((c) => within(c).queryByTestId('linha-d-proibida'))
    expect(comD.length).toBeGreaterThan(0)
    for (const c of comD) {
      expect(within(c).queryByText('Mais em conta')).not.toBeInTheDocument()
      expect(within(c).getByTestId('linha-d-proibida')).toHaveTextContent(/Linha para o Rio — não usar/)
    }
    // as proibidas ficam no fim da lista
    const primeiraProibida = cartoes.indexOf(comD[0])
    expect(cartoes.slice(primeiraProibida).every((c) => within(c).queryByTestId('linha-d-proibida'))).toBe(true)

    fireEvent.click(comD[0])
    fireEvent.click(screen.getByRole('button', { name: 'Volta — alternativa 1' }))
    expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeDisabled()
    expect(screen.getByTestId('motivo-bloqueio')).toHaveTextContent(/vai para o Rio/)
  })

  it('horário inválido da volta mostra erro e não consulta', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar volta no Google' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Saída do posto (volta)'), { target: { value: '25:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar volta no Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Horário inválido')
    expect(mocks.sugerirRotasGoogle).not.toHaveBeenCalled()
  })

  it('máscara hh:mm: 1000 vira 10:00 e horário inválido mostra erro discreto', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    const campo = screen.getByLabelText('Saída de casa (ida)') as HTMLInputElement
    fireEvent.change(campo, { target: { value: '1000' } })
    expect(campo.value).toBe('10:00')
    fireEvent.change(campo, { target: { value: '2599' } })
    expect(campo.value).toBe('25:99')
    expect(screen.getByText(/Horário inválido \(00:00 a 23:59\)/)).toBeInTheDocument()
  })

  it('"Consultar ida e volta" dispara as duas consultas, cada uma com o seu horário', async () => {
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar ida e volta' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Saída do posto (volta)'), { target: { value: '1730' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar ida e volta' }))
    await screen.findByRole('button', { name: 'Volta — alternativa 1' })
    await screen.findByRole('button', { name: 'Ida — alternativa 4' })
    expect(mocks.sugerirRotasGoogle).toHaveBeenCalledTimes(2)
    const [ida, volta] = mocks.sugerirRotasGoogle.mock.calls.map((c) => c[0])
    expect(ida.departureTime).toMatch(/T09:00:00\.000Z$/)
    expect(volta.departureTime).toMatch(/T20:30:00\.000Z$/)
  })

  it('mostra "Intermunicipal (DETRO)" com a dica do Google quando a operadora foi reclassificada', async () => {
    // Ônibus 489M que o Google atribui à "Prefeitura de Niterói" (na verdade DETRO).
    const resposta = structuredClone(RESPOSTA_ACACIO)
    const linha = resposta.routes![0].legs![0].steps![0].transitDetails!.transitLine!
    linha.nameShort = '489M'
    mocks.sugerirRotasGoogle.mockResolvedValue(resposta)
    render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar ida no Google' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Consultar ida no Google' }))
    const cartao = await screen.findByRole('button', { name: 'Ida — alternativa 1' })
    fireEvent.click(cartao)
    expect(screen.getAllByText('Intermunicipal (DETRO)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Google informa: Prefeitura de Niterói').length).toBeGreaterThan(0)
  })

  it('o texto do rodapé diz que pode trocar depois e o motivo do bloqueio fica no rodapé fixo', async () => {
    render(<VtRevisaoRota contextoReal={{ ...contexto(ATIVADO), onFechar: vi.fn() }} />)
    expect(await screen.findByText(/Pode trocar depois: ao salvar outra rota/)).toBeInTheDocument()
    expect(screen.queryByText(/nunca é alterada/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
    expect(screen.getByTestId('motivo-bloqueio').closest('.sticky')).not.toBeNull()
  })

  describe('volta igual à ida por padrão', () => {
    beforeEach(() => {
      mocks.sugerirRotasGoogle.mockResolvedValue(RESPOSTA_ACACIO)
    })

    async function consultarOsDois() {
      render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar ida e volta' })).toBeEnabled())
      fireEvent.click(screen.getByRole('button', { name: 'Consultar ida e volta' }))
      return screen.findByRole('button', { name: 'Ida — alternativa 1' })
    }

    it('ao escolher a ida, a volta vem preenchida e recolhida numa linha só', async () => {
      const ida = await consultarOsDois()
      fireEvent.click(ida)
      const linha = await screen.findByTestId('volta-recolhida')
      expect(linha).toHaveTextContent('Volta: mesma rota no sentido contrário (39A) — R$ 4,45')
      expect(screen.queryByRole('button', { name: 'Volta — alternativa 1' })).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Valor do dia' })).toHaveTextContent('Total do dia: R$ 8,90')
      expect(screen.getByRole('button', { name: 'Salvar itinerário escolhido' })).toBeEnabled()
    })

    it('salva com a volta automática, com os mesmos campos da evidência', async () => {
      fireEvent.click(await consultarOsDois())
      fireEvent.click(screen.getByRole('button', { name: 'Salvar itinerário escolhido' }))
      await waitFor(() => expect(mocks.salvarEscolhaComRevisao).toHaveBeenCalledTimes(1))
      const [entrada] = mocks.salvarEscolhaComRevisao.mock.calls[0]
      expect(entrada.alternativa.itinerario.pernas.map((p: { sentido: string; linha: string }) => `${p.sentido}:${p.linha}`))
        .toEqual(['ida:39A', 'volta:39A'])
      expect(entrada.alternativa.itinerario.calculoMotor).toMatchObject({ valorDiaCentavos: 890, versao: 'motor_v1' })
    })

    it('"Volta diferente? Escolher outra" abre as alternativas da volta e a escolha manual vale', async () => {
      fireEvent.click(await consultarOsDois())
      fireEvent.click(await screen.findByRole('button', { name: 'Volta diferente? Escolher outra' }))
      const secaoVolta = screen.getByRole('region', { name: 'Volta (posto → casa)' })
      const cartoes = within(secaoVolta).getAllByRole('button', { name: /^Volta — alternativa/ })
      expect(cartoes.length).toBeGreaterThan(1)
      const outra = cartoes.find((c) => c.getAttribute('aria-pressed') === 'false')!
      fireEvent.click(outra)
      expect(outra).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByTestId('volta-recolhida')).not.toBeInTheDocument()
    })

    it('sem rota inversa na volta, a seção abre sozinha com o aviso', async () => {
      mocks.sugerirRotasGoogle.mockImplementation(async ({ origin }: { origin: string }) =>
        origin.startsWith('CASA') ? RESPOSTA_ALCEMIR : RESPOSTA_ACACIO)
      render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar ida e volta' })).toBeEnabled())
      fireEvent.click(screen.getByRole('button', { name: 'Consultar ida e volta' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Ida — alternativa 4' }))
      expect(await screen.findByText('Não achamos a mesma rota na volta — escolha a volta abaixo.')).toBeInTheDocument()
      expect(screen.queryByTestId('volta-recolhida')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Volta — alternativa 1' })).toBeInTheDocument()
    })
  })

  describe('alternativas sem repetição', () => {
    it('agrupa as idênticas, mostra "+2 horários parecidos" e não marca "Mais em conta" quando tudo custa igual', async () => {
      const rota = RESPOSTA_ACACIO.routes![0]
      mocks.sugerirRotasGoogle.mockResolvedValue({ routes: [rota, structuredClone(rota), structuredClone(rota)] })
      render(<VtRevisaoRota contextoReal={contexto(ATIVADO)} />)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Consultar ida no Google' })).toBeEnabled())
      fireEvent.click(screen.getByRole('button', { name: 'Consultar ida no Google' }))
      const secaoIda = screen.getByRole('region', { name: 'Ida (casa → posto)' })
      const cartao = await within(secaoIda).findByRole('button', { name: 'Ida — alternativa 1' })
      expect(within(secaoIda).getAllByRole('button', { name: /^Ida — alternativa/ })).toHaveLength(1)
      expect(cartao).toHaveTextContent('+2 horários parecidos')
      expect(within(cartao).queryByText('Mais em conta')).not.toBeInTheDocument()
    })

    it('não mostra selo "Confirmado" nas alternativas; só Pendente/Indeterminado', async () => {
      render(<VtRevisaoRota contextoReal={contexto(SUSPENSO)} />)
      await consultarIdaEVolta()
      const secaoIda = screen.getByRole('region', { name: 'Ida (casa → posto)' })
      expect(within(secaoIda).queryByText('Confirmado')).not.toBeInTheDocument()
      expect(within(secaoIda).getAllByText('Pendente').length).toBeGreaterThan(0)
    })
  })
})
