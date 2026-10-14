import { describe, expect, it } from 'vitest'
import type { PecaPublica } from '@/lib/materiais/pecasCeu'
import { errosDe, itemDaLinhaPeca, montarPayloadPedido, qtdNumero, type RascunhoPedido } from './formPedido'

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
  it('descarta produtos zerados e leva a chave da linha (erros ligados ao campo)', () => {
    const p = montarPayloadPedido(
      {
        ...vazio,
        termos: { materiais: true },
        produtos: [
          { chave: 'a', item_id: 'cloro', variacao_id: null, descricao_livre: '', quantidade: '3', justificativa: '', secao: 'materiais', origem: 'kit' },
          { chave: 'b', item_id: 'balde', variacao_id: null, descricao_livre: '', quantidade: '0', justificativa: '', secao: 'materiais', origem: 'kit' },
          { chave: 'c', item_id: null, variacao_id: null, descricao_livre: 'cabo vasora', quantidade: '2', justificativa: 'quebrou', secao: 'materiais', origem: 'livre' },
        ],
      },
      []
    )
    expect(p.produtos).toEqual([
      { chave: 'a', item_id: 'cloro', variacao_id: null, descricao_livre: null, quantidade: 3, justificativa: '' },
      { chave: 'c', item_id: null, variacao_id: null, descricao_livre: 'cabo vasora', quantidade: 2, justificativa: 'quebrou' },
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
