import type {
  AjusteBeneficioVT,
  ComponenteDecisaoTrajetoVT,
  DecisaoTrajetoVT,
  VersaoPrecoPacoteVT,
} from '@/lib/vt/contratosTarifarios'

export interface PendenciaTemporalVT {
  codigo:
    | 'decisao_ausente'
    | 'decisao_nao_confirmada'
    | 'referencia_legada_nao_resolvida'
    | 'componentes_ausentes'
    | 'preco_ausente'
    | 'preco_ambiguo'
    | 'ajuste_sem_motivo'
    | 'valor_diario_negativo'
  mensagem: string
  pacoteId: string | null
}

export interface ComponentePrecoResolvidoVT {
  componenteId: string
  pacoteId: string
  versaoPrecoId: string
  valorCentavos: number
  vigenteDesde: string
  vigenteAte: string | null
}

export interface ResolucaoCustoDiarioVT {
  status: 'resolvido' | 'pendente'
  dataServico: string
  decisaoId: string | null
  decisaoRevisao: number | null
  componentes: ComponentePrecoResolvidoVT[]
  ajustes: AjusteBeneficioVT[]
  totalCentavos: number | null
  pendencias: PendenciaTemporalVT[]
}

export function dentroDaVigencia(
  dataServico: string,
  vigenteDesde: string | null,
  vigenteAte: string | null,
): boolean {
  return (vigenteDesde == null || vigenteDesde <= dataServico) &&
    (vigenteAte == null || dataServico <= vigenteAte)
}

function compararDecisoes(a: DecisaoTrajetoVT, b: DecisaoTrajetoVT): number {
  return b.revisao - a.revisao ||
    (b.vigenteDesde ?? '').localeCompare(a.vigenteDesde ?? '') ||
    (b.confirmadaEm ?? '').localeCompare(a.confirmadaEm ?? '') ||
    b.id.localeCompare(a.id)
}

export function decisaoTrajetoNaData(
  decisoes: readonly DecisaoTrajetoVT[],
  colaboradorId: string,
  departamentoId: string,
  dataServico: string,
): DecisaoTrajetoVT | null {
  return decisoes
    .filter((decisao) =>
      decisao.colaboradorId === colaboradorId &&
      decisao.departamentoId === departamentoId &&
      dentroDaVigencia(dataServico, decisao.vigenteDesde, decisao.vigenteAte)
    )
    .sort(compararDecisoes)[0] ?? null
}

export function versaoPrecoPacoteNaData(
  versoes: readonly VersaoPrecoPacoteVT[],
  pacoteId: string,
  dataServico: string,
): VersaoPrecoPacoteVT | null {
  const vigentes = versoes.filter((versao) =>
    versao.pacoteId === pacoteId &&
    dentroDaVigencia(dataServico, versao.vigenteDesde, versao.vigenteAte)
  )
  return vigentes.length === 1 ? vigentes[0] : null
}

