import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { DadosPedidoPublico } from '@/services/pedidoMateriaisApi'

const api = vi.hoisted(() => ({
  carregar: vi.fn(),
  enviar: vi.fn(),
  buscar: vi.fn(),
}))

vi.mock('@/services/pedidoMateriaisApi', async () => {
  const real = await vi.importActual<typeof import('@/services/pedidoMateriaisApi')>('@/services/pedidoMateriaisApi')
  return {
    ...real,
    carregarPedidoPublico: api.carregar,
    enviarPedidoPublico: api.enviar,
    buscarItemPublico: api.buscar,
  }
})

import { PedidoLiderPage } from './PedidoLiderPage'
import { ErroPedidoApi } from '@/services/pedidoMateriaisApi'

const dados = (extra: Partial<DadosPedidoPublico> = {}): DadosPedidoPublico => ({
  contrato: { nome: 'TELEX BAR, TIJ E IPA', recebe_limpeza: true },
  hoje: '2026-10-09',
  janela: { competencia: '2026-10-01', prazo: '2026-10-15', dentroDoPrazo: true, reaberta: false, aberta: true },
  catalogo: [{ id: 'cloro', nome: 'Cloro', categoria: 'limpeza', unidade: 'bombona 5L', validade_meses: null, variacoes: [] }],
  kit: [{ item_id: 'cloro', variacao_id: null, quantidade: 3, periodicidade_meses: 1 }],
  pecas: [
    {
      id: 'uniforme:camisa',
      rotulo: 'Camisa polo azul clara — ASG',
      tipo: 'uniforme',
      funcoes: ['asg'],
      opcoes: [
        { tamanho: 'P', item_id: 'camisa' },
        { tamanho: 'M', item_id: 'camisa' },
      ],
    },
    { id: 'uniforme:social', rotulo: 'Camisa social branca', tipo: 'uniforme', funcoes: ['portaria'], opcoes: [{ tamanho: 'M', item_id: 'social' }] },
    {
      id: 'epi:bota',
      rotulo: 'Bota PVC cano curto',
      tipo: 'epi',
      funcoes: [],
      opcoes: [
        { tamanho: '38', item_id: 'b38' },
        { tamanho: '40', item_id: 'b40' },
      ],
    },
  ],
  sem_kit_uniforme: false,
  equipe: [
    { ref: 'refAAAAAAAAA', nome: 'Michelle A.', funcao: 'asg' },
    { ref: 'refBBBBBBBBB', nome: 'João S.', funcao: 'portaria' },
  ],
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

const irParaEtapa = (nome: RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }))

