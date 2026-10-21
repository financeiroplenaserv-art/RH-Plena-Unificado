import { describe, expect, it } from 'vitest'
import { montarPainel } from './painel'
import { avisosOrcamentoCeu, compararOrcamentoCeu, lerCustoCracha, lerCustosCracha, quantidadeCeu, resumirOrcamentoCeu, type LinhaCeuOrcamento } from './orcamento'

const linha = (o: Partial<LinhaCeuOrcamento>): LinhaCeuOrcamento => ({
  pedido_id: 'p1', tipo: 'epi', item_id: 'i1', status: 'pendente', qtd_pedida: 1, ...o,
})

describe('quantidadeCeu', () => {
  it('atendida > conferida > pedida', () => {
    expect(quantidadeCeu(linha({ qtd_pedida: 3 }))).toBe(3)
    expect(quantidadeCeu(linha({ qtd_pedida: 3, qtd_conferida: 2 }))).toBe(2)
    expect(quantidadeCeu(linha({ qtd_pedida: 3, qtd_conferida: 2, qtd_atendida: 1 }))).toBe(1)
  })
  it('zero conferido vale zero; cancelada vale zero; número como texto', () => {
    expect(quantidadeCeu(linha({ qtd_pedida: 3, qtd_conferida: 0 }))).toBe(0)
    expect(quantidadeCeu(linha({ status: 'cancelado', qtd_pedida: 5 }))).toBe(0)
    expect(quantidadeCeu(linha({ qtd_pedida: '2' }))).toBe(2)
  })
})

describe('resumirOrcamentoCeu', () => {
  const precos = new Map([['i1', 1250], ['i2', 4000]])
  it('soma quantidade x preço em reais', () => {
    const r = resumirOrcamentoCeu({
      linhas: [linha({ qtd_pedida: 2 }), linha({ item_id: 'i2', qtd_pedida: 1, qtd_conferida: 3 })],
      precosCentavos: precos, custoCracha: { semCordinha: null, comCordinha: null },
    })
    expect(r.valor).toBe(2 * 12.5 + 3 * 40)
    expect(r.semPreco).toBe(0)
  })
  it('peça sem preço não soma e é contada', () => {
    const r = resumirOrcamentoCeu({ linhas: [linha({ item_id: 'x' }), linha({ item_id: 'i3' })], precosCentavos: { i3: 0 }, custoCracha: { semCordinha: null, comCordinha: null } })
    expect(r.valor).toBe(0)
    expect(r.semPreco).toBe(2)
  })
  it('crachá usa o custo configurado; sem custo não soma e avisa', () => {
    const c = linha({ tipo: 'cracha', item_id: null, qtd_pedida: 2 })
    const com = resumirOrcamentoCeu({ linhas: [c], precosCentavos: precos, custoCracha: { semCordinha: 6, comCordinha: 8 } })
    expect(com.valor).toBe(12)
    const cord = resumirOrcamentoCeu({ linhas: [{ ...c, cracha_cordao: true }], precosCentavos: precos })
    expect(cord.valor).toBe(16) // padrão 6 / 8, cordinha = 8
    const nulo = resumirOrcamentoCeu({ linhas: [{ ...c, cracha_cordao: null }], precosCentavos: precos })
    expect(nulo.valor).toBe(12) // NULL = sem cordinha
    expect(lerCustosCracha({})).toEqual({ semCordinha: 6, comCordinha: 8 })
    expect(lerCustosCracha({ custo_cracha_sem_cordinha: 7, custo_cracha_com_cordinha: null })).toEqual({ semCordinha: 7, comCordinha: null })
    const sem = resumirOrcamentoCeu({ linhas: [c], precosCentavos: precos, custoCracha: { semCordinha: null, comCordinha: null } })
    expect(sem.valor).toBe(0)
    expect(sem.crachasSemCusto).toBe(1)
    expect(avisosOrcamentoCeu(sem)).toEqual(['custo do crachá não definido'])
    expect(avisosOrcamentoCeu({ semPreco: 1, crachasSemCusto: 0 })).toEqual(['1 peça sem preço'])
  })
  it('implantação fica à parte e cancelada não conta', () => {
    const r = resumirOrcamentoCeu({
      linhas: [linha({ pedido_id: 'imp', qtd_pedida: 4 }), linha({ qtd_pedida: 1 }), linha({ status: 'cancelado', qtd_pedida: 9 })],
      precosCentavos: precos, custoCracha: { semCordinha: null, comCordinha: null }, implantacaoIds: new Set(['imp']),
    })
    expect(r.valorImplantacao).toBe(50)
    expect(r.valor).toBe(12.5)
  })
})