export function resolverCustoDiarioNaData({
  colaboradorId,
  departamentoId,
  dataServico,
  decisoes,
  componentes,
  versoesPreco,
  ajustes = [],
}: {
  colaboradorId: string
  departamentoId: string
  dataServico: string
  decisoes: readonly DecisaoTrajetoVT[]
  componentes: readonly ComponenteDecisaoTrajetoVT[]
  versoesPreco: readonly VersaoPrecoPacoteVT[]
  ajustes?: readonly AjusteBeneficioVT[]
}): ResolucaoCustoDiarioVT {
  const decisao = decisaoTrajetoNaData(decisoes, colaboradorId, departamentoId, dataServico)
  const pendencias: PendenciaTemporalVT[] = []
  if (!decisao) {
    return {
      status: 'pendente',
      dataServico,
      decisaoId: null,
      decisaoRevisao: null,
      componentes: [],
      ajustes: [],
      totalCentavos: null,
      pendencias: [{
        codigo: 'decisao_ausente',
        mensagem: 'Não há decisão de trajeto vigente para a data do serviço.',
        pacoteId: null,
      }],
    }
  }

  if (decisao.status !== 'confirmada') {
    pendencias.push({
      codigo: 'decisao_nao_confirmada',
      mensagem: 'A decisão mais recente vigente na data ainda não foi confirmada.',
      pacoteId: null,
    })
  }
  if (decisao.referenciasLegadasNaoResolvidas.length > 0) {
    pendencias.push({
      codigo: 'referencia_legada_nao_resolvida',
      mensagem: `Há ${decisao.referenciasLegadasNaoResolvidas.length} referência(s) de bilhete legado sem pacote estável.`,
      pacoteId: null,
    })
  }

  const precoConfirmado = decisao.custoDiarioCentavos ?? null
  const componentesDaDecisao = precoConfirmado == null
    ? componentes
      .filter((componente) => componente.decisaoTrajetoId === decisao.id)
      .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))
    : []
  if (precoConfirmado == null && componentesDaDecisao.length === 0) {
    pendencias.push({
      codigo: 'componentes_ausentes',
      mensagem: 'A decisão vigente não tem pacote nem preço confirmado associado.',
      pacoteId: null,
    })
  }

  const resolvidos: ComponentePrecoResolvidoVT[] = []
  for (const componente of componentesDaDecisao) {
    const versao = versaoPrecoPacoteNaData(versoesPreco, componente.pacoteId, dataServico)
    if (!versao) {
      const temCandidataAmbigua = versoesPreco.some((candidata) =>
        candidata.pacoteId === componente.pacoteId &&
        dentroDaVigencia(dataServico, candidata.vigenteDesde, candidata.vigenteAte)
      )
      pendencias.push({
        codigo: temCandidataAmbigua ? 'preco_ambiguo' : 'preco_ausente',
        mensagem: temCandidataAmbigua
          ? 'Há mais de uma versão de preço com a mesma vigência inicial para o pacote.'
          : 'Não há preço do pacote vigente na data do serviço.',
        pacoteId: componente.pacoteId,
      })
      continue
    }
    resolvidos.push({
      componenteId: componente.id,
      pacoteId: componente.pacoteId,
      versaoPrecoId: versao.id,
      valorCentavos: versao.valorDiarioCentavos,
      vigenteDesde: versao.vigenteDesde,
      vigenteAte: versao.vigenteAte,
    })
  }

  const ajustesVigentes = ajustes
    .filter((ajuste) =>
      ajuste.decisaoTrajetoId === decisao.id &&
      dentroDaVigencia(dataServico, ajuste.vigenteDesde, ajuste.vigenteAte)
    )
    .map((ajuste) => ({ ...ajuste }))
  if (ajustesVigentes.some((ajuste) => !ajuste.motivo.trim())) {
    pendencias.push({
      codigo: 'ajuste_sem_motivo',
      mensagem: 'Todo ajuste manual precisa de motivo para compor o valor confirmado.',
      pacoteId: null,
    })
  }

  const total = (precoConfirmado ?? resolvidos.reduce((soma, componente) => soma + componente.valorCentavos, 0)) +
    ajustesVigentes.reduce((soma, ajuste) => soma + ajuste.valorDiarioCentavos, 0)
  if (pendencias.length === 0 && total < 0) {
    pendencias.push({
      codigo: 'valor_diario_negativo',
      mensagem: 'Os ajustes vigentes tornam o valor diário negativo; revisão humana obrigatória.',
      pacoteId: null,
    })
  }

  return {
    status: pendencias.length === 0 ? 'resolvido' : 'pendente',
    dataServico,
    decisaoId: decisao.id,
    decisaoRevisao: decisao.revisao,
    componentes: resolvidos,
    ajustes: ajustesVigentes,
    totalCentavos: pendencias.length === 0 ? total : null,
    pendencias,
  }
}
