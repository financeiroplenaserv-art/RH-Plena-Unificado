import { describe, expect, it } from 'vitest'
import {
  agruparPorItem,
  avisoJanelaCompra,
  compraDoGrupo,
  montarPayloadReposicao,
  descricaoItemCompra,
  diasDesdeContagem,
  doMesAnterior,
  erroDestino,
  montarPayloadCompra,
  normalizarPrevia,
  resumoPorFornecedor,
  sugerirDestinos,
  tipoDestino,
  type LinhaPrevia,
} from './compra'

const base: LinhaPrevia = {
  linha_id: 'l1',
  pedido_id: 'p1',
  pedido_tipo: 'mensal',
  competencia: '2026-10-01',
  status_pedido: 'aprovado',
  contrato_id: 'c1',
  contrato_nome: 'Abaeté',
  rota: 1,
  parte: 'kit',
  item_id: 'i1',
  variacao_id: null,
  descricao_livre: null,
  item_nome: 'Cloro 5L',
  variacao_rotulo: null,
  unidade: 'GL',
  categoria: 'limpeza',
  ordem: 1,
  preparo_escritorio: false,
  qtd_aprovada: 4,
  preco_pedido: 10,
  preco_vigente: 12,
  fornecedor_padrao_id: 'antolimp',
  fornecedor_padrao_nome: 'Antolimp',
  saldo_estoque: 0,
  created_at: '2026-10-05T10:00:00Z',
}
const l = (p: Partial<LinhaPrevia>): LinhaPrevia => ({ ...base, ...p })

describe('descricaoItemCompra', () => {
  it('põe a variação antes da unidade do fim do nome', () => {
    expect(descricaoItemCompra('Disco preto UN', '350 mm')).toBe('Disco preto 350 mm UN')
    expect(descricaoItemCompra('Flanela Microfibra', 'amarela')).toBe('Flanela Microfibra amarela')
    expect(descricaoItemCompra('Cloro 5L', null)).toBe('Cloro 5L')
    expect(descricaoItemCompra(null)).toBe('Item')
  })
})

describe('sugerirDestinos — estoque primeiro', () => {
  it('em outubro (saldo 0) tudo vai ao fornecedor padrão', () => {
    const d = sugerirDestinos([l({}), l({ linha_id: 'l2', contrato_nome: 'Telex', qtd_aprovada: 2 })])
    expect(d.l1).toEqual({ qtdEstoque: 0, qtdCompra: 4, fornecedorId: 'antolimp', naoAtender: false, motivo: '' })
    expect(d.l2.qtdCompra).toBe(2)
  })
  it('usa o saldo até acabar, kit antes do extra', () => {
    const d = sugerirDestinos([
      l({ linha_id: 'extra', parte: 'extra', qtd_aprovada: 3, saldo_estoque: 5 }),
      l({ linha_id: 'kit', parte: 'kit', qtd_aprovada: 4, saldo_estoque: 5 }),
    ])
    expect(d.kit).toMatchObject({ qtdEstoque: 4, qtdCompra: 0 })
    expect(d.extra).toMatchObject({ qtdEstoque: 1, qtdCompra: 2 })
  })
  it('saldo negativo não conta e item do escritório/texto livre ficam de fora', () => {
    const d = sugerirDestinos([
      l({ saldo_estoque: -3 }),
      l({ linha_id: 'esc', preparo_escritorio: true }),
      l({ linha_id: 'txt', item_id: null, descricao_livre: 'vassoura gari' }),
    ])
    expect(d.l1.qtdEstoque).toBe(0)
    expect(d.esc).toBeUndefined()
    expect(d.txt).toBeUndefined()
  })
  it('saldo é por item + variação', () => {
    const d = sugerirDestinos([
      l({ linha_id: 'a', variacao_id: 'amarela', saldo_estoque: 10 }),
      l({ linha_id: 'b', variacao_id: 'azul', saldo_estoque: 0 }),
    ])
    expect(d.a.qtdEstoque).toBe(4)
    expect(d.b.qtdEstoque).toBe(0)
  })
})