describe('compararOrcamentoCeu', () => {
  it('passou do limite = excedeu (só aviso)', () => {
    const c = compararOrcamentoCeu(1100, '1000')
    expect(c).toMatchObject({ limite: 1000, excedeu: true, diferenca: 100 })
    expect(c.percentual).toBeCloseTo(1.1)
  })
  it('sem limite nunca excede; no limite exato não excede', () => {
    expect(compararOrcamentoCeu(5000, null)).toMatchObject({ limite: null, excedeu: false })
    expect(compararOrcamentoCeu(1000, 1000).excedeu).toBe(false)
    expect(compararOrcamentoCeu(10, 0).excedeu).toBe(false)
  })
})

describe('lerCustoCracha', () => {
  it('aceita número >= 0, resto é não definido', () => {
    expect(lerCustoCracha(12)).toBe(12)
    expect(lerCustoCracha('7.5')).toBe(7.5)
    expect(lerCustoCracha(null)).toBeNull()
    expect(lerCustoCracha(-1)).toBeNull()
    expect(lerCustoCracha('abc')).toBeNull()
  })
})

describe('montarPainel — bloco de uniforme/EPI/crachá', () => {
  const base = {
    contratos: [
      { id: 'a', nome: 'ABAETÉ', ativo: true, limite_mensal_ceu: 100 },
      { id: 'b', nome: 'BETA', ativo: true, limite_mensal_ceu: null },
    ],
    pedidosDoMes: [
      { id: 'pa', contrato_id: 'a', tipo: 'mensal' as const, status_produtos: 'nao_se_aplica' as const, status_ceu: 'enviado' as const, preenchido_pelo_escritorio: false },
      { id: 'pai', contrato_id: 'a', tipo: 'extra' as const, status_produtos: 'aprovado' as const, status_ceu: 'enviado' as const, preenchido_pelo_escritorio: true, implantacao: true },
      { id: 'pb', contrato_id: 'b', tipo: 'mensal' as const, status_produtos: 'nao_se_aplica' as const, status_ceu: 'enviado' as const, preenchido_pelo_escritorio: false },
    ],
    itensDoMes: [], kits: [], precos: [], historico: [], pedidosAnteriores: [], itensAnteriores: [], hoje: '2026-10-21',
    precosCeu: new Map([['i1', 6000]]),
    linhasCeu: [
      linha({ pedido_id: 'pa', qtd_pedida: 2 }), // 120 > 100
      linha({ pedido_id: 'pai', qtd_pedida: 5 }), // implantação, fora do limite
      linha({ pedido_id: 'pb', qtd_pedida: 1 }), // sem limite
    ],
  }
  it('passou do limite = aviso; sem limite só mostra o valor; implantação à parte', () => {
    const l = montarPainel(base)
    const a = l.find((x) => x.contratoId === 'a')!
    const b = l.find((x) => x.contratoId === 'b')!
    expect(a.ceu).toMatchObject({ valor: 120, limite: 100, excedeu: true, valorImplantacao: 300 })
    expect(b.ceu).toMatchObject({ valor: 60, limite: null, excedeu: false })
    expect(l[0].contratoId).toBe('a') // quem passou vem primeiro
    expect(a.aprovavel).toBe(false) // nunca bloqueia nem libera aprovação
  })
})
