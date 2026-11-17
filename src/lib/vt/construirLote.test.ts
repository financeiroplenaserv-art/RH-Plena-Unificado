import { describe, expect, it } from 'vitest'
import type {
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'
import type { LancamentoAjusteVT } from '@/lib/vt/contratosLoteCarga'
import { construirRascunhoLoteCarga } from '@/lib/vt/construirLote'

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

function entrada(parcial: Partial<Parameters<typeof construirRascunhoLoteCarga>[0]>) {
  return {
    id: 'lote-1',
    competencia: '2026-11',
    versaoCalculo: '3.0.0',
    versaoRegras: { tarifas: '2026-11-01' },
    fonte: {
      tipo: 'gestao_escalas_flit' as const,
      nomeArquivo: 'escalas.xlsx',
      conteudoHash: 'fonte-sha',
      importadoEm: '2026-11-01T10:00:00Z',
    },
    dias: [],
    decisoes: [DECISAO],
    componentes: [COMPONENTE],
    versoesPreco: [versao({})],
    ...parcial,
  }
}

function dia(data: string): { colaboradorId: string; departamentoId: string; data: string; origemDia: 'escala' } {
  return { colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data, origemDia: 'escala' }
}

function ajusteAnterior(parcial: Partial<LancamentoAjusteVT>): LancamentoAjusteVT {
  return {
    id: 'ajuste-1',
    loteOrigemId: 'lote-anterior',
    linhaOrigemId: null,
    colaboradorId: 'pessoa-sem-dias',
    data: null,
    tipo: 'credito',
    valorCentavos: 400,
    evidencia: 'Ponto conferido',
    criadoPor: 'usuario-1',
    criadoEm: '2026-11-01T10:00:00Z',
    consumidoPorLoteId: null,
    ...parcial,
  }
}

describe('construção do lote por data de serviço', () => {
  it('aplica reajuste no meio do mês e deduplica o mesmo dia', async () => {
    const lote = await construirRascunhoLoteCarga(entrada({
      dias: [dia('2026-11-10'), dia('2026-11-20'), dia('2026-11-20')],
      versoesPreco: [
        versao({ id: 'v1', valorDiarioCentavos: 1000, vigenteAte: '2026-11-14' }),
        versao({ id: 'v2', valorDiarioCentavos: 1200, vigenteDesde: '2026-11-15' }),
      ],
    }))

    expect(lote.linhas.map((linha) => linha.custoDiaCentavos)).toEqual([1000, 1200])
    expect(lote.totaisPorColaborador[0]).toMatchObject({
      status: 'completo',
      necessidadeCentavos: 2200,
      valorCentavos: 2200,
    })
    expect(lote.valorCentavos).toBe(2200)
    expect(lote.conteudoHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('preserva múltiplos pacotes e ajustes no snapshot diário', async () => {
    const lote = await construirRascunhoLoteCarga(entrada({
      dias: [dia('2026-11-10')],
      componentes: [COMPONENTE, {
        id: 'componente-2',
        decisaoTrajetoId: DECISAO.id,
        pacoteId: 'pacote-2',
        ordem: 2,
      }],
      versoesPreco: [versao({}), versao({ id: 'preco-2', pacoteId: 'pacote-2', valorDiarioCentavos: 500 })],
      ajustesBeneficio: [{
        id: 'extra-1',
        decisaoTrajetoId: DECISAO.id,
        valorDiarioCentavos: 200,
        motivo: 'Complemento autorizado',
        autorId: 'usuario-1',
        vigenteDesde: '2026-01-01',
        vigenteAte: null,
      }],
    }))

    expect(lote.linhas[0].componentes).toHaveLength(2)
    expect(lote.linhas[0].ajustes).toHaveLength(1)
    expect(lote.linhas[0].custoDiaCentavos).toBe(1700)
  })

  it('dia sem preço fica pendente e o total não é confirmável', async () => {
    const lote = await construirRascunhoLoteCarga(entrada({
      dias: [dia('2026-11-10'), dia('2026-11-20')],
      versoesPreco: [versao({ vigenteAte: '2026-11-14' })],
    }))

    expect(lote.linhas.map((linha) => linha.custoDiaCentavos)).toEqual([1000, null])
    expect(lote.pendencias.map((pendencia) => pendencia.codigo)).toContain('preco_ausente')
    expect(lote.necessidadeCentavos).toBe(1000)
    expect(lote.valorCentavos).toBeNull()
    expect(lote.totaisPorColaborador[0].status).toBe('parcial')
  })

  it('pessoa sem dias mantém crédito anterior no lote', async () => {
    const lote = await construirRascunhoLoteCarga(entrada({
      ajustesAnteriores: [ajusteAnterior({})],
    }))

    expect(lote.linhas).toEqual([])
    expect(lote.totaisPorColaborador[0]).toMatchObject({
      colaboradorId: 'pessoa-sem-dias',
      necessidadeCentavos: 0,
      ajusteCentavos: 400,
      valorCentavos: 400,
    })
    expect(lote.valorCentavos).toBe(400)
  })

  it('recusa dia fora da competência', async () => {
    await expect(construirRascunhoLoteCarga(entrada({ dias: [dia('2026-12-01')] })))
      .rejects.toThrow('não pertence à competência')
  })
})
