import { describe, expect, it } from 'vitest'
import { casarSaldoInicial, indicesCabecalho, lerQuantidadeLimpa, type LinhaEntradaSaldo } from './saldoInicial'

const itens = [
  { id: 'cloro', nome: 'Cloro 5L', nome_lider: null, ativo: true, preparo_escritorio: false },
  { id: 'flanela', nome: 'Flanela Microfibra', nome_lider: null, ativo: true, preparo_escritorio: false },
  { id: 'livro', nome: 'Livro de Ocorrências', nome_lider: null, ativo: true, preparo_escritorio: true },
  { id: 'velho', nome: 'Sabão antigo', nome_lider: null, ativo: false, preparo_escritorio: false },
  { id: 'rem1', nome: 'Removedor Mágico Start 5L', nome_lider: 'Removedor desengraxante 5L', ativo: true, preparo_escritorio: false },
  { id: 'rem2', nome: 'Removedor Removic 5L', nome_lider: 'Removedor desengraxante 5L', ativo: true, preparo_escritorio: false },
]
const variacoes = [
  { id: 'fa', item_id: 'flanela', rotulo: 'amarela', ativo: true },
  { id: 'fz', item_id: 'flanela', rotulo: 'azul', ativo: true },
]
const aliases = [
  { nome_legado: 'Hipoclorito 5 litros', item_id: 'cloro', variacao_id: null, fator: 1 },
  { nome_legado: 'Cloro caixa 4x5L', item_id: 'cloro', variacao_id: null, fator: 4 },
  { nome_legado: 'Flanela amarela', item_id: 'flanela', variacao_id: 'fa', fator: 1 },
]
let n = 1
const l = (item: string, variacao: string, quantidade: string): LinhaEntradaSaldo => ({ linha: n++, item, variacao, quantidade })

describe('saldo inicial — só casamento exato', () => {
  it('casa nome (sem acento/maiúscula), variação e alias de fator 1', () => {
    const { casadas, pendencias } = casarSaldoInicial(
      [l('CLORO 5l', '', '12'), l('Flanela microfibra', 'Amarela', '3,5'), l('Flanela amarela', '', '1'), l('hipoclorito 5 litros', '', '0')],
      itens,
      variacoes,
      aliases
    )
    expect(pendencias.map((p) => p.motivo)).toEqual(['Item/variação repetido (já na linha 2) — some na planilha e deixe uma linha só', 'Item/variação repetido (já na linha 1) — some na planilha e deixe uma linha só'])
    expect(casadas.map((c) => [c.itemId, c.variacaoId, c.quantidade, c.via])).toEqual([
      ['cloro', null, 12, 'nome'],
      ['flanela', 'fa', 3.5, 'nome'],
    ])
  })
  it('nunca grava palpite: parecido, ambíguo, sem variação, inativo, escritório, alias com fator e quantidade suja viram pendência', () => {
    const { casadas, pendencias } = casarSaldoInicial(
      [
        l('Cloro', '', '2'),
        l('Removedor desengraxante 5L', '', '2'),
        l('Flanela Microfibra', '', '2'),
        l('Flanela Microfibra', 'verde', '2'),
        l('Sabão antigo', '', '2'),
        l('Livro de Ocorrências', '', '2'),
        l('Cloro caixa 4x5L', '', '2'),
        l('Cloro 5L', 'grande', '2'),
        l('Cloro 5L', '', '2 cx'),
        l('', '', ''),
      ],
      itens,
      variacoes,
      aliases
    )
    expect(casadas).toEqual([])
    expect(pendencias).toHaveLength(9)
    expect(pendencias.map((p) => p.motivo)).toEqual([
      'Item não encontrado no catálogo com esse nome exato',
      'Nome igual ao de mais de um item do catálogo',
      'Falta a variação (opções: amarela, azul)',
      'Variação não encontrada com esse nome exato (opções: amarela, azul)',
      'Item não encontrado no catálogo com esse nome exato',
      'Item preparado no escritório: não tem controle de estoque',
      'Item não encontrado no catálogo com esse nome exato',
      'O item não tem variação no catálogo, mas a planilha informa uma',
      'Quantidade não é um número limpo',
    ])
  })
  it('quantidade e cabeçalho', () => {
    expect(lerQuantidadeLimpa(' 10 ')).toBe(10)
    expect(lerQuantidadeLimpa('-1')).toBeNull()
    expect(lerQuantidadeLimpa('')).toBeNull()
    expect(indicesCabecalho(['Item', 'Variação', 'Quantidade'])).toEqual({ item: 0, variacao: 1, quantidade: 2 })
    expect(indicesCabecalho(['produto', 'qtd'])).toEqual({ item: 0, variacao: -1, quantidade: 1 })
    expect(indicesCabecalho(['a', 'b'])).toBeNull()
  })
})
