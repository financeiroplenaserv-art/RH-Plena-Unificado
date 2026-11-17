import { describe, expect, it } from 'vitest'
import { selecionarProntosLote } from '@/lib/vt/selecionarProntosLote'
import type {
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'

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

const PRECO: VersaoPrecoPacoteVT = {
  id: 'preco-1',
  pacoteId: 'pacote-1',
  valorDiarioCentavos: 1000,
  vigenteDesde: '2026-01-01',
  vigenteAte: null,
}

const DIA = {
  colaboradorId: 'pessoa-1',
  departamentoId: 'posto-1',
  data: '2026-11-10',
  origemDia: 'escala' as const,
}

function selecao() {
  return selecionarProntosLote({
    dias: [DIA],
    colaboradorIds: ['pessoa-1', 'pessoa-sem-dias'],
    decisoes: [DECISAO],
    componentes: [COMPONENTE],
    versoesPreco: [PRECO],
    ajustesBeneficio: [],
  })
}

describe('seleção de pessoas prontas para o lote', () => {
  it('inclui optante sem dias com valor zero quando a decisão está completa', () => {
    const resultado = selecao()
    expect(resultado.colaboradorIds).toEqual(['pessoa-1', 'pessoa-sem-dias'])
    expect(resultado.pendentesIds).toEqual([])
  })

  it('deixa de fora quem tem decisão não confirmada', () => {
    const resultado = selecionarProntosLote({
      dias: [DIA],
      colaboradorIds: ['pessoa-1', 'pessoa-sem-dias'],
      decisoes: [{ ...DECISAO, status: 'sugerida' }],
      componentes: [COMPONENTE],
      versoesPreco: [PRECO],
      ajustesBeneficio: [],
    })

    expect(resultado.colaboradorIds).toEqual(['pessoa-sem-dias'])
    expect(resultado.dias).toEqual([])
    expect(resultado.pendentesIds).toEqual(['pessoa-1'])
  })

  it('exclui a pessoa inteira se qualquer dia ficar sem preço', () => {
    const resultado = selecionarProntosLote({
      dias: [DIA, { ...DIA, data: '2025-12-01' }],
      colaboradorIds: ['pessoa-1'],
      decisoes: [DECISAO],
      componentes: [COMPONENTE],
      versoesPreco: [PRECO],
      ajustesBeneficio: [],
    })

    expect(resultado.colaboradorIds).toEqual([])
    expect(resultado.dias).toEqual([])
    expect(resultado.pendentesIds).toEqual(['pessoa-1'])
  })
})