describe('PedidoLiderPage (tela pública do líder)', () => {
  beforeEach(() => {
    api.carregar.mockReset()
    api.enviar.mockReset()
    api.buscar.mockReset()
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

  it('abre só com o Kit Mensal e a quantidade do kit', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    expect(await screen.findByText('TELEX BAR, TIJ E IPA')).toBeInTheDocument()
    expect(screen.getByText('Prazo: até 15/10')).toBeInTheDocument()
    expect(screen.getByText('Cloro')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantidade de Cloro')).toHaveValue('3')
    expect(screen.queryByLabelText('Adicionar item')).not.toBeInTheDocument()
  })

  it('contrato sem kit avisa e oferece "Preciso de outro item"', async () => {
    api.carregar.mockResolvedValue(dados({ catalogo: [], kit: [] }))
    renderizar()
    expect(await screen.findByText(/Este contrato ainda não tem kit cadastrado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Preciso de outro item/ })).toBeInTheDocument()
  })

  it('acima do kit pergunta o motivo em vermelho, com o campo logo abaixo', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    fireEvent.change(await screen.findByLabelText('Quantidade de Cloro'), { target: { value: '8' } })
    const pergunta = screen.getByText('Você pediu 8, mas o kit do mês é 3. Pode contar para a gente o motivo?')
    expect(pergunta.className).toMatch(/text-red/)
    expect(screen.getByLabelText('Motivo de Cloro')).toBeInTheDocument()
  })

  it('erro apontado some na hora em que o campo é corrigido (sem clicar em Próximo)', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    await screen.findByText('Cloro')
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    expect(screen.getByText('Marque a declaração para continuar.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.queryByText('Marque a declaração para continuar.')).not.toBeInTheDocument()

    irParaEtapa(/Uniformes e EPIs/)
    fireEvent.click(screen.getByRole('button', { name: 'Michelle A.' }))
    fireEvent.click(screen.getByRole('button', { name: /Bota PVC cano curto/ }))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    expect(screen.getByText(/escolha o tamanho/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '40' }))
    expect(screen.queryByText(/escolha o tamanho/)).not.toBeInTheDocument()
  })

  it('lista da equipe só com primeiro nome + inicial; mostra só as peças da função', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    await screen.findByText('Cloro')
    irParaEtapa(/Uniformes e EPIs/)
    expect(screen.getByRole('button', { name: 'João S.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Michelle A.' }))
    expect(screen.getByRole('button', { name: /Camisa polo azul clara — ASG/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Camisa social branca/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ver todas as peças do posto/ }))
    expect(screen.getByRole('button', { name: /Camisa social branca/ })).toBeInTheDocument()
  })

  it('pessoas sem peça escolhida (colaboradores 3 e 4) não travam nem viram pendência', async () => {
    api.carregar.mockResolvedValue(dados())
    api.enviar.mockResolvedValue({ ok: true, protocolo: 'ABC12345', mesclado_produtos: false, mesclado_ceu: false, virou_extra_produtos: false, virou_extra_ceu: false })
    renderizar()
    await screen.findByText('Cloro')
    fireEvent.click(screen.getByRole('checkbox')) // declaração dos materiais
    irParaEtapa(/Uniformes e EPIs/)
    fireEvent.click(screen.getByRole('button', { name: 'Michelle A.' }))
    fireEvent.click(screen.getByRole('button', { name: /Camisa polo azul clara — ASG/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'M' }))
    fireEvent.click(screen.getByRole('checkbox')) // declaração do uniforme
    fireEvent.click(screen.getByRole('button', { name: 'João S.' })) // 3ª pessoa, sem peça
    fireEvent.click(screen.getByRole('button', { name: /Outra pessoa/ }))
    fireEvent.change(screen.getByLabelText('Nome da outra pessoa'), { target: { value: 'Carla' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' })) // 4ª pessoa, sem peça
    fireEvent.click(screen.getByRole('button', { name: /Próximo/ }))
    expect(screen.getByRole('heading', { name: 'Crachás' })).toBeInTheDocument()
    irParaEtapa(/Revisar e enviar/)
    fireEvent.change(screen.getByLabelText(/Seu nome/), { target: { value: 'Ana Souza' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/ }))
    })
    expect(api.enviar).toHaveBeenCalledTimes(1)
    const corpo = api.enviar.mock.calls[0][1] as { ceu: { colaborador_ref: string | null; item_id: string }[] }
    expect(corpo.ceu).toEqual([expect.objectContaining({ colaborador_ref: 'refAAAAAAAAA', item_id: 'camisa', tamanho: 'M' })])
    expect(await screen.findByText('Pedido enviado!')).toBeInTheDocument()
  })

  it('"Preciso de outro item" sugere itens e a linha vira fora do kit com pergunta', async () => {
    api.carregar.mockResolvedValue(dados())
    api.buscar.mockResolvedValue({
      itens: [{ id: 'cabo', nome: 'Cabo de vassoura', categoria: 'limpeza', unidade: 'unidade', validade_meses: null, variacoes: [] }],
    })
    renderizar()
    await screen.findByText('Cloro')
    fireEvent.click(screen.getByRole('button', { name: /Preciso de outro item/ }))
    fireEvent.change(screen.getByLabelText('O que você precisa?'), { target: { value: 'cabo vasora' } })
    fireEvent.click(await screen.findByRole('button', { name: /Cabo de vassoura/ }, { timeout: 2000 }))
    expect(api.buscar).toHaveBeenCalledWith('token-de-teste-com-mais-de-20', 'cabo vasora', 'materiais')
    expect(screen.getByText('Fora do kit')).toBeInTheDocument()
    expect(screen.getByText(/não faz parte do kit do posto/)).toBeInTheDocument()
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

  it('a revisão lista os itens pedidos pelo nome (não só a contagem)', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    await screen.findByText('TELEX BAR, TIJ E IPA')
    fireEvent.click(screen.getByRole('checkbox')) // declaração dos materiais
    irParaEtapa(/Uniformes e EPIs/)
    fireEvent.click(screen.getByRole('button', { name: 'Michelle A.' }))
    fireEvent.click(screen.getByRole('button', { name: /Bota PVC cano curto/ }))
    fireEvent.click(screen.getByRole('radio', { name: '40' }))
    fireEvent.click(screen.getByRole('checkbox')) // declaração do EPI
    irParaEtapa(/Revisar e enviar/)
    // Produto pelo nome + unidade; peça com tamanho e pessoa.
    expect(screen.getByText('Cloro')).toBeInTheDocument()
    expect(screen.getByText(/Bota PVC cano curto — Tam\. 40 · Michelle A\./)).toBeInTheDocument()
    expect(screen.getByText(/3 bombona 5L/)).toBeInTheDocument()
  })

  it('não envia sem seu nome; o aviso some ao digitar', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    await screen.findByText('TELEX BAR, TIJ E IPA')
    irParaEtapa(/Revisar e enviar/)
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/ }))
    expect(await screen.findByText('Informe o seu nome.')).toBeInTheDocument()
    expect(api.enviar).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/Seu nome/), { target: { value: 'Ana Souza' } })
    expect(screen.queryByText('Informe o seu nome.')).not.toBeInTheDocument()
  })
})
