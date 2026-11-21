import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { VtColaborador, VtDepartamento, VtTrajetoComDetalhes } from '@/hooks/useVt'
import type { DecisaoRotaResumo } from '@/lib/vt/rotasAConfirmar'

const decisoes = vi.hoisted(() => ({ mapa: new Map<string, unknown>() }))
vi.mock('@/lib/vt/repositorioItinerarioSupabase', () => ({
  RepositorioItinerarioSupabase: class {
    buscarResumoDecisoesPorTrajetos = vi.fn().mockImplementation(async () => decisoes.mapa)
  },
}))
vi.mock('@/pages/vt/VtRevisaoRota', () => ({
  VtRevisaoRota: ({ contextoReal }: { contextoReal: { trajetoLegadoId: string } }) => (
    <div data-testid="painel-revisao">{contextoReal.trajetoLegadoId}</div>
  ),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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
  it('lista com contador e motivos, e Revisar abre o painel existente', async () => {
    decisoes.mapa = new Map<string, DecisaoRotaResumo>([['t1', { status: 'sugerida', itinerarioId: 'it', custoDiarioCentavos: 1120 }]])
    montar()
    expect(await screen.findByText(/3 rotas a confirmar — 1 sugeridas, 1 antigas, 1 sem rota/)).toBeInTheDocument()
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
