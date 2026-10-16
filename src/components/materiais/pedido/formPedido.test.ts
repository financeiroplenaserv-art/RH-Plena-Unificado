import { describe, expect, it } from 'vitest'
import type { ContextoPedido, ItemPublico } from '@/lib/materiais/pedidoLider'
import type { PecaPublica } from '@/lib/materiais/pecasCeu'
import {
  errosDe,
  itemDaLinhaPeca,
  linhasKitDoForm,
  maximoDaLinhaKit,
  montarPayloadPedido,
  nomeDaLinhaProduto,
  perguntaSimples,
  qtdNumero,
  reconciliarRascunhoComKit,
  type LinhaProdutoForm,
  type RascunhoPedido,
} from './formPedido'

const bota: PecaPublica = {
  id: 'epi:bota',
  rotulo: 'Bota PVC cano curto',
  tipo: 'epi',
  funcoes: [],
  opcoes: [
    { tamanho: '38', item_id: 'b38' },
    { tamanho: '40', item_id: 'b40' },
  ],
}

const vazio: RascunhoPedido = {
  versao: 2,
  produtos: [],
  itensBusca: [],
  pessoas: [],
  pecas: [],
  crachas: [],
  termos: {},
  seuNome: 'Ana',
  observacao: '',
}

describe('montarPayloadPedido', () => {
  it('leva a linha do kit mesmo zerada ("Não preciso este mês"), descarta extra zerado e marca a parte', () => {
    const p = montarPayloadPedido(
      {
        ...vazio,
        termos: { materiais: true },
        produtos: [
          { chave: 'a', item_id: 'cloro', variacao_id: null, descricao_livre: '', quantidade: '3', justificativa: '', secao: 'materiais', origem: 'kit' },
          { chave: 'b', item_id: 'balde', variacao_id: null, descricao_livre: '', quantidade: '0', justificativa: '', secao: 'materiais', origem: 'kit' },
          { chave: 'c', item_id: null, variacao_id: null, descricao_livre: 'cabo vasora', quantidade: '2', justificativa: 'quebrou', secao: 'materiais', origem: 'livre' },
          { chave: 'd', item_id: 'cloro', variacao_id: null, descricao_livre: '', quantidade: '0', justificativa: '', secao: 'materiais', origem: 'mais' },
          { chave: 'e', item_id: 'cloro', variacao_id: null, descricao_livre: '', quantidade: '2', justificativa: '', secao: 'materiais', origem: 'mais' },
        ],
      },
      []
    )
    expect(p.produtos).toEqual([
      { chave: 'a', parte: 'kit', item_id: 'cloro', variacao_id: null, descricao_livre: null, quantidade: 3, justificativa: '' },
      { chave: 'b', parte: 'kit', item_id: 'balde', variacao_id: null, descricao_livre: null, quantidade: 0, justificativa: '' },
      { chave: 'c', parte: 'extra', item_id: null, variacao_id: null, descricao_livre: 'cabo vasora', quantidade: 2, justificativa: 'quebrou' },
      { chave: 'e', parte: 'extra', item_id: 'cloro', variacao_id: null, descricao_livre: null, quantidade: 2, justificativa: '' },
    ])
  })

  it('pessoa da equipe vai só com o ref; outra pessoa com o nome; o tamanho escolhe o item', () => {
    const p = montarPayloadPedido(
      {
        ...vazio,
        pessoas: [
          { chave: 'p1', ref: 'refAAAAAAAAA', nome: 'Michelle A.' },
          { chave: 'p2', ref: null, nome: 'Carla (ferista)' },
        ],
        pecas: [
          { chave: 'l1', pessoa: 'p1', peca_id: 'epi:bota', tamanho: '40', quantidade: '1' },
          { chave: 'l2', pessoa: 'p2', peca_id: 'epi:bota', tamanho: '', quantidade: '2' },
        ],
        crachas: [{ chave: 'k1', ref: 'refAAAAAAAAA', nome: 'Michelle A.', cracha_nome: '', cracha_motivo: 'Perda', cracha_cordao: true }],
      },
      [bota]
    )
    expect(p.ceu).toEqual([
      { chave: 'l1', tipo: 'epi', colaborador_ref: 'refAAAAAAAAA', nome_digitado: '', item_id: 'b40', tamanho: '40', quantidade: 1 },
      { chave: 'l2', tipo: 'epi', colaborador_ref: null, nome_digitado: 'Carla (ferista)', item_id: 'b38', tamanho: '', quantidade: 2 },
      {
        chave: 'k1',
        tipo: 'cracha',
        colaborador_ref: 'refAAAAAAAAA',
        nome_digitado: '',
        cracha_nome: '',
        cracha_motivo: 'Perda',
        cracha_cordao: true,
        quantidade: 1,
      },
    ])
    // Nada de nome da pessoa da equipe no corpo (o servidor resolve pelo ref).
    expect(JSON.stringify(p.ceu)).not.toMatch(/Michelle/)
  })

  it('utilitários', () => {
    expect(qtdNumero('1,5')).toBe(1.5)
    expect(qtdNumero('abc')).toBe(0)
    expect(itemDaLinhaPeca(bota, '38')).toBe('b38')
    expect(itemDaLinhaPeca(undefined, '38')).toBe('')
    expect(errosDe([{ chave: 'a', campo: 'tamanho', mensagem: 'x' }, { chave: 'b', campo: 'tamanho', mensagem: 'y' }], 'a')).toEqual(['x'])
  })
})

