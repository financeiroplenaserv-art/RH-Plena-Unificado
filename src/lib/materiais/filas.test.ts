import { describe, it, expect } from 'vitest'
import {
  analisarTamanho,
  buscarColaboradores,
  entregaRecente,
  etapaLinhaCeu,
  faltaComprar,
  montarAprovacao,
  montarAtendimento,
  montarValidacao,
  origemDaLinha,
  pontuarNome,
  qtdEfetiva,
  rotulosExcecao,
  sugerirColaboradores,
} from './filas'
import { montarPainel } from './painel'

const tamanhos = {
  colaborador_id: 'c1',
  tamanho_camisa: 'M',
  tamanho_calca: '42',
  tamanho_calcado: '40',
  tamanho_luva: 'G',
}

describe('produtos — exceções e quantidades', () => {
  it('rótulos: "Outros materiais" quando é texto livre', () => {
    expect(rotulosExcecao({ excecao_acima_kit: true, excecao_validade: true, excecao_fora_kit: false, item_id: 'i' })).toEqual([
      'Acima do kit',
      'Antes da validade',
    ])
    expect(rotulosExcecao({ excecao_acima_kit: false, excecao_validade: false, excecao_fora_kit: true, item_id: null })).toEqual([
      'Outros materiais',
    ])
  })

  it('quantidade efetiva: aprovada > validada > pedida', () => {
    expect(qtdEfetiva({ qtd_pedida: 5, qtd_validada: null, qtd_aprovada: null })).toBe(5)
    expect(qtdEfetiva({ qtd_pedida: 5, qtd_validada: 3, qtd_aprovada: null })).toBe(3)
    expect(qtdEfetiva({ qtd_pedida: 5, qtd_validada: 3, qtd_aprovada: 0 })).toBe(0)
  })

  it('origem da linha vem do envio (complemento, data e "Seu nome")', () => {
    const envios = [
      { id: 'e1', origem: 'original' as const, sequencia: 1, seu_nome: 'Maria', enviado_em: '2026-10-02T13:00:00Z' },
      { id: 'e2', origem: 'complemento' as const, sequencia: 2, seu_nome: 'João', enviado_em: '2026-10-05T13:00:00Z' },
    ]
    expect(origemDaLinha({ envio_id: 'e2' }, envios)).toMatchObject({ origem: 'complemento', seuNome: 'João' })
    expect(origemDaLinha({ envio_id: null }, envios)).toBeNull()
  })
})

describe('validação do inspetor', () => {
  const linhas = [
    { id: 'a', qtd_pedida: 4 },
    { id: 'b', qtd_pedida: 2 },
    { id: 'c', qtd_pedida: 1 },
  ]

  it('corte exige motivo; descartar repetição zera com motivo padrão; ignorar não envia', () => {
    const r = montarValidacao(linhas, {
      a: { qtd: 2, motivo: '' },
      b: { qtd: null, motivo: '', decisao: 'descartar' },
      c: { qtd: null, motivo: '', decisao: null },
    })
    expect(r.erros).toEqual(['Linha 1: informe o motivo do corte'])
    expect(r.itens).toEqual([{ id: 'b', qtd_validada: 0, motivo: 'repetição', decisao_repeticao: 'descartar' }])
  })

  it('corte com motivo e "somar" vão no payload', () => {
    const r = montarValidacao(linhas, {
      a: { qtd: 2, motivo: 'Liguei para o líder' },
      b: { qtd: null, motivo: '', decisao: 'somar' },
    })
    expect(r.erros).toEqual([])
    expect(r.itens).toEqual([
      { id: 'a', qtd_validada: 2, motivo: 'Liguei para o líder', decisao_repeticao: null },
      { id: 'b', qtd_validada: null, motivo: null, decisao_repeticao: 'somar' },
    ])
  })
})

