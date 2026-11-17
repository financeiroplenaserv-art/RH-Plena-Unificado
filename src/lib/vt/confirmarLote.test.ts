import { describe, expect, it } from 'vitest'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import {
  confirmarLoteCarga,
  RepositorioLoteCargaEmMemoria,
} from '@/lib/vt/confirmarLote'
import { atualizarConteudoHashLote } from '@/lib/vt/loteConteudo'

function loteBase(): LoteCargaVT {
  return {
    id: 'lote-1',
    competencia: '2026-11',
    status: 'rascunho',
    versaoConteudo: 3,
    conteudoHash: '',
    versaoCalculo: '3.0.0',
    versaoRegras: { tarifas: '2026-11-01' },
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
      componentes: [],
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

async function lotePronto(): Promise<LoteCargaVT> {
  return atualizarConteudoHashLote(loteBase())
}

const entrada = (usuarioId = 'usuario-1') => ({
  loteId: 'lote-1',
  versaoEsperada: 3,
  usuarioId,
  agora: '2026-11-15T12:00:00Z',
})

describe('confirmação atômica do lote em memória', () => {
  it('confirma uma única vez e protege o snapshot contra mutações externas', async () => {
    const repositorio = new RepositorioLoteCargaEmMemoria([await lotePronto()])

    const confirmado = await confirmarLoteCarga(repositorio, entrada())

    expect(confirmado.status).toBe('confirmado')
    expect(confirmado.confirmacao).toEqual({
      versaoConteudo: 3,
      conteudoHash: confirmado.conteudoHash,
      confirmadaPor: 'usuario-1',
      confirmadaEm: '2026-11-15T12:00:00Z',
    })

    confirmado.valorCentavos = 0
    confirmado.linhas[0].custoDiaCentavos = 0
    const salvo = await repositorio.obter('lote-1')
    expect(salvo?.valorCentavos).toBe(1000)
    expect(salvo?.linhas[0].custoDiaCentavos).toBe(1000)

    salvo!.valorCentavos = 0
    expect((await repositorio.obter('lote-1'))?.valorCentavos).toBe(1000)
  })

  it('recusa versão antiga sem alterar o rascunho', async () => {
    const repositorio = new RepositorioLoteCargaEmMemoria([await lotePronto()])

    await expect(confirmarLoteCarga(repositorio, { ...entrada(), versaoEsperada: 2 }))
      .rejects.toMatchObject({ codigo: 'conflito_versao' })
    expect((await repositorio.obter('lote-1'))?.status).toBe('rascunho')
  })

  it('recusa lote parcial e conteúdo adulterado', async () => {
    const parcial = await atualizarConteudoHashLote({
      ...loteBase(),
      valorCentavos: null,
      totaisPorColaborador: [{
        ...loteBase().totaisPorColaborador[0],
        status: 'parcial',
        valorCentavos: null,
      }],
    })
    const repositorioParcial = new RepositorioLoteCargaEmMemoria([parcial])
    await expect(confirmarLoteCarga(repositorioParcial, entrada()))
      .rejects.toMatchObject({ codigo: 'lote_parcial' })

    const adulterado = await lotePronto()
    adulterado.conteudoHash = 'hash-invalido'
    const repositorioAdulterado = new RepositorioLoteCargaEmMemoria([adulterado])
    await expect(confirmarLoteCarga(repositorioAdulterado, entrada()))
      .rejects.toMatchObject({ codigo: 'conteudo_divergente' })
    expect((await repositorioAdulterado.obter('lote-1'))?.status).toBe('rascunho')
  })

  it('duas confirmações concorrentes têm exatamente uma vencedora', async () => {
    const repositorio = new RepositorioLoteCargaEmMemoria([await lotePronto()])

    const resultados = await Promise.allSettled([
      confirmarLoteCarga(repositorio, entrada('operador-a')),
      confirmarLoteCarga(repositorio, entrada('operador-b')),
    ])

    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(1)
    expect(resultados.filter((resultado) => resultado.status === 'rejected')).toHaveLength(1)
    const salvo = await repositorio.obter('lote-1')
    expect(salvo?.status).toBe('confirmado')
    expect(['operador-a', 'operador-b']).toContain(salvo?.confirmacao?.confirmadaPor)
  })

  it('não confirma lote inexistente nem confirma duas vezes', async () => {
    const repositorio = new RepositorioLoteCargaEmMemoria([await lotePronto()])
    await expect(confirmarLoteCarga(repositorio, { ...entrada(), loteId: 'ausente' }))
      .rejects.toMatchObject({ codigo: 'nao_encontrado' })

    await confirmarLoteCarga(repositorio, entrada())
    await expect(confirmarLoteCarga(repositorio, entrada()))
      .rejects.toMatchObject({ codigo: 'ja_confirmado' })
  })
})