describe('reconciliarRascunhoComKit (rascunho × kit alterado no meio do mês)', () => {
  const cloro: ItemPublico = { id: 'cloro', nome: 'Cloro', categoria: 'limpeza', unidade: 'bombona 5L', validade_meses: null, variacoes: [] }
  const balde: ItemPublico = { id: 'balde', nome: 'Balde 8L', categoria: 'limpeza', unidade: 'unidade', validade_meses: null, variacoes: [] }
  const livro: ItemPublico = { id: 'livro', nome: 'Livro de Ocorrências', categoria: 'portaria', unidade: 'unidade', validade_meses: null, variacoes: [] }
  const ctx: Pick<ContextoPedido, 'kit' | 'catalogo' | 'ultimasEntregas' | 'hoje' | 'recebeLimpeza' | 'kitConfirmado'> = {
    hoje: '2026-10-09',
    recebeLimpeza: true,
    catalogo: [cloro, balde, livro],
    kit: [
      { item_id: 'cloro', variacao_id: null, quantidade: 3, periodicidade_meses: 1 },
      { item_id: 'livro', variacao_id: null, quantidade: 1, periodicidade_meses: 1 },
    ],
    ultimasEntregas: {},
  }
  const linha = (parcial: Partial<LinhaProdutoForm> & Pick<LinhaProdutoForm, 'chave'>): LinhaProdutoForm => ({
    item_id: null,
    variacao_id: null,
    descricao_livre: '',
    quantidade: '1',
    justificativa: '',
    secao: 'materiais',
    origem: 'kit',
    ...parcial,
  })

  it('acrescenta item novo do kit com a quantidade do kit e mantém a quantidade reduzida pelo líder', () => {
    const rec = reconciliarRascunhoComKit(
      {
        produtos: [linha({ chave: 'a', item_id: 'cloro', quantidade: '2' })],
        itensBusca: [],
      },
      ctx
    )
    expect(rec.produtos).toHaveLength(2)
    expect(rec.produtos[0]).toMatchObject({ chave: 'a', item_id: 'cloro', quantidade: '2' }) // reduzida, intocada
    expect(rec.produtos[1]).toMatchObject({ item_id: 'livro', quantidade: '1', origem: 'kit', secao: 'portaria' })
  })

  it('rascunho antigo (v2) com kit acima do kit do mês: o excedente vira linha "a mais" (pedido extra) com o motivo', () => {
    const rec = reconciliarRascunhoComKit(
      {
        produtos: [linha({ chave: 'a', item_id: 'cloro', quantidade: '5', justificativa: 'Obra' })],
        itensBusca: [],
      },
      ctx
    )
    expect(rec.produtos.find((l) => l.chave === 'a')).toMatchObject({ origem: 'kit', quantidade: '3', justificativa: '' })
    expect(rec.produtos.find((l) => l.origem === 'mais')).toMatchObject({ item_id: 'cloro', quantidade: '2', justificativa: 'Obra' })
    // Extras vêm depois do kit.
    expect(rec.produtos.map((l) => l.origem)).toEqual(['kit', 'kit', 'mais'])
  })

  it('remove linha do kit cujo item saiu do kit/catálogo; preserva busca, livre e "a mais"', () => {
    const rec = reconciliarRascunhoComKit(
      {
        produtos: [
          linha({ chave: 'a', item_id: 'balde' }), // saiu do kit
          linha({ chave: 'b', item_id: 'cabo', origem: 'busca', quantidade: '2' }),
          linha({ chave: 'c', item_id: null, descricao_livre: 'Pá de lixo', origem: 'livre' }),
          linha({ chave: 'd', item_id: 'cloro', origem: 'mais', quantidade: '1' }),
        ],
        itensBusca: [{ id: 'cabo', nome: 'Cabo de vassoura', categoria: 'limpeza', unidade: 'unidade', validade_meses: null, variacoes: [] }],
      },
      ctx
    )
    expect(rec.produtos.filter((l) => l.origem === 'kit').map((l) => l.item_id)).toEqual(['cloro', 'livro'])
    expect(rec.produtos.filter((l) => l.origem !== 'kit').map((l) => l.chave)).toEqual(['b', 'c', 'd'])
  })

  it('kit já confirmado no mês (outro envio): as linhas do kit saem, os extras ficam', () => {
    const rec = reconciliarRascunhoComKit(
      {
        produtos: [linha({ chave: 'a', item_id: 'cloro', quantidade: '3' }), linha({ chave: 'd', item_id: 'cloro', origem: 'mais', quantidade: '1' })],
        itensBusca: [],
      },
      { ...ctx, kitConfirmado: true }
    )
    expect(rec.produtos.map((l) => l.chave)).toEqual(['d'])
    expect(linhasKitDoForm({ ...ctx, kitConfirmado: true })).toEqual([])
  })

  it('linhas do kit do form: só o que vem este mês; máximo = kit do mês', () => {
    const linhas = linhasKitDoForm({ ...ctx, ultimasEntregas: {} })
    expect(linhas.map((l) => [l.item_id, l.quantidade, l.origem])).toEqual([
      ['cloro', '3', 'kit'],
      ['livro', '1', 'kit'],
    ])
    expect(maximoDaLinhaKit(ctx, { item_id: 'cloro', variacao_id: null })).toBe(3)
    expect(maximoDaLinhaKit(ctx, { item_id: 'balde', variacao_id: null })).toBe(0)
  })

  it('linha de busca cujo item sumiu do rascunho da busca também sai', () => {
    const rec = reconciliarRascunhoComKit(
      {
        produtos: [linha({ chave: 'b', item_id: 'cabo', origem: 'busca' })],
        itensBusca: [],
      },
      ctx
    )
    expect(rec.produtos.some((l) => l.chave === 'b')).toBe(false)
  })

  it('contrato só-portaria: linha de limpeza do rascunho sai junto com o kit de limpeza', () => {
    const rec = reconciliarRascunhoComKit(
      {
        produtos: [linha({ chave: 'a', item_id: 'cloro' })],
        itensBusca: [],
      },
      { ...ctx, recebeLimpeza: false }
    )
    expect(rec.produtos.map((l) => l.item_id)).toEqual(['livro'])
  })

  it('não duplica linha do kit repetida no rascunho (vale a primeira)', () => {
    const rec = reconciliarRascunhoComKit(
      {
        produtos: [linha({ chave: 'a', item_id: 'cloro', quantidade: '2' }), linha({ chave: 'b', item_id: 'cloro', quantidade: '1' })],
        itensBusca: [],
      },
      ctx
    )
    expect(rec.produtos.filter((l) => l.item_id === 'cloro')).toEqual([expect.objectContaining({ chave: 'a', quantidade: '2' })])
  })
})

