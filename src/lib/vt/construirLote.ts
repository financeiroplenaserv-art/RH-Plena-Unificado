import type {
  AjusteBeneficioVT,
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'
import type {
  FonteLoteCargaVT,
  LancamentoAjusteVT,
  LinhaLoteCargaVT,
  LoteCargaVT,
  PendenciaLoteCargaVT,
} from '@/lib/vt/contratosLoteCarga'
import { atualizarConteudoHashLote } from '@/lib/vt/loteConteudo'
import { totalizarColaboradorLote } from '@/lib/vt/loteCarga'
import { resolverCustoDiarioNaData } from '@/lib/vt/temporalidade'

export interface DiaPlanejadoLoteVT {
  colaboradorId: string
  departamentoId: string
  data: string
  origemDia: LinhaLoteCargaVT['origemDia']
}

export async function construirRascunhoLoteCarga({
  id,
  competencia,
  versaoConteudo = 1,
  versaoCalculo,
  versaoRegras,
  fonte,
  dias,
  colaboradorIds: colaboradorIdsInformados = [],
  decisoes,
  componentes,
  versoesPreco,
  ajustesBeneficio = [],
  ajustesAnteriores = [],
  pendencias: pendenciasIniciais = [],
}: {
  id: string
  competencia: string
  versaoConteudo?: number
  versaoCalculo: string
  versaoRegras: Readonly<Record<string, string>>
  fonte: FonteLoteCargaVT
  dias: readonly DiaPlanejadoLoteVT[]
  colaboradorIds?: readonly string[]
  decisoes: readonly DecisaoTrajetoVT[]
  componentes: readonly ComponenteDecisaoTrajetoVT[]
  versoesPreco: readonly VersaoPrecoPacoteVT[]
  ajustesBeneficio?: readonly AjusteBeneficioVT[]
  ajustesAnteriores?: readonly LancamentoAjusteVT[]
  pendencias?: readonly PendenciaLoteCargaVT[]
}): Promise<LoteCargaVT> {
  const diasUnicos = new Map<string, DiaPlanejadoLoteVT>()
  for (const dia of dias) {
    if (!dia.data.startsWith(`${competencia}-`)) {
      throw new Error(`O dia ${dia.data} não pertence à competência ${competencia}.`)
    }
    const chave = `${dia.colaboradorId}|${dia.departamentoId}|${dia.data}|${dia.origemDia}`
    if (!diasUnicos.has(chave)) diasUnicos.set(chave, dia)
  }

  const linhas: LinhaLoteCargaVT[] = []
  const pendencias = [...pendenciasIniciais]
  for (const dia of diasUnicos.values()) {
    const linhaId = `${dia.colaboradorId}:${dia.departamentoId}:${dia.data}:${dia.origemDia}`
    const resolucao = resolverCustoDiarioNaData({
      colaboradorId: dia.colaboradorId,
      departamentoId: dia.departamentoId,
      dataServico: dia.data,
      decisoes,
      componentes,
      versoesPreco,
      ajustes: ajustesBeneficio,
    })
    const pendenciaIds: string[] = []
    for (const pendencia of resolucao.pendencias) {
      const id = `${linhaId}:${pendencia.codigo}:${pendencia.pacoteId ?? 'geral'}`
      pendenciaIds.push(id)
      pendencias.push({
        id,
        colaboradorId: dia.colaboradorId,
        codigo: pendencia.codigo,
        mensagem: pendencia.mensagem,
        impeditivaConfirmacao: true,
      })
    }
    linhas.push({
      id: linhaId,
      colaboradorId: dia.colaboradorId,
      departamentoId: dia.departamentoId,
      data: dia.data,
      origemDia: dia.origemDia,
      decisaoTrajetoId: resolucao.decisaoId,
      decisaoRevisao: resolucao.decisaoRevisao,
      componentes: resolucao.componentes,
      ajustes: resolucao.ajustes,
      custoDiaCentavos: resolucao.totalCentavos,
      pendenciaIds,
    })
  }

  const colaboradorIds = [...new Set([
    ...colaboradorIdsInformados,
    ...linhas.map((linha) => linha.colaboradorId),
    ...ajustesAnteriores.map((ajuste) => ajuste.colaboradorId),
  ])].sort()
  const totaisPorColaborador = colaboradorIds.map((colaboradorId) =>
    totalizarColaboradorLote({
      colaboradorId,
      linhas,
      ajustesAnteriores,
      pendencias,
    })
  )
  const completo = totaisPorColaborador.every((total) => total.status === 'completo')
  const lote: LoteCargaVT = {
    id,
    competencia,
    status: 'rascunho',
    versaoConteudo,
    conteudoHash: '',
    versaoCalculo,
    versaoRegras,
    fonte,
    linhas,
    totaisPorColaborador,
    pendencias,
    necessidadeCentavos: totaisPorColaborador.reduce((soma, total) => soma + total.necessidadeCentavos, 0),
    ajusteCentavos: totaisPorColaborador.reduce((soma, total) => soma + total.ajusteCentavos, 0),
    valorCentavos: completo
      ? totaisPorColaborador.reduce((soma, total) => soma + (total.valorCentavos ?? 0), 0)
      : null,
    confirmacao: null,
    loteSubstituidoId: null,
  }
  return atualizarConteudoHashLote(lote)
}
