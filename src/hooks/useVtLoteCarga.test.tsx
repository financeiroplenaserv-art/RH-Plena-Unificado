import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type {
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'
import { RepositorioLoteCargaEmMemoria } from '@/lib/vt/confirmarLote'
import { useVtLoteCarga, type EntradaConstruirLote } from '@/hooks/useVtLoteCarga'

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

function entrada(id: string, valor: number, parent?: string): EntradaConstruirLote {
  return {
    id,
    competencia: '2026-11',
    versaoCalculo: '3.0.0',
    versaoRegras: { tarifas: '2026-11-01' },
    fonte: {
      tipo: 'gestao_escalas_flit',
      nomeArquivo: 'escalas.xlsx',
      conteudoHash: 'fonte-sha',
      importadoEm: '2026-11-01T10:00:00Z',
    },
    dias: [{
      colaboradorId: 'pessoa-1',
      departamentoId: 'posto-1',
      data: '2026-11-10',
      origemDia: 'escala',
    }],
    decisoes: [DECISAO],
    componentes: [COMPONENTE],
    versoesPreco: [versao({ valorDiarioCentavos: valor })],
    loteSubstituidoId: parent,
  }
}

function setup() {
  const repositorio = new RepositorioLoteCargaEmMemoria()
  return renderHook(() => useVtLoteCarga(repositorio, 'usuario-1', () => '2026-11-15T12:00:00Z'))
}

describe('useVtLoteCarga', () => {
  it('constrói, salva e confirma um lote sem tocar em banco ou telas', async () => {
    const { result } = setup()

    await act(async () => { await result.current.construir(entrada('lote-1', 1000)) })
    expect(result.current.lote).toMatchObject({
      status: 'rascunho',
      valorCentavos: 1000,
      versaoConteudo: 1,
    })

    await act(async () => { await result.current.confirmar() })
    expect(result.current.lote).toMatchObject({
      status: 'confirmado',
      valorCentavos: 1000,
    })
    expect(result.current.lote?.confirmacao).toMatchObject({
      confirmadaPor: 'usuario-1',
      confirmadaEm: '2026-11-15T12:00:00Z',
    })
  })

  it('substitui somente depois de aprovar a divergência', async () => {
    const { result } = setup()
    await act(async () => { await result.current.construir(entrada('lote-1', 1000)) })
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.construir(entrada('lote-2', 1200, 'lote-1')) })

    expect(result.current.divergencias[0]).toMatchObject({
      tipo: 'alterado',
      diferencaValorCentavos: 200,
    })
    await act(async () => { await result.current.substituir() })
    expect(result.current.lote?.status).toBe('rascunho')
    expect(result.current.erro).toContain('aprovação')

    await act(async () => { await result.current.aprovar(result.current.divergencias[0]) })
    await act(async () => { await result.current.substituir() })

    expect(result.current.lote).toMatchObject({
      status: 'confirmado',
      loteSubstituidoId: 'lote-1',
    })
  })

  it('nova edição depois da aprovação exige outra revisão', async () => {
    const { result } = setup()
    await act(async () => { await result.current.construir(entrada('lote-1', 1000)) })
    await act(async () => { await result.current.confirmar() })
    await act(async () => { await result.current.construir(entrada('lote-2', 1200, 'lote-1')) })
    await act(async () => { await result.current.aprovar(result.current.divergencias[0]) })

    await act(async () => { await result.current.construir(entrada('lote-2', 1300, 'lote-1')) })
    expect(result.current.aprovacoes).toEqual([])
    await act(async () => { await result.current.substituir() })

    expect(result.current.lote).toMatchObject({ status: 'rascunho', valorCentavos: 1300 })
    expect(result.current.erro).toContain('aprovação')
  })
})