describe('erroDestino e tipoDestino', () => {
  const d = (p: Partial<{ qtdEstoque: number; qtdCompra: number; fornecedorId: string | null; naoAtender: boolean; motivo: string }>) => ({
    qtdEstoque: 0,
    qtdCompra: 4,
    fornecedorId: 'antolimp',
    naoAtender: false,
    motivo: '',
    ...p,
  })
  it('aceita compra integral e divisão', () => {
    expect(erroDestino(l({}), d({}))).toBeNull()
    expect(erroDestino(l({}), d({ qtdEstoque: 1, qtdCompra: 3 }))).toBeNull()
    expect(tipoDestino(l({}), d({ qtdEstoque: 1, qtdCompra: 3 }))).toBe('dividida')
  })
  it('recusa acima do aprovado e corte sem motivo', () => {
    expect(erroDestino(l({}), d({ qtdCompra: 5 }))).toMatch(/Passa do aprovado/)
    expect(erroDestino(l({}), d({ qtdCompra: 2 }))).toMatch(/motivo/)
    expect(erroDestino(l({}), d({ qtdCompra: 2, motivo: 'fornecedor sem estoque' }))).toBeNull()
  })
  it('não atender exige motivo; zero vira não atendido', () => {
    expect(erroDestino(l({}), d({ naoAtender: true }))).toMatch(/motivo/)
    expect(tipoDestino(l({}), d({ qtdCompra: 0 }))).toBe('nao_atendido')
  })
  it('compra sem fornecedor e texto livre', () => {
    expect(erroDestino(l({}), d({ fornecedorId: null }))).toMatch(/fornecedor/)
    expect(erroDestino(l({ item_id: null }), undefined)).toMatch(/Texto livre/)
    expect(erroDestino(l({ item_id: null }), d({ naoAtender: true, motivo: 'não temos' }))).toBeNull()
  })
  it('item do escritório não precisa de destino', () => {
    expect(tipoDestino(l({ preparo_escritorio: true }), undefined)).toBe('escritorio')
    expect(erroDestino(l({ preparo_escritorio: true }), undefined)).toBeNull()
  })
})

describe('montarPayloadCompra', () => {
  it('monta o payload e devolve os erros linha a linha', () => {
    const linhas = [
      l({}),
      l({ linha_id: 'esc', preparo_escritorio: true }),
      l({ linha_id: 'nao', qtd_aprovada: 2 }),
      l({ linha_id: 'ruim', qtd_aprovada: 2 }),
    ]
    const destinos = {
      ...sugerirDestinos(linhas),
      nao: { qtdEstoque: 0, qtdCompra: 0, fornecedorId: null, naoAtender: true, motivo: 'sem verba' },
      ruim: { qtdEstoque: 0, qtdCompra: 9, fornecedorId: 'antolimp', naoAtender: false, motivo: '' },
    }
    const { payload, erros } = montarPayloadCompra(linhas, destinos)
    expect(payload).toEqual([
      { id: 'l1', qtd_estoque: 0, qtd_compra: 4, fornecedor_id: 'antolimp', motivo: null },
      { id: 'esc' },
      { id: 'nao', nao_atender: true, motivo: 'sem verba' },
    ])
    expect(erros).toEqual([{ linhaId: 'ruim', erro: 'Passa do aprovado (2).' }])
  })
  it('respeita a seleção', () => {
    const linhas = [l({}), l({ linha_id: 'l2' })]
    const { payload } = montarPayloadCompra(linhas, sugerirDestinos(linhas), new Set(['l2']))
    expect(payload.map((p) => p.id)).toEqual(['l2'])
  })
})

describe('agruparPorItem e resumoPorFornecedor', () => {
  it('soma por item e separa o texto livre no fim', () => {
    const linhas = [
      l({}),
      l({ linha_id: 'l2', contrato_nome: 'Telex', qtd_aprovada: 2 }),
      l({ linha_id: 'txt', item_id: null, descricao_livre: 'vassoura gari' }),
    ]
    const g = agruparPorItem(linhas, sugerirDestinos(linhas))
    expect(g).toHaveLength(2)
    expect(g[0]).toMatchObject({ descricao: 'Cloro 5L', totalAprovado: 6, totalCompra: 6 })
    expect(g[1].textoLivre).toBe(true)
  })
  it('resumo por fornecedor com valor e itens sem preço', () => {
    const linhas = [l({}), l({ linha_id: 'l2', item_id: 'i2', preco_vigente: null, qtd_aprovada: 1 })]
    const r = resumoPorFornecedor(linhas, sugerirDestinos(linhas))
    expect(r).toEqual([{ fornecedorId: 'antolimp', itens: 2, quantidade: 5, valor: 48, semPreco: 1, sobra: 0 }])
  })
})