describe('aprovação do gestor', () => {
  it('ajuste abaixo do pedido exige motivo, salvo motivo de corte já registrado', () => {
    const r = montarAprovacao(
      [
        { id: 'a', qtd_pedida: 4, motivo_ajuste: null },
        { id: 'b', qtd_pedida: 4, motivo_ajuste: 'corte do inspetor' },
        { id: 'c', qtd_pedida: 4, motivo_ajuste: null },
      ],
      { a: { qtd: 1, motivo: '' }, b: { qtd: 2, motivo: '' }, c: { qtd: 3, motivo: 'acima da média' } }
    )
    expect(r.erros).toEqual(['Linha 1: informe o motivo do ajuste'])
    expect(r.itens.map((i) => i.id)).toEqual(['b', 'c'])
  })
})

describe('identificação do nome digitado', () => {
  const equipe = [
    { id: '1', nome_completo: 'Michelle Alves da Silva' },
    { id: '2', nome_completo: 'Michel Souza' },
    { id: '3', nome_completo: 'Ana Paula Ferreira' },
  ]

  it('casa nome com inicial, abreviação e erro de digitação', () => {
    expect(pontuarNome('Michelle A.', 'Michelle Alves da Silva')).toBeGreaterThan(0.8)
    expect(pontuarNome('Mishelle Alves', 'Michelle Alves da Silva')).toBeGreaterThan(0.7)
    expect(pontuarNome('Ana Paula', 'Ana Paula Ferreira')).toBe(1)
    expect(pontuarNome('Carlos', 'Ana Paula Ferreira')).toBe(0)
  })

  it('sugere o mais parecido primeiro', () => {
    const s = sugerirColaboradores('michele alves', equipe)
    expect(s[0].id).toBe('1')
    expect(s.find((x) => x.id === '3')).toBeUndefined()
  })

  it('busca livre (ferista de fora da equipe) por trecho do nome', () => {
    expect(buscarColaboradores('ferr', equipe).map((s) => s.id)).toEqual(['3'])
    expect(buscarColaboradores('a', equipe)).toEqual([])
  })
})

describe('tamanho e última entrega', () => {
  it('usa o tamanho digitado; sem ele, o tamanho embutido no nome da peça', () => {
    expect(analisarTamanho('Botina de segurança', '41', tamanhos)).toEqual({ tamanhoCadastro: '40', tamanhoPedido: '41', diverge: true })
    expect(analisarTamanho('LUVA LATEX G', null, tamanhos)).toEqual({ tamanhoCadastro: 'G', tamanhoPedido: 'G', diverge: false })
    expect(analisarTamanho('Camisa polo', 'M', null).diverge).toBe(false)
  })

  it('entrega recente = dentro do prazo de uso do item', () => {
    expect(entregaRecente('2026-09-10', 180, '2026-10-09')).toBe(true)
    expect(entregaRecente('2026-01-10', 180, '2026-10-09')).toBe(false)
    expect(entregaRecente('2026-09-10', null, '2026-10-09')).toBe(false)
  })
})

