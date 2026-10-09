import { describe, expect, it } from 'vitest'
import { montarPayloadPedido, qtdNumero } from './formPedido'

describe('montarPayloadPedido', () => {
  it('descarta produtos zerados e usa o nome do crachá como nome digitado', () => {
    const p = montarPayloadPedido({
      seuNome: 'Ana',
      observacao: '',
      termos: { materiais: true },
      produtos: [
        { chave: 'a', item_id: 'cloro', variacao_id: null, descricao_livre: '', quantidade: '3', justificativa: '' },
        { chave: 'b', item_id: 'balde', variacao_id: null, descricao_livre: '', quantidade: '0', justificativa: '' },
      ],
      ceu: [{ chave: 'c', tipo: 'cracha', nome: 'Maria S', item_id: '', tamanho: '', quantidade: '1', cracha_motivo: 'Perda', cracha_cordao: true }],
    })
    expect(p.produtos).toEqual([{ item_id: 'cloro', variacao_id: null, descricao_livre: null, quantidade: 3, justificativa: '' }])
    expect(p.ceu).toEqual([
      { tipo: 'cracha', nome_digitado: 'Maria S', cracha_nome: 'Maria S', cracha_motivo: 'Perda', cracha_cordao: true, quantidade: 1 },
    ])
  })

  it('qtdNumero aceita vírgula e trata inválido como 0', () => {
    expect(qtdNumero('1,5')).toBe(1.5)
    expect(qtdNumero('abc')).toBe(0)
  })
})