describe('calendário (aviso, nunca trava)', () => {
  it('avisa antes do dia 20 e no dia 20 com extras pendentes', () => {
    expect(avisoJanelaCompra('2026-10-18', '2026-10-01', 20, 20, 3)).toMatch(/Ainda não é o dia/)
    expect(avisoJanelaCompra('2026-10-20', '2026-10-01', 20, 20, 3)).toMatch(/gestor ainda pode aprovar/)
    expect(avisoJanelaCompra('2026-10-21', '2026-10-01', 20, 20, 3)).toBeNull()
    expect(avisoJanelaCompra('2026-10-20', '2026-10-01', 20, 20, 0)).toBeNull()
    // Compra de competência passada não avisa
    expect(avisoJanelaCompra('2026-11-05', '2026-10-01', 20, 20, 3)).toBeNull()
  })
  it('dias desde a contagem e linha do mês anterior', () => {
    expect(diasDesdeContagem('2026-10-18', '2026-10-21')).toBe(3)
    expect(diasDesdeContagem(null, '2026-10-21')).toBeNull()
    expect(doMesAnterior({ competencia: '2026-09-01' }, '2026-10-01')).toBe(true)
    expect(doMesAnterior({ competencia: '2026-10-01' }, '2026-10-01')).toBe(false)
  })
})

describe('normalizarPrevia', () => {
  it('converte numeric em número e aplica padrões', () => {
    const p = normalizarPrevia({ linhas: [{ ...base, qtd_aprovada: '3.00', saldo_estoque: '0', rota: 2 }], pendentes: [], escritorio: [] })
    expect(p.linhas[0].qtd_aprovada).toBe(3)
    expect(p.linhas[0].rota).toBe(2)
    expect(p.dia_inicio_compra).toBe(20)
  })
})

describe('destino remanejado (migration 151)', () => {
  const d = (p: Partial<import('./compra').DestinoLinha>) => ({ qtdEstoque: 0, qtdCompra: 0, fornecedorId: null, naoAtender: false, motivo: '', ...p })

  it('nunca é sugerido: a sugestão só usa estoque e fornecedor', () => {
    const s = sugerirDestinos([l({})])
    expect(s.l1.qtdRemanejada ?? 0).toBe(0)
  })
  it('linha toda remanejada = "remanejado"; com fornecedor = "dividida"', () => {
    expect(tipoDestino(l({}), d({ qtdRemanejada: 4, remanejadoDe: 'c2' }))).toBe('remanejado')
    expect(tipoDestino(l({}), d({ qtdRemanejada: 1, remanejadoDe: 'c2', qtdCompra: 3, fornecedorId: 'f' }))).toBe('dividida')
  })
  it('exige o posto de origem, diferente do próprio, e conta na soma do aprovado', () => {
    expect(erroDestino(l({}), d({ qtdRemanejada: 4 }))).toMatch(/de qual posto/)
    expect(erroDestino(l({}), d({ qtdRemanejada: 4, remanejadoDe: 'c1' }))).toMatch(/próprio posto/)
    expect(erroDestino(l({}), d({ qtdRemanejada: 3, remanejadoDe: 'c2', qtdCompra: 2, fornecedorId: 'f' }))).toMatch(/Passa do aprovado/)
    expect(erroDestino(l({}), d({ qtdRemanejada: 2, remanejadoDe: 'c2' }))).toMatch(/motivo/)
    expect(erroDestino(l({}), d({ qtdRemanejada: 4, remanejadoDe: 'c2' }))).toBeNull()
  })
  it('vai no payload com a origem e a observação; não entra no resumo do fornecedor', () => {
    const linhas = [l({})]
    const destinos = { l1: d({ qtdRemanejada: 1, remanejadoDe: 'c2', obsRemanejamento: ' sobrou ', qtdCompra: 3, fornecedorId: 'antolimp' }) }
    const { payload, erros } = montarPayloadCompra(linhas, destinos)
    expect(erros).toEqual([])
    expect(payload[0]).toMatchObject({ id: 'l1', qtd_compra: 3, qtd_remanejada: 1, remanejado_de_contrato_id: 'c2', remanejamento_obs: 'sobrou' })
    expect(resumoPorFornecedor(linhas, destinos)[0].quantidade).toBe(3)
    expect(agruparPorItem(linhas, destinos)[0]).toMatchObject({ totalCompra: 3, totalRemanejado: 1 })
  })
  it('normalizarPrevia lê a lista de contratos e o selo de implantação', () => {
    const p = normalizarPrevia({ linhas: [{ ...base, implantacao: true }], contratos: [{ id: 'c2', nome: 'Back Art', rota: '2' }] })
    expect(p.contratos).toEqual([{ id: 'c2', nome: 'Back Art', rota: 2 }])
    expect(p.linhas[0].implantacao).toBe(true)
  })
})

