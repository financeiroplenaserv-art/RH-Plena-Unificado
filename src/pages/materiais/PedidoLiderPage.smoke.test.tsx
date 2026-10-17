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

const irParaEtapa = (nome: RegExp) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Passo \\d+: .*${nome.source}`) }))
const BUSCA = 'O que mais você precisa?'
const flanela = (variacao: string) => ({
  id: 'flanela',
  nome: 'Flanela Microfibra UN',
  nome_exibicao: `Flanela Microfibra ${variacao === 'fam' ? 'amarela' : 'azul'}`,
  variacao_id: variacao,
  categoria: 'acessorios',
  unidade: 'unidade',
  validade_meses: null,
  variacoes: [
    { id: 'fam', rotulo: 'amarela' },
    { id: 'faz', rotulo: 'azul' },
  ],
})

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

  it('contrato sem kit avisa e já mostra o campo único de busca', async () => {
    api.carregar.mockResolvedValue(dados({ catalogo: [], kit: [] }))
    renderizar()
    expect(await screen.findByText(/Este posto ainda não tem kit cadastrado/)).toBeInTheDocument()
    expect(screen.getByLabelText(BUSCA)).toBeInTheDocument()
    // Os dois botões antigos (confundiam) não existem mais.
    expect(screen.queryByRole('button', { name: /Preciso de outro item/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quero mais de um item do kit/ })).not.toBeInTheDocument()
  })

  it('mostra "Passo X de N" no topo', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    expect(await screen.findByText('Passo 1 de 4')).toBeInTheDocument()
    irParaEtapa(/Uniformes e EPIs/)
    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument()
  })

  it('kit do mês: o + não passa do kit e "Não preciso este mês" zera sem pedir motivo', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    await screen.findByText('Vem este mês')
    expect(screen.getByRole('button', { name: 'Aumentar Cloro' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir Cloro' }))
    expect(screen.getByLabelText('Quantidade de Cloro')).toHaveValue('2')
    expect(screen.getByText(/Vai receber 2 de 3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Não preciso' }))
    expect(screen.getByText('Você avisou que não precisa este mês.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Motivo de Cloro')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quero receber' }))
    expect(screen.getByLabelText('Quantidade de Cloro')).toHaveValue('3')
  })

  it('item do kit achado na busca cria linha EXTRA separada ("a mais"), com motivo opcional, e envia sem motivo', async () => {
    api.carregar.mockResolvedValue(dados())
    api.enviar.mockResolvedValue({
      ok: true,
      protocolo: 'ABC12345',
      mesclado_produtos: false,
      mesclado_ceu: false,
      virou_extra_produtos: false,
      virou_extra_ceu: false,
      kit_aprovado: true,
      tem_extras: true,
    })
    api.buscar.mockResolvedValue({
      itens: [{ id: 'cloro', nome: 'Cloro', nome_exibicao: 'Cloro', variacao_id: null, categoria: 'limpeza', unidade: 'bombona 5L', validade_meses: null, variacoes: [] }],
    })
    renderizar()
    await screen.findByText('Vem este mês')
    fireEvent.change(screen.getByLabelText(BUSCA), { target: { value: 'cloro' } })
    expect(await screen.findByText('Já vem no mês · pedir a mais', undefined, { timeout: 2000 })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Cloro/ }))
    expect(screen.getByText('A mais do que vem no mês')).toBeInTheDocument()
    expect(screen.getByText(/Você está pedindo 1 a mais/)).toBeInTheDocument()
    expect(screen.getByText('(se quiser contar)')).toBeInTheDocument()
    // A linha do kit continua 3; a extra é separada.
    expect(screen.getAllByLabelText('Quantidade de Cloro').map((i) => (i as HTMLInputElement).value)).toEqual(['3', '1'])
    fireEvent.click(screen.getByRole('checkbox')) // declaração dos materiais
    irParaEtapa(/Revisar e enviar/)
    expect(screen.getByText('Vem no mês')).toBeInTheDocument()
    expect(screen.getByText('Pedido a mais')).toBeInTheDocument()
    expect(screen.getByText('Cloro (a mais)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Seu nome/), { target: { value: 'Ana Souza' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/ }))
    })
    const corpo = api.enviar.mock.calls[0][1] as { produtos: { parte: string; quantidade: number; justificativa: string }[] }
    expect(corpo.produtos).toEqual([
      expect.objectContaining({ parte: 'kit', quantidade: 3 }),
      expect.objectContaining({ parte: 'extra', quantidade: 1, justificativa: '' }),
    ])
    expect(await screen.findByText(/O pedido extra passa pelo inspetor/)).toBeInTheDocument()
  })

  it('kit já confirmado no mês: só a parte do pedido extra', async () => {
    api.carregar.mockResolvedValue(dados({ kit_confirmado: true }))
    renderizar()
    expect(await screen.findByText(/já foi confirmado e já vai chegar/)).toBeInTheDocument()
    expect(screen.queryByText('Vem este mês')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Quantidade de Cloro')).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('radio', { name: 'Limpeza e encarregado' }))
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
    fireEvent.click(screen.getByRole('radio', { name: 'Limpeza e encarregado' }))
    expect(screen.queryByRole('button', { name: 'João S.' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Portaria' }))
    expect(screen.getByRole('button', { name: 'João S.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Limpeza e encarregado' }))
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
    fireEvent.click(screen.getByRole('radio', { name: 'Limpeza e encarregado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Michelle A.' }))
    fireEvent.click(screen.getByRole('button', { name: /Camisa polo azul clara — ASG/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'M' }))
    fireEvent.click(screen.getByRole('checkbox')) // declaração do uniforme
    fireEvent.click(screen.getByRole('radio', { name: 'Portaria' }))
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

  describe('quadros que recolhem depois do "Pronto" (16/10/2026)', () => {
    const buscarFlanela = async (variacao: string) => {
      api.buscar.mockResolvedValue({ itens: [flanela(variacao)] })
      fireEvent.change(screen.getByLabelText(BUSCA), { target: { value: `flanela ${variacao}` } })
      fireEvent.click(await screen.findByRole('button', { name: /^Flanela Microfibra/ }, { timeout: 2000 }))
    }

    it('extra: "Pronto" recolhe numa linha resumida, tocar reabre e o foco volta para a busca', async () => {
      api.carregar.mockResolvedValue(dados())
      renderizar()
      await screen.findByText('Cloro')
      await buscarFlanela('fam')
      fireEvent.change(screen.getByLabelText('Quantidade de Flanela Microfibra amarela'), { target: { value: '2' } })
      fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
      expect(screen.queryByLabelText('Quantidade de Flanela Microfibra amarela')).not.toBeInTheDocument()
      const resumo = screen.getByRole('button', { name: 'Editar: Flanela Microfibra amarela — 2' })
      expect(screen.getByText('1 item pedido')).toBeInTheDocument()
      await vi.waitFor(() => expect(screen.getByLabelText(BUSCA)).toHaveFocus())
      fireEvent.click(resumo)
      expect(screen.getByLabelText('Quantidade de Flanela Microfibra amarela')).toHaveValue('2')
    })

    it('extra: abrir um item novo recolhe o anterior válido', async () => {
      api.carregar.mockResolvedValue(dados())
      renderizar()
      await screen.findByText('Cloro')
      await buscarFlanela('fam')
      await buscarFlanela('faz')
      expect(screen.queryByLabelText('Quantidade de Flanela Microfibra amarela')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Editar: Flanela Microfibra amarela — 1/ })).toBeInTheDocument()
      expect(screen.getByLabelText('Quantidade de Flanela Microfibra azul')).toBeInTheDocument()
      expect(screen.getByText('2 itens pedidos')).toBeInTheDocument()
    })

    it('extra: quantidade vazia não recolhe e mostra o erro', async () => {
      api.carregar.mockResolvedValue(dados())
      renderizar()
      await screen.findByText('Cloro')
      await buscarFlanela('fam')
      fireEvent.change(screen.getByLabelText('Quantidade de Flanela Microfibra amarela'), { target: { value: '' } })
      fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
      expect(screen.getByLabelText('Quantidade de Flanela Microfibra amarela')).toBeInTheDocument()
      expect(screen.getByText('Diga quantos você precisa.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Editar:/ })).not.toBeInTheDocument()
    })

    it('uniforme: sem tamanho o "Pronto" não recolhe; com tamanho vira "Pessoa · Peça tamanho — qtd"', async () => {
      api.carregar.mockResolvedValue(dados())
      renderizar()
      await screen.findByText('Cloro')
      irParaEtapa(/Uniformes e EPIs/)
      fireEvent.click(screen.getByRole('radio', { name: 'Limpeza e encarregado' }))
      fireEvent.click(screen.getByRole('button', { name: 'Michelle A.' }))
      fireEvent.click(screen.getByRole('button', { name: /Camisa polo azul clara — ASG/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
      expect(screen.getByText(/escolha o tamanho/)).toBeInTheDocument()
      expect(screen.getByRole('radiogroup', { name: /Tamanho de/ })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('radio', { name: 'M' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
      expect(screen.queryByRole('radiogroup', { name: /Tamanho de/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Editar: Michelle A. · Camisa polo azul clara — ASG M — 1' })).toBeInTheDocument()
    })

    it('crachá: sem motivo não recolhe; com motivo vira "Crachá · Nome — motivo"', async () => {
      api.carregar.mockResolvedValue(dados())
      renderizar()
      await screen.findByText('Cloro')
      irParaEtapa(/Crachás/)
      fireEvent.click(screen.getByRole('button', { name: 'Michelle A.' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
      expect(screen.getByRole('radiogroup', { name: 'Motivo do pedido' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('radio', { name: 'Perda' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
      expect(screen.getByRole('button', { name: 'Editar: Crachá · Michelle A. — perda' })).toBeInTheDocument()
    })

    it('remover pede confirmação antes de apagar', async () => {
      api.carregar.mockResolvedValue(dados())
      renderizar()
      await screen.findByText('Cloro')
      await buscarFlanela('fam')
      fireEvent.click(screen.getByRole('button', { name: 'Remover Flanela Microfibra amarela' }))
      expect(screen.getByLabelText('Quantidade de Flanela Microfibra amarela')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Apagar' }))
      expect(screen.queryByLabelText('Quantidade de Flanela Microfibra amarela')).not.toBeInTheDocument()
    })

    it('equipe aparece em ordem alfabética (sem peso de acento) e "Outra pessoa" fica no fim', async () => {
      api.carregar.mockResolvedValue(
        dados({
          equipe: [
            { ref: 'r1aaaaaaaaaa', nome: 'Zélia P.', funcao: 'asg' },
            { ref: 'r2aaaaaaaaaa', nome: 'Évelin R.', funcao: 'asg' },
            { ref: 'r3aaaaaaaaaa', nome: 'Ana C.', funcao: 'asg' },
            { ref: 'r4aaaaaaaaaa', nome: 'Dagno S.', funcao: 'asg' },
          ],
        })
      )
      renderizar()
      await screen.findByText('Cloro')
      irParaEtapa(/Uniformes e EPIs/)
      const nomes = screen.getAllByRole('button').map((b) => (b.textContent ?? '').trim()).filter((t) => /^(Zélia|Évelin|Ana|Dagno)|Outra pessoa/.test(t))
      expect(nomes).toEqual(['Ana C.', 'Dagno S.', 'Évelin R.', 'Zélia P.', 'Outra pessoa (ferista/cobertura)'])
    })
  })

  it('busca única: item fora do kit vira "não vem todo mês" com pergunta; "Não achei" vira texto livre', async () => {
    api.carregar.mockResolvedValue(dados())
    api.buscar.mockResolvedValue({
      itens: [{ id: 'cabo', nome: 'Cabo de vassoura', categoria: 'limpeza', unidade: 'unidade', validade_meses: null, variacoes: [] }],
    })
    renderizar()
    await screen.findByText('Cloro')
    fireEvent.change(screen.getByLabelText(BUSCA), { target: { value: 'cabo vasora' } })
    fireEvent.click(await screen.findByRole('button', { name: /Cabo de vassoura/ }, { timeout: 2000 }))
    expect(api.buscar).toHaveBeenCalledWith('token-de-teste-com-mais-de-20', 'cabo vasora', 'materiais')
    expect(screen.getByText('Não vem todo mês')).toBeInTheDocument()
    expect(screen.getByText(/Este item não vem todo mês/)).toBeInTheDocument()
    // O campo fica limpo para a próxima busca.
    expect(screen.getByLabelText(BUSCA)).toHaveValue('')
    api.buscar.mockResolvedValue({ itens: [] })
    fireEvent.change(screen.getByLabelText(BUSCA), { target: { value: 'pá de neve' } })
    fireEvent.click(await screen.findByRole('button', { name: /Não achei, enviar assim/ }, { timeout: 2000 }))
    expect(screen.getByText('pá de neve')).toBeInTheDocument()
    expect(screen.getByText('Escrito por você')).toBeInTheDocument()
  })

  it('variação: um quadro por variação, sem escolha dentro do quadro; a mesma de novo soma', async () => {
    api.carregar.mockResolvedValue(dados())
    renderizar()
    await screen.findByText('Cloro')
    const escolher = async (variacao: string, nome: RegExp) => {
      api.buscar.mockResolvedValue({ itens: [flanela(variacao)] })
      fireEvent.change(screen.getByLabelText(BUSCA), { target: { value: `flanela ${variacao}` } })
      fireEvent.click(await screen.findByRole('button', { name: nome }, { timeout: 2000 }))
    }
    await escolher('fam', /^Flanela Microfibra amarela/)
    expect(screen.getByText('Flanela Microfibra amarela')).toBeInTheDocument()
    // Nada de "tocar em várias cores" dentro do quadro.
    expect(screen.queryByRole('radio', { name: 'azul' })).not.toBeInTheDocument()
    await escolher('fam', /^Flanela Microfibra amarela/)
    expect(screen.getByLabelText('Quantidade de Flanela Microfibra amarela')).toHaveValue('2')
    expect(screen.getByRole('status')).toHaveTextContent('Flanela Microfibra amarela já estava na lista. Somamos mais 1.')
    await escolher('faz', /^Flanela Microfibra azul/)
    expect(screen.getByLabelText('Quantidade de Flanela Microfibra azul')).toHaveValue('1')
    fireEvent.click(screen.getByRole('checkbox')) // declaração dos materiais
    irParaEtapa(/Revisar e enviar/)
    expect(screen.getByText('Flanela Microfibra amarela')).toBeInTheDocument()
    expect(screen.getByText('Flanela Microfibra azul')).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('radio', { name: 'Limpeza e encarregado' }))
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

  it('visão do líder (migration 136): kit com nome do líder e mop sem marca, também na revisão', async () => {
    api.carregar.mockResolvedValue(
      dados({
        catalogo: [
          { id: 'removic', nome: 'Removedor desengraxante Removic 5L', nome_lider: 'Removedor desengraxante 5L', categoria: 'limpeza', unidade: 'galão 5L', validade_meses: null, variacoes: [] },
          // marcas ocultas: o servidor já devolve o mop sem variações
          { id: 'mopp', nome: 'Mop Cabeleira Pequena UN', categoria: 'limpeza', unidade: 'unidade', validade_meses: null, variacoes: [] },
        ],
        kit: [
          { item_id: 'removic', variacao_id: null, quantidade: 1, periodicidade_meses: 1 },
          { item_id: 'mopp', variacao_id: null, quantidade: 6, periodicidade_meses: 1 },
        ],
      })
    )
    renderizar()
    expect(await screen.findByText('Removedor desengraxante 5L')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantidade de Mop Cabeleira Pequena')).toHaveValue('6')
    expect(screen.queryByText(/Removic/)).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox')) // declaração dos materiais
    irParaEtapa(/Revisar e enviar/)
    expect(screen.getByText('Removedor desengraxante 5L')).toBeInTheDocument()
    expect(screen.getByText('Mop Cabeleira Pequena')).toBeInTheDocument()
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

  describe('busca local (catálogo no aparelho, 16/10/2026)', () => {
    const catalogoBusca = [
      { id: 'vass', nome: 'Vassoura Especial UN', categoria: 'limpeza', unidade: 'unidade', validade_meses: null, variacoes: [{ id: 'v-pia', rotulo: 'Piaçava' }, { id: 'v-novi', rotulo: 'Noviça' }], aliases: [], aliasesPorVariacao: {}, noKit: false, variacoesNoKit: [] },
      { id: 'disco', nome: 'Disco branco UN', categoria: 'limpeza', unidade: 'unidade', validade_meses: null, variacoes: [{ id: 'd350', rotulo: '350 mm' }, { id: 'd410', rotulo: '410 mm' }], aliases: [], aliasesPorVariacao: {}, noKit: false, variacoesNoKit: [] },
    ] as DadosPedidoPublico['catalogo_busca']

    it('acha "piaçava" e "disco 350" sem chamar a rede', async () => {
      api.carregar.mockResolvedValue(dados({ catalogo_busca: catalogoBusca }))
      renderizar()
      await screen.findByText('Vem este mês')
      fireEvent.change(screen.getByLabelText(BUSCA), { target: { value: 'piaçava' } })
      expect(await screen.findByRole('button', { name: /Vassoura Piaçava/ })).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText(BUSCA), { target: { value: 'disco 350' } })
      expect(await screen.findByRole('button', { name: /Disco branco 350 mm/ })).toBeInTheDocument()
      expect(api.buscar).not.toHaveBeenCalled()
      expect(screen.queryByText('Procurando...')).not.toBeInTheDocument()
    })

    it('sem catálogo na resposta (function antiga) cai para a busca pela rede', async () => {
      api.carregar.mockResolvedValue(dados())
      api.buscar.mockResolvedValue({ itens: [] })
      renderizar()
      await screen.findByText('Vem este mês')
      fireEvent.change(screen.getByLabelText(BUSCA), { target: { value: 'piaçava' } })
      await screen.findByText('Não encontramos nada parecido.', undefined, { timeout: 2000 })
      expect(api.buscar).toHaveBeenCalledTimes(1)
    })
  })
})
