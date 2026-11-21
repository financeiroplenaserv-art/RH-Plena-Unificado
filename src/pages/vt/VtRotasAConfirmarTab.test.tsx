import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { VtColaborador, VtDepartamento, VtTrajetoComDetalhes } from '@/hooks/useVt'
import type { DecisaoRotaResumo } from '@/lib/vt/rotasAConfirmar'

const decisoes = vi.hoisted(() => ({ mapa: new Map<string, unknown>() }))
vi.mock('@/lib/vt/repositorioItinerarioSupabase', () => ({
  RepositorioItinerarioSupabase: class {
    buscarResumoDecisoesPorTrajetos = vi.fn().mockImplementation(async () => decisoes.mapa)
  },
}))
const apoio = vi.hoisted(() => ({
  dados: { exigencias: [] as unknown[], origemConfirmada: new Map<string, string | null>() },
  falha: false,
}))
vi.mock('@/lib/vt/apoioRotasAConfirmar', () => ({
  carregarApoioRotasAConfirmar: vi.fn().mockImplementation(async () => {
    if (apoio.falha) throw new Error('falhou')
    return apoio.dados
  }),
}))
const criar = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('@/lib/vt/criarTrajetoRevisao', () => {
  class MigracaoTrajetoSemBilhetePendente extends Error {}
  return {
    criarTrajetoParaRevisao: (...args: unknown[]) => criar.fn(...args),
    MigracaoTrajetoSemBilhetePendente,
  }
})
vi.mock('@/pages/vt/VtRevisaoRota', () => ({
  VtRevisaoRota: ({ contextoReal }: { contextoReal: { trajetoLegadoId: string } }) => (
    <div data-testid="painel-revisao">{contextoReal.trajetoLegadoId}</div>
  ),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { VtRotasAConfirmarTab } from './VtRotasAConfirmarTab'

const colab = (id: string, nome: string): VtColaborador => ({
  id, nome_completo: nome, departamento: 'POSTO A', departamento_id: 'dep-a', cidade: 'Niterói',
  endereco: 'RUA X, 10, CENTRO', vt_optante: true, vt_tipo_cartao: null,
})
const DEP: VtDepartamento = { id: 'dep-a', nome: 'POSTO A', nome_curto: 'POSTO A', empresa_id: 'e', status: 'Ativo', endereco: 'RUA P, 1', cidade: 'Niterói' }
const trajeto = (id: string, c: string) => ({
  id, colaborador_id: c, departamento_id: 'dep-a', precisao_origem: 'exato', bilhete_id: 'b', bilhete_2_id: null,
}) as unknown as VtTrajetoComDetalhes

function montar(podeGerenciar = true, colaboradores = [colab('1', 'Ana'), colab('2', 'Bia'), colab('3', 'Carla')]) {
  return render(
    <MemoryRouter>
      <VtRotasAConfirmarTab
        colaboradores={colaboradores}
        departamentos={[DEP]}
        trajetos={[trajeto('t1', '1'), trajeto('t2', '2')]}
        loading={false}
        usuarioId="u"
        podeGerenciar={podeGerenciar}
        recarregarTrajetos={vi.fn().mockResolvedValue(true)}
      />
    </MemoryRouter>,
  )
}

describe('VtRotasAConfirmarTab', () => {
  beforeEach(() => {
    apoio.dados = { exigencias: [], origemConfirmada: new Map() }
    apoio.falha = false
    criar.fn.mockReset()
  })

  it('lista com contador e motivos, e Revisar abre o painel existente', async () => {
    decisoes.mapa = new Map<string, DecisaoRotaResumo>([['t1', { status: 'sugerida', itinerarioId: 'it', custoDiarioCentavos: 1120 }]])
    montar()
    expect(await screen.findByText(/3 rotas a confirmar — 1 sugeridas, 0 com endereço novo, 1 antigas, 1 sem rota/)).toBeInTheDocument()
    expect(screen.getByText('Rota sugerida — falta confirmar')).toBeInTheDocument()
    expect(screen.getByText('Sem rota cadastrada')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Revisar/ })[0])
    expect(await screen.findByTestId('painel-revisao')).toHaveTextContent('t1')
  })

  it('quem só visualiza não consegue revisar', async () => {
    decisoes.mapa = new Map()
    montar(false)
    await screen.findByText(/rotas a confirmar —/)
    for (const b of screen.getAllByRole('button', { name: /Revisar/ })) expect(b).toBeDisabled()
  })

  it('mostra o estado vazio quando tudo está confirmado', async () => {
    decisoes.mapa = new Map<string, DecisaoRotaResumo>([
      ['t1', { status: 'confirmada', itinerarioId: 'i', custoDiarioCentavos: 900 }],
      ['t2', { status: 'confirmada', itinerarioId: 'i', custoDiarioCentavos: 900 }],
    ])
    montar(true, [colab('1', 'Ana'), colab('2', 'Bia')])
    expect(await screen.findByText(/Nenhuma rota a confirmar/)).toBeInTheDocument()
  })
})

describe('VtRotasAConfirmarTab — criar trajeto, escala do mês e endereço', () => {
  beforeEach(() => {
    apoio.dados = { exigencias: [], origemConfirmada: new Map() }
    apoio.falha = false
    criar.fn.mockReset()
  })

  it('"Criar e revisar" cria o trajeto de quem não tem rota e só então abre o painel', async () => {
    decisoes.mapa = new Map()
    criar.fn.mockResolvedValue({ trajetoId: 'novo-t', decisaoId: 'd', trajetoCriado: true })
    montar()
    await screen.findByText(/rotas a confirmar —/)
    fireEvent.click(screen.getByRole('button', { name: /Criar e revisar/ }))
    expect(await screen.findByTestId('painel-revisao')).toHaveTextContent('novo-t')
    expect(criar.fn).toHaveBeenCalledWith(expect.objectContaining({ colaboradorId: '3', departamentoId: 'dep-a' }))
  })

  it('mostra postos exigidos pela escala com o motivo e o filtro "só o que a carga precisa"', async () => {
    decisoes.mapa = new Map()
    apoio.dados = {
      exigencias: [{ colaboradorId: '1', departamentoId: 'dep-a', motivo: 'Escala de dezembro: 8 dias em POSTO A' }],
      origemConfirmada: new Map(),
    }
    montar()
    expect(await screen.findByText('Escala de dezembro: 8 dias em POSTO A')).toBeInTheDocument()
    expect(screen.getByText(/A carga do mês precisa de 1/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Só o que a carga do mês precisa/))
    await waitFor(() => expect(screen.queryByText('Carla')).not.toBeInTheDocument())
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('rota confirmada com endereço novo volta à fila mostrando antes e agora e avisando que a antiga vale', async () => {
    decisoes.mapa = new Map<string, DecisaoRotaResumo>([
      ['t1', { status: 'confirmada', itinerarioId: 'i', custoDiarioCentavos: 900 }],
      ['t2', { status: 'confirmada', itinerarioId: 'i', custoDiarioCentavos: 900 }],
    ])
    apoio.dados = {
      exigencias: [],
      origemConfirmada: new Map([['t1', 'Rua Velha, 7, Centro, Niterói']]),
    }
    montar(true, [colab('1', 'Ana'), colab('2', 'Bia')])
    expect(await screen.findByText('Endereço mudou — revisar a rota')).toBeInTheDocument()
    expect(screen.getByText(/Rua Velha, 7, Centro, Niterói/)).toBeInTheDocument()
    expect(screen.getByText(/A rota antiga continua valendo até você revisar/)).toBeInTheDocument()
    expect(screen.queryByText('Bia')).not.toBeInTheDocument()
  })

  it('falha ao carregar a escala do mês não derruba a fila', async () => {
    decisoes.mapa = new Map()
    apoio.falha = true
    montar()
    expect(await screen.findByText(/3 rotas a confirmar —/)).toBeInTheDocument()
  })
})