describe('múltiplo de compra (migration 152)', () => {
  const flanela = (p: Partial<LinhaPrevia>) =>
    l({ item_id: 'fl', item_nome: 'Flanela branca de algodão', unidade: 'unidade', fator_compra: 100, unidade_compra: 'kit', preco_vigente: 1.8, ...p })

  it('normaliza a prévia: fator inválido ou ausente vale 1', () => {
    const p = normalizarPrevia({ linhas: [{ ...base, fator_compra: '100', unidade_compra: ' kit ' }, { ...base, linha_id: 'x', fator_compra: null }, { ...base, linha_id: 'y', fator_compra: 0 }] })
    expect(p.linhas.map((x) => x.fator_compra)).toEqual([100, 1, 1])
    expect(p.linhas[0].unidade_compra).toBe('kit')
    expect(p.linhas[1].fracionado_escritorio).toBe(false)
  })

  it('3 flanelas pedidas → 1 kit de 100, 97 para o estoque', () => {
    const linhas = [flanela({ qtd_aprovada: 3 })]
    const [g] = agruparPorItem(linhas, sugerirDestinos(linhas))
    expect(g).toMatchObject({ fatorCompra: 100, unidadeCompra: 'kit', totalCompra: 3 })
    expect(compraDoGrupo(g)).toEqual({ postos: 3, aMais: 0, total: 100, sobra: 97, embalagem: '1 kit c/ 100' })
    // a mais para o estoque entra antes do arredondamento
    expect(compraDoGrupo(g, 100)).toMatchObject({ total: 200, sobra: 97, embalagem: '2 kits c/ 100' })
  })

  it('fator 1: nada muda (sem sobra, sem texto de embalagem)', () => {
    const linhas = [l({ qtd_aprovada: 3 })]
    const [g] = agruparPorItem(linhas, sugerirDestinos(linhas))
    expect(compraDoGrupo(g)).toEqual({ postos: 3, aMais: 0, total: 3, sobra: 0, embalagem: null })
    expect(compraDoGrupo(g, 2).total).toBe(5)
  })

  it('resumo por fornecedor arredonda por item e soma o a mais', () => {
    const linhas = [flanela({ qtd_aprovada: 3 }), flanela({ linha_id: 'l2', contrato_nome: 'Telex', qtd_aprovada: 2 }), l({ linha_id: 'l3', qtd_aprovada: 4 })]
    const rep = [{ item_id: 'i1', variacao_id: null, fornecedor_id: 'antolimp', quantidade: 6 }]
    const r = resumoPorFornecedor(linhas, sugerirDestinos(linhas), undefined, rep)
    // flanela 5 → 100 (sobra 95); cloro 4 + 6 a mais = 10
    expect(r).toEqual([{ fornecedorId: 'antolimp', itens: 2, quantidade: 110, valor: 300, semPreco: 0, sobra: 95 }])
  })

  it('payload do a mais: ignora fora/texto livre/escritório e exige fornecedor', () => {
    const linhas = [
      flanela({ qtd_aprovada: 3 }),
      l({ linha_id: 'l2', item_id: 'i2', item_nome: 'Livro', preparo_escritorio: true }),
      l({ linha_id: 'l3', item_id: 'i3', item_nome: 'Sem fornecedor', fornecedor_padrao_id: null }),
      l({ linha_id: 'l4', item_id: 'i4', item_nome: 'Fora' }),
    ]
    const grupos = agruparPorItem(linhas, sugerirDestinos(linhas))
    const chave = (nome: string) => grupos.find((g) => g.descricao.startsWith(nome))!.chave
    const aMais = { [chave('Flanela')]: 50, [chave('Livro')]: 5, [chave('Sem fornecedor')]: 2, [chave('Fora')]: 9 }
    const r = montarPayloadReposicao(grupos, aMais, () => null, new Set([chave('Fora')]))
    expect(r.payload).toEqual([{ item_id: 'fl', variacao_id: null, fornecedor_id: 'antolimp', quantidade: 50 }])
    expect(r.erros).toEqual([{ chave: chave('Sem fornecedor'), erro: 'A mais para o estoque: escolha o fornecedor do item.' }])
  })
})