describe('atendimento da Beth', () => {
  const linhas = [
    { id: 'a', qtd_conferida: 2, qtd_pedida: 3, status: 'ajustado' as const },
    { id: 'b', qtd_conferida: null, qtd_pedida: 1, status: 'conferido' as const },
    { id: 'c', qtd_conferida: null, qtd_pedida: 1, status: 'pendente' as const },
  ]

  it('entrega menor que o conferido exige motivo; não conferida é recusada', () => {
    const r = montarAtendimento(linhas, { a: { qtd: 1, motivo: '' } })
    expect(r.erros).toContain('Linha 1: informe o motivo da entrega menor')
    expect(r.erros).toContain('Linha 3: só linhas conferidas pela inspetoria podem ser atendidas')
    expect(r.itens).toEqual([{ id: 'b', qtd_atendida: 1, motivo: null }])
  })

  it('não aceita entregar mais que o conferido', () => {
    expect(montarAtendimento([linhas[0]], { a: { qtd: 3, motivo: '' } }).erros).toHaveLength(1)
  })

  it('o que falta comprar = conferido não atendido − saldo (referência)', () => {
    const r = faltaComprar(
      [
        { item_id: 'bota', status: 'conferido', qtd_conferida: null, qtd_pedida: 3 },
        { item_id: 'bota', status: 'ajustado', qtd_conferida: 1, qtd_pedida: 2 },
        { item_id: 'luva', status: 'conferido', qtd_conferida: null, qtd_pedida: 2 },
        { item_id: 'luva', status: 'atendido', qtd_conferida: null, qtd_pedida: 5 },
      ],
      new Map([
        ['bota', 1],
        ['luva', 10],
      ])
    )
    expect(r).toEqual([
      { item_id: 'bota', aAtender: 4, saldo: 1, falta: 3 },
      { item_id: 'luva', aAtender: 2, saldo: 10, falta: 0 },
    ])
  })

  it('etapa da linha', () => {
    expect(etapaLinhaCeu('a_identificar')).toBe('identificar')
    expect(etapaLinhaCeu('pendente')).toBe('conferir')
    expect(etapaLinhaCeu('ajustado')).toBe('atender')
    expect(etapaLinhaCeu('cancelado')).toBe('concluida')
  })
})

describe('painel do gestor', () => {
  const base = {
    contratos: [
      { id: 'abaete', nome: 'Abaeté', ativo: true },
      { id: 'enseada', nome: 'Enseada', ativo: true },
    ],
    kits: [
      { contrato_id: 'abaete', item_id: 'det', variacao_id: null, quantidade: 2 },
      { contrato_id: 'enseada', item_id: 'det', variacao_id: null, quantidade: 5 },
    ],
    precos: [{ item_id: 'det', variacao_id: null, preco: 20, vigente_desde: '2026-01-01' }],
    historico: [
      { contrato_id: 'abaete', competencia: '2026-09-01', item_id: 'det', variacao_id: null, quantidade: 6 },
    ],
    pedidosAnteriores: [],
    itensAnteriores: [],
    hoje: '2026-10-09',
  }

  it('valor × limite × média 6 meses e quem passou do limite vem primeiro', () => {
    const linhas = montarPainel({
      ...base,
      pedidosDoMes: [
        { id: 'p1', contrato_id: 'abaete', tipo: 'mensal', status_produtos: 'validado', preenchido_pelo_escritorio: false },
        { id: 'p2', contrato_id: 'enseada', tipo: 'mensal', status_produtos: 'aprovado', preenchido_pelo_escritorio: true },
      ],
      itensDoMes: [
        { pedido_id: 'p1', item_id: 'det', variacao_id: null, qtd_pedida: 5, qtd_validada: 4, qtd_aprovada: null, preco_unitario: 20, excecao_acima_kit: true, excecao_validade: false, excecao_fora_kit: false },
        { pedido_id: 'p2', item_id: 'det', variacao_id: null, qtd_pedida: 3, qtd_validada: 3, qtd_aprovada: 3, preco_unitario: null, excecao_acima_kit: false, excecao_validade: false, excecao_fora_kit: false },
      ],
    })
    expect(linhas[0]).toMatchObject({
      contratoId: 'abaete',
      valorPedido: 80,
      limite: 40,
      media6: 20, // 6 × R$ 20 em 1 de 6 meses
      excedeu: true,
      diferenca: 40,
      aprovavel: true,
      excecoes: 1,
    })
    expect(linhas[1]).toMatchObject({ contratoId: 'enseada', valorPedido: 60, limite: 100, excedeu: false, preenchidoPeloEscritorio: true, aprovavel: false })
  })

  it('pedido cancelado não conta', () => {
    const [l] = montarPainel({
      ...base,
      contratos: [base.contratos[0]],
      pedidosDoMes: [{ id: 'p1', contrato_id: 'abaete', tipo: 'mensal', status_produtos: 'cancelado', preenchido_pelo_escritorio: false }],
      itensDoMes: [],
    })
    expect(l.valorPedido).toBe(0)
    expect(l.pedidoIds).toEqual([])
  })
})