describe('variações no link do líder (16/10/2026)', () => {
  const flanela: ItemPublico = {
    id: 'fl',
    nome: 'Flanela Microfibra UN',
    categoria: 'acessorios',
    unidade: 'unidade',
    validade_meses: null,
    variacoes: [
      { id: 'fam', rotulo: 'amarela' },
      { id: 'faz', rotulo: 'azul' },
    ],
  }
  const vassoura: ItemPublico = {
    id: 've',
    nome: 'Vassoura Especial UN',
    categoria: 'acessorios',
    unidade: 'unidade',
    validade_meses: null,
    variacoes: [{ id: 'nov', rotulo: 'Noviça' }],
  }
  const ctx: Pick<ContextoPedido, 'kit' | 'catalogo' | 'ultimasEntregas' | 'hoje' | 'recebeLimpeza' | 'kitConfirmado'> = {
    hoje: '2026-10-09',
    recebeLimpeza: true,
    catalogo: [flanela, vassoura],
    // Duas cores do MESMO item no kit + um item cadastrado sem variação.
    kit: [
      { item_id: 'fl', variacao_id: 'fam', quantidade: 2, periodicidade_meses: 1 },
      { item_id: 'fl', variacao_id: 'faz', quantidade: 3, periodicidade_meses: 1 },
      { item_id: 've', variacao_id: null, quantidade: 1, periodicidade_meses: 1 },
    ],
    ultimasEntregas: {},
  }

  it('nome da linha: nome amigável com a variação; texto livre como escrito', () => {
    expect(nomeDaLinhaProduto({ item_id: 'fl', variacao_id: 'fam', descricao_livre: '' }, flanela)).toBe('Flanela Microfibra amarela')
    expect(nomeDaLinhaProduto({ item_id: 've', variacao_id: 'nov', descricao_livre: '' }, vassoura)).toBe('Vassoura Noviça')
    expect(nomeDaLinhaProduto({ item_id: 've', variacao_id: null, descricao_livre: '' }, vassoura)).toBe('Vassoura Especial')
    expect(nomeDaLinhaProduto({ item_id: null, variacao_id: null, descricao_livre: ' pá de neve ' })).toBe('pá de neve')
  })

  it('kit com duas cores do mesmo item: duas linhas, cada uma com seu máximo, e o rascunho não perde nenhuma', () => {
    const linhas = linhasKitDoForm(ctx)
    expect(linhas.map((l) => [l.item_id, l.variacao_id, l.quantidade])).toEqual([
      ['fl', 'fam', '2'],
      ['fl', 'faz', '3'],
      ['ve', null, '1'],
    ])
    expect(maximoDaLinhaKit(ctx, { item_id: 'fl', variacao_id: 'faz' })).toBe(3)
    // Linha do kit "qualquer variação" com a variação escolhida pelo líder: máximo do kit sem variação.
    expect(maximoDaLinhaKit(ctx, { item_id: 've', variacao_id: 'nov' })).toBe(1)
    const rec = reconciliarRascunhoComKit({ produtos: linhas.map((l) => (l.variacao_id === 'faz' ? { ...l, quantidade: '1' } : l)), itensBusca: [] }, ctx)
    expect(rec.produtos.map((l) => [l.variacao_id, l.quantidade])).toEqual([
      ['fam', '2'],
      ['faz', '1'],
      [null, '1'],
    ])
  })

  it('pergunta do motivo em linguagem simples (sem "kit")', () => {
    expect(perguntaSimples({ foraKit: true, acimaKit: false }, 1)).toBe('Este item não vem todo mês. Por que você precisa?')
    expect(perguntaSimples({ foraKit: false, acimaKit: true }, 2.5)).toBe('Você está pedindo 2,5 a mais. Por que precisa?')
    expect(perguntaSimples({ foraKit: false, acimaKit: false }, 1)).toBe('')
  })
})
