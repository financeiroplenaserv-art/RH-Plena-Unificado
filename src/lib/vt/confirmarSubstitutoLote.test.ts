import { describe, expect, it } from 'vitest'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import {
  confirmarLoteCarga,
  confirmarSubstitutoLoteCarga,
  RepositorioLoteCargaEmMemoria,
} from '@/lib/vt/confirmarLote'
import {
  aprovarDivergenciaColaborador,
  compararTotaisPorColaborador,
} from '@/lib/vt/divergenciasLote'
import { atualizarConteudoHashLote } from '@/lib/vt/loteConteudo'

function lote(id: string, valor: number, substituidoId: string | null = null): LoteCargaVT {
  return {
    id,
    competencia: '2026-11',
    status: 'rascunho',
    versaoConteudo: 1,
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
      id: `linha-${id}`,
      colaboradorId: 'pessoa-1',
      departamentoId: 'posto-1',
      data: '2026-11-10',
      origemDia: 'escala',
      decisaoTrajetoId: 'decisao-1',
      decisaoRevisao: 1,
      componentes: [],
      ajustes: [],
      custoDiaCentavos: valor,
      pendenciaIds: [],
    }],
    totaisPorColaborador: [{
      colaboradorId: 'pessoa-1',
      status: 'completo',
      necessidadeCentavos: valor,
      ajusteCentavos: 0,
      valorCentavos: valor,
      excedenteTruncadoCentavos: 0,
      lancamentoAjusteIds: [],
      pendenciaIds: [],
    }],
    pendencias: [],
    necessidadeCentavos: valor,
    ajusteCentavos: 0,
    valorCentavos: valor,
    confirmacao: null,
    loteSubstituidoId: substituidoId,
  }
}

async function cenario() {
  const anterior = await atualizarConteudoHashLote(lote('anterior', 1000))
  const novo = await atualizarConteudoHashLote(lote('novo', 1200, 'anterior'))
  const repositorio = new RepositorioLoteCargaEmMemoria([anterior, novo])
  await confirmarLoteCarga(repositorio, {
    loteId: 'anterior',
    versaoEsperada: 1,
    usuarioId: 'usuario-1',
    agora: '2026-11-15T10:00:00Z',
  })
  const confirmadoAnterior = (await repositorio.obter('anterior'))!
  const divergencias = compararTotaisPorColaborador(
    confirmadoAnterior.totaisPorColaborador,
    novo.totaisPorColaborador,
  )
  const aprovacoes = await Promise.all(
    divergencias.filter((item) => item.exigeAprovacao).map((item) =>
      aprovarDivergenciaColaborador(item, 'usuario-2', '2026-11-15T11:00:00Z')
    ),
  )
  return { repositorio, novo, aprovacoes }
}

const entrada = {
  anteriorId: 'anterior',
  versaoEsperadaAnterior: 1,
  novoLoteId: 'novo',
  versaoEsperadaNovo: 1,
  usuarioId: 'usuario-2',
  agora: '2026-11-15T12:00:00Z',
}

describe('substituição de lote com aprovações', () => {
  it('não substitui sem aprovação e depois confirma os dois lados atomicamente', async () => {
    const { repositorio, aprovacoes } = await cenario()

    await expect(confirmarSubstitutoLoteCarga(repositorio, entrada))
      .rejects.toMatchObject({ codigo: 'divergencias_pendentes' })
    expect((await repositorio.obter('anterior'))?.status).toBe('confirmado')
    expect((await repositorio.obter('novo'))?.status).toBe('rascunho')

    const confirmado = await confirmarSubstitutoLoteCarga(repositorio, { ...entrada, aprovacoes })

    expect(confirmado.status).toBe('confirmado')
    expect(confirmado.loteSubstituidoId).toBe('anterior')
    expect((await repositorio.obter('anterior'))).toMatchObject({
      status: 'substituido',
      valorCentavos: 1000,
    })
    expect((await repositorio.obter('novo'))?.status).toBe('confirmado')
  })

  it('confirmação comum não contorna as aprovações da substituição', async () => {
    const { repositorio } = await cenario()

    await expect(confirmarLoteCarga(repositorio, {
      loteId: 'novo',
      versaoEsperada: 1,
      usuarioId: 'usuario-2',
      agora: '2026-11-15T12:00:00Z',
    })).rejects.toMatchObject({ codigo: 'substituicao_requer_aprovacao' })
  })

  it('mudança depois da aprovação impede a substituição', async () => {
    const { repositorio, novo, aprovacoes } = await cenario()
    const alterado = await atualizarConteudoHashLote({
      ...novo,
      valorCentavos: 1300,
      necessidadeCentavos: 1300,
      totaisPorColaborador: [{
        ...novo.totaisPorColaborador[0],
        necessidadeCentavos: 1300,
        valorCentavos: 1300,
      }],
    })
    const comAlteracao = new RepositorioLoteCargaEmMemoria([
      (await repositorio.obter('anterior'))!,
      alterado,
    ])

    await expect(confirmarSubstitutoLoteCarga(comAlteracao, { ...entrada, aprovacoes }))
      .rejects.toMatchObject({ codigo: 'divergencias_pendentes' })
    expect((await comAlteracao.obter('anterior'))?.status).toBe('confirmado')
    expect((await comAlteracao.obter('novo'))?.status).toBe('rascunho')
  })

  it('duas substituições concorrentes têm somente uma vencedora', async () => {
    const { repositorio, aprovacoes } = await cenario()

    const resultados = await Promise.allSettled([
      confirmarSubstitutoLoteCarga(repositorio, { ...entrada, aprovacoes }),
      confirmarSubstitutoLoteCarga(repositorio, { ...entrada, aprovacoes }),
    ])

    expect(resultados.filter((resultado) => resultado.status === 'fulfilled')).toHaveLength(1)
    expect(resultados.filter((resultado) => resultado.status === 'rejected')).toHaveLength(1)
    expect((await repositorio.obter('anterior'))?.status).toBe('substituido')
    expect((await repositorio.obter('novo'))?.status).toBe('confirmado')
  })
})
