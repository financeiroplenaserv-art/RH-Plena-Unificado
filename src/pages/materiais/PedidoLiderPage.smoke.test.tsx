import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { DadosPedidoPublico } from '@/services/pedidoMateriaisApi'

const api = vi.hoisted(() => ({
  carregar: vi.fn(),
  enviar: vi.fn(),
}))

vi.mock('@/services/pedidoMateriaisApi', async () => {
  const real = await vi.importActual<typeof import('@/services/pedidoMateriaisApi')>('@/services/pedidoMateriaisApi')
  return {
    ...real,
    carregarPedidoPublico: api.carregar,
    enviarPedidoPublico: api.enviar,
  }
})

import { PedidoLiderPage } from './PedidoLiderPage'
import { ErroPedidoApi } from '@/services/pedidoMateriaisApi'

const dados = (extra: Partial<DadosPedidoPublico> = {}): DadosPedidoPublico => ({
  contrato: { nome: 'CHÁCARA DO ITAGUAÍ', recebe_limpeza: true },
  hoje: '2026-10-09',
  janela: { competencia: '2026-10-01', prazo: '2026-10-15', dentroDoPrazo: true, reaberta: false, aberta: true },
  catalogo: [{ id: 'cloro', nome: 'Cloro', categoria: 'limpeza', unidade: 'bombona 5L', validade_meses: null, variacoes: [] }],
  kit: [{ item_id: 'cloro', variacao_id: null, quantidade: 3, periodicidade_meses: 1 }],
  itens_ceu: [{ id: 'camisa', nome: 'Camisa polo azul', tipo: 'uniforme' }],
  ultimas_entregas: {},
  resumo: { envios: [], produtos: [], contagem: { uniforme_epi: 0, cracha: 0 } },
  destino: { produtos: 'novo', ceu: 'novo' },
  ...extra,
})

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/pedido/token-de-teste-com-mais-de-20']}>
      <Routes>
        <Route path="/pedido/:token" element={<PedidoLiderPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PedidoLiderPage (tela pública do líder)', () => {
  beforeEach(() => {
    api.carregar.mockReset()
    api.enviar.mockReset()
    try {
      localStorage.clear()
    } catch {
      // sem storage
    }
  })

  it('link inválido/revogado mostra mensagem própria', async () => {
    api.carregar.mockRejectedValue(new ErroPedidoApi('Link inválido ou substituído por um novo.', 'token_invalido', 404))
    renderizar()
    expect(await screen.findByText('Link inválido')).toBeInTheDocument()
  })

  it('abre o formulário com o Kit Mensal e a quantidade do kit', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    expect(await screen.findByText('CHÁCARA DO ITAGUAÍ')).toBeInTheDocument()
    expect(screen.getByText('Prazo: até 15/10')).toBeInTheDocument()
    expect(screen.getByText('Cloro')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantidade de Cloro')).toHaveValue('3')
    expect(screen.getByText('bombona 5L')).toBeInTheDocument()
  })

  it('mês com envio mostra quem enviou, os produtos e só a contagem do CEU', async () => {
    api.carregar.mockResolvedValue(
      dados({
        resumo: {
          envios: [{ tipo_pedido: 'mensal', origem: 'original', seu_nome: 'Ana', enviado_em: '2026-10-03T15:00:00Z' }],
          produtos: [{ descricao: 'Cloro', unidade: 'bombona 5L', quantidade: 3 }],
          contagem: { uniforme_epi: 3, cracha: 0 },
        },
        destino: { produtos: 'mesclar', ceu: 'mesclar' },
      })
    )
    renderizar()
    expect(await screen.findByText('Pedido de outubro enviado em 03/10 por Ana')).toBeInTheDocument()
    expect(screen.getByText(/3 itens de uniforme\/EPI/)).toBeInTheDocument()
    expect(screen.getByText(/somado ao pedido deste mês/)).toBeInTheDocument()
  })

  it('fora da janela não mostra o formulário', async () => {
    api.carregar.mockResolvedValue(
      dados({ hoje: '2026-10-20', janela: { competencia: '2026-10-01', prazo: '2026-10-15', dentroDoPrazo: false, reaberta: false, aberta: false } })
    )
    renderizar()
    expect(await screen.findByText(/O prazo do pedido deste mês terminou/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Quantidade de Cloro')).not.toBeInTheDocument()
  })

  it('não envia sem seu nome e sem a declaração', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    await screen.findByText('CHÁCARA DO ITAGUAÍ')
    fireEvent.click(screen.getByRole('button', { name: /Revisar e enviar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/ }))
    expect(await screen.findByText('Informe o seu nome.')).toBeInTheDocument()
    expect(api.enviar).not.toHaveBeenCalled()
  })
})
