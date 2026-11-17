import { describe, expect, it } from 'vitest'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import {
  atualizarConteudoHashLote,
  avaliarBannerLote,
  calcularConteudoHashLote,
  conteudoCanonicoLote,
} from '@/lib/vt/loteConteudo'

function loteBase(): LoteCargaVT {
  return {
    id: 'lote-1',
    competencia: '2026-11',
    status: 'rascunho',
    versaoConteudo: 3,
    conteudoHash: '',
    versaoCalculo: '3.0.0',
    versaoRegras: { tarifas: '2026-11-01', integracoes: '2026-11-01' },
    fonte: {
      tipo: 'gestao_escalas_flit',
      nomeArquivo: 'escalas.xlsx',
      conteudoHash: 'fonte-sha',
      importadoEm: '2026-11-01T10:00:00Z',
    },
    linhas: [{
      id: 'linha-1',
      colaboradorId: 'pessoa-1',
      departamentoId: 'posto-1',
      data: '2026-11-10',
      origemDia: 'escala',
      decisaoTrajetoId: 'decisao-1',
      decisaoRevisao: 1,
      componentes: [{
        componenteId: 'componente-1',
        pacoteId: 'pacote-1',
        versaoPrecoId: 'preco-1',
        valorCentavos: 1000,
        vigenteDesde: '2026-01-01',
        vigenteAte: null,
      }],
      ajustes: [],
      custoDiaCentavos: 1000,
      pendenciaIds: [],
    }],
    totaisPorColaborador: [{
      colaboradorId: 'pessoa-1',
      status: 'completo',
      necessidadeCentavos: 1000,
      ajusteCentavos: 0,
      valorCentavos: 1000,
      excedenteTruncadoCentavos: 0,
      lancamentoAjusteIds: [],
      pendenciaIds: [],
    }],
    pendencias: [],
    necessidadeCentavos: 1000,
    ajusteCentavos: 0,
    valorCentavos: 1000,
    confirmacao: null,
    loteSubstituidoId: null,
  }
}

describe('conteúdo canônico e banner do lote', () => {
  it('ordena coleções e produz SHA-256 estável', async () => {
    const a = loteBase()
    const b = loteBase()
    b.id = 'outro-id'
    b.versaoConteudo = 99
    b.status = 'confirmado'
    b.fonte.importadoEm = '2026-11-02T10:00:00Z'
    b.linhas.push({ ...a.linhas[0], id: 'linha-2', data: '2026-11-11' })
    a.linhas.push({ ...a.linhas[0], id: 'linha-3', data: '2026-11-11' })
    b.linhas.reverse()
    b.totaisPorColaborador.push({ ...a.totaisPorColaborador[0], colaboradorId: 'pessoa-0' })
    a.totaisPorColaborador.push({ ...a.totaisPorColaborador[0], colaboradorId: 'pessoa-0' })
    b.totaisPorColaborador.reverse()

    expect(conteudoCanonicoLote(a)).toBe(conteudoCanonicoLote(b))
    const hash = await calcularConteudoHashLote(a)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await calcularConteudoHashLote(b)).toBe(hash)
  })

  it('fechar a vigência antiga não muda o hash histórico; mudar preço muda', async () => {
    const lote = loteBase()
    const antes = await calcularConteudoHashLote(lote)
    lote.linhas[0].componentes[0].vigenteAte = '2026-11-30'

    expect(await calcularConteudoHashLote(lote)).toBe(antes)

    lote.linhas[0].componentes[0].valorCentavos = 1200
    expect(await calcularConteudoHashLote(lote)).not.toBe(antes)
  })

  it('banner usa conteúdo e expõe as versões salva, atual e confirmada', async () => {
    const calculado = await atualizarConteudoHashLote(loteBase())
    const salvo = { ...calculado, versaoConteudo: 2 }

    expect(avaliarBannerLote(calculado, salvo)).toEqual({
      situacao: 'rascunho',
      versaoAtual: 3,
      versaoSalva: 2,
      versaoConfirmada: null,
    })

    salvo.status = 'confirmado'
    salvo.confirmacao = {
      versaoConteudo: 2,
      conteudoHash: salvo.conteudoHash,
      confirmadaPor: 'usuario-1',
      confirmadaEm: '2026-11-15T10:00:00Z',
    }
    expect(avaliarBannerLote(calculado, salvo).situacao).toBe('confirmado')

    const alterado = await atualizarConteudoHashLote({
      ...calculado,
      valorCentavos: 1200,
    })
    expect(avaliarBannerLote(alterado, salvo).situacao).toBe('divergente')
    expect(avaliarBannerLote(calculado, null).situacao).toBe('nao_salvo')
  })

  it('banner marca lote parcial mesmo com hash salvo igual', async () => {
    const calculado = await atualizarConteudoHashLote({
      ...loteBase(),
      valorCentavos: null,
      totaisPorColaborador: [{
        ...loteBase().totaisPorColaborador[0],
        status: 'parcial',
        valorCentavos: null,
      }],
    })

    expect(avaliarBannerLote(calculado, calculado).situacao).toBe('parcial')
  })
})
