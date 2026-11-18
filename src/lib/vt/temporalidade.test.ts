import { describe, expect, it } from 'vitest'
import type {
  AjusteBeneficioVT,
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'
import {
  decisaoTrajetoNaData,
  resolverCustoDiarioNaData,
  versaoPrecoPacoteNaData,
} from '@/lib/vt/temporalidade'

const DECISAO: DecisaoTrajetoVT = {
  id: 'decisao-1',
  trajetoLegadoId: 'trajeto-1',
  colaboradorId: 'pessoa-1',
  departamentoId: 'posto-1',
  revisao: 1,
  cotacaoId: null,
  status: 'confirmada',
  confirmadaPor: 'usuario-1',
  confirmadaEm: '2026-01-01T10:00:00Z',
  vigenteDesde: '2026-01-01',
  vigenteAte: null,
  referenciasLegadasNaoResolvidas: [],
}

const COMPONENTE: ComponenteDecisaoTrajetoVT = {
  id: 'componente-1',
  decisaoTrajetoId: DECISAO.id,
  pacoteId: 'pacote-1',
  ordem: 1,
}

function versao(parcial: Partial<VersaoPrecoPacoteVT>): VersaoPrecoPacoteVT {
  return {
    id: 'preco-1',
    pacoteId: 'pacote-1',
    valorDiarioCentavos: 1000,
    vigenteDesde: '2026-01-01',
    vigenteAte: null,
    ...parcial,
  }
}

function resolver(
  dataServico: string,
  versoesPreco: VersaoPrecoPacoteVT[],
  opcoes?: {
    decisoes?: DecisaoTrajetoVT[]
    componentes?: ComponenteDecisaoTrajetoVT[]
    ajustes?: AjusteBeneficioVT[]
  },
) {
  return resolverCustoDiarioNaData({
    colaboradorId: 'pessoa-1',
    departamentoId: 'posto-1',
    dataServico,
    decisoes: opcoes?.decisoes ?? [DECISAO],
    componentes: opcoes?.componentes ?? [COMPONENTE],
    versoesPreco,
    ajustes: opcoes?.ajustes,
  })
}

describe('identidade e temporalidade do VT', () => {
  it('reajuste imediato não deixa o trajeto sem preço e cada dia usa a versão correta', () => {
    const versoes = [
      versao({ id: 'v1', valorDiarioCentavos: 1000, vigenteDesde: '2026-01-01', vigenteAte: '2026-10-31' }),
      versao({ id: 'v2', valorDiarioCentavos: 1200, vigenteDesde: '2026-11-01' }),
    ]

    expect(resolver('2026-10-31', versoes)).toMatchObject({ status: 'resolvido', totalCentavos: 1000 })
    expect(resolver('2026-11-01', versoes)).toMatchObject({ status: 'resolvido', totalCentavos: 1200 })
    expect(resolver('2026-11-01', versoes).componentes[0].versaoPrecoId).toBe('v2')
  })

  it('reajuste futuro só entra na vigência correta', () => {
    const versoes = [
      versao({ id: 'atual', valorDiarioCentavos: 1120, vigenteDesde: '2026-10-21', vigenteAte: '2026-12-31' }),
      versao({ id: 'futuro', valorDiarioCentavos: 1250, vigenteDesde: '2027-01-01' }),
    ]

    expect(resolver('2026-11-15', versoes).totalCentavos).toBe(1120)
    expect(resolver('2026-12-31', versoes).totalCentavos).toBe(1120)
    expect(resolver('2027-01-01', versoes).totalCentavos).toBe(1250)
  })

  it('competência passada usa o preço histórico, não o preço atual', () => {
    const decisao = { ...DECISAO, vigenteDesde: null }
    const versoes = [
      versao({ id: 'historico', valorDiarioCentavos: 940, vigenteDesde: '2025-01-01', vigenteAte: '2025-12-31' }),
      versao({ id: 'atual', valorDiarioCentavos: 1120, vigenteDesde: '2026-01-01' }),
    ]

    const resultado = resolver('2025-08-15', versoes, { decisoes: [decisao] })

    expect(resultado.totalCentavos).toBe(940)
    expect(resultado.componentes[0].versaoPrecoId).toBe('historico')
  })

  it('snapshot já resolvido não muda quando um reajuste é cadastrado depois', () => {
    const versoes = [versao({ id: 'v1', valorDiarioCentavos: 1000 })]
    const snapshot = resolver('2026-11-10', versoes)
    const antes = structuredClone(snapshot)

    versoes[0].vigenteAte = '2026-11-14'
    versoes.push(versao({ id: 'v2', valorDiarioCentavos: 1300, vigenteDesde: '2026-11-15' }))

    const recalculado = resolver('2026-11-10', versoes)
    expect(snapshot).toEqual(antes)
    expect(recalculado.totalCentavos).toBe(antes.totalCentavos)
    expect(recalculado.componentes[0].versaoPrecoId).toBe('v1')
    expect(recalculado.componentes[0].vigenteAte).toBe('2026-11-14')
    expect(resolver('2026-11-20', versoes).totalCentavos).toBe(1300)
  })

  it('decisão mais recente não confirmada vira pendência, sem voltar para uma decisão antiga', () => {
    const sugerida: DecisaoTrajetoVT = {
      ...DECISAO,
      id: 'decisao-2',
      revisao: 2,
      status: 'sugerida',
      confirmadaPor: null,
      confirmadaEm: null,
      vigenteDesde: '2026-11-01',
    }
    const decisoes = [DECISAO, sugerida]

    expect(decisaoTrajetoNaData(decisoes, 'pessoa-1', 'posto-1', '2026-11-10')?.id).toBe('decisao-2')
    expect(resolver('2026-11-10', [versao({})], { decisoes })).toMatchObject({
      status: 'pendente',
      totalCentavos: null,
      decisaoId: 'decisao-2',
    })
    expect(resolver('2026-10-31', [versao({})], { decisoes }).totalCentavos).toBe(1000)
  })

  it('soma qualquer quantidade de componentes e aplica ajustes manuais pela vigência', () => {
    const componentes = [COMPONENTE, {
      id: 'componente-2',
      decisaoTrajetoId: DECISAO.id,
      pacoteId: 'pacote-2',
      ordem: 2,
    }]
    const versoes = [
      versao({ id: 'p1', valorDiarioCentavos: 1000 }),
      versao({ id: 'p2', pacoteId: 'pacote-2', valorDiarioCentavos: 500 }),
    ]
    const ajustes: AjusteBeneficioVT[] = [{
      id: 'ajuste-1',
      decisaoTrajetoId: DECISAO.id,
      valorDiarioCentavos: 200,
      motivo: 'Complemento autorizado',
      autorId: 'usuario-1',
      vigenteDesde: '2026-01-01',
      vigenteAte: '2026-11-10',
    }, {
      id: 'ajuste-2',
      decisaoTrajetoId: DECISAO.id,
      valorDiarioCentavos: -50,
      motivo: 'Correção autorizada',
      autorId: 'usuario-1',
      vigenteDesde: '2026-11-11',
      vigenteAte: null,
    }]

    expect(resolver('2026-11-10', versoes, { componentes, ajustes }).totalCentavos).toBe(1700)
    expect(resolver('2026-11-11', versoes, { componentes, ajustes }).totalCentavos).toBe(1450)
  })

  it('referência legada não resolvida nunca produz total confiante', () => {
    const decisao = { ...DECISAO, referenciasLegadasNaoResolvidas: ['bilhete-apagado'] }

    const resultado = resolver('2026-11-10', [versao({})], { decisoes: [decisao] })

    expect(resultado.status).toBe('pendente')
    expect(resultado.totalCentavos).toBeNull()
    expect(resultado.pendencias.map((pendencia) => pendencia.codigo)).toContain('referencia_legada_nao_resolvida')
  })

  it('duas versões com a mesma vigência inicial são ambíguas, nunca uma escolha por palpite', () => {
    const versoes = [
      versao({ id: 'a', valorDiarioCentavos: 1000 }),
      versao({ id: 'b', valorDiarioCentavos: 1200 }),
    ]

    expect(versaoPrecoPacoteNaData(versoes, 'pacote-1', '2026-11-10')).toBeNull()
    expect(resolver('2026-11-10', versoes)).toMatchObject({
      status: 'pendente',
      totalCentavos: null,
    })
    expect(resolver('2026-11-10', versoes).pendencias[0].codigo).toBe('preco_ambiguo')
  })

  it('revisão nova com vigência retroativa não deixa a decisão antiga vencer', () => {
    const antiga = { ...DECISAO, vigenteDesde: '2026-11-10' }
    const retroativa: DecisaoTrajetoVT = {
      ...DECISAO,
      id: 'decisao-retroativa',
      revisao: 2,
      status: 'sugerida',
      confirmadaPor: null,
      confirmadaEm: null,
      vigenteDesde: '2026-01-01',
    }

    const resultado = resolver('2026-11-15', [versao({})], { decisoes: [antiga, retroativa] })

    expect(resultado.decisaoId).toBe('decisao-retroativa')
    expect(resultado.status).toBe('pendente')
    expect(resultado.totalCentavos).toBeNull()
  })

  it('vigências de preço sobrepostas são ambíguas mesmo com inícios diferentes', () => {
    const versoes = [
      versao({ id: 'antiga-aberta', valorDiarioCentavos: 1000, vigenteDesde: '2026-01-01' }),
      versao({ id: 'nova', valorDiarioCentavos: 1200, vigenteDesde: '2026-11-01' }),
    ]

    expect(versaoPrecoPacoteNaData(versoes, 'pacote-1', '2026-11-10')).toBeNull()
    expect(resolver('2026-11-10', versoes).pendencias[0].codigo).toBe('preco_ambiguo')
  })

  it('usa o preço confirmado na revisão em vez do pacote antigo, mesmo sem componentes', () => {
    const revisada: DecisaoTrajetoVT = {
      ...DECISAO,
      cotacaoId: 'tarifa_integral',
      custoDiarioCentavos: 2940,
    }

    const resultado = resolver('2026-11-10', [], { decisoes: [revisada], componentes: [] })

    expect(resultado).toMatchObject({ status: 'resolvido', totalCentavos: 2940, componentes: [] })
  })

  it('soma ajustes vigentes ao preço confirmado na revisão', () => {
    const revisada: DecisaoTrajetoVT = { ...DECISAO, custoDiarioCentavos: 2940 }
    const ajustes: AjusteBeneficioVT[] = [{
      id: 'ajuste-1',
      decisaoTrajetoId: revisada.id,
      valorDiarioCentavos: 200,
      motivo: 'Complemento autorizado',
      autorId: 'usuario-1',
      vigenteDesde: '2026-01-01',
      vigenteAte: null,
    }]

    expect(resolver('2026-11-10', [], { decisoes: [revisada], componentes: [], ajustes }).totalCentavos).toBe(3140)
  })
})
