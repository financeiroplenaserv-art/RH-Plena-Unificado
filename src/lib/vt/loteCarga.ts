import type {
  LancamentoAjusteVT,
  LinhaLoteCargaVT,
  PendenciaLoteCargaVT,
  TotalColaboradorLoteCargaVT,
} from '@/lib/vt/contratosLoteCarga'

export function totalizarColaboradorLote({
  colaboradorId,
  linhas,
  ajustesAnteriores,
  pendencias = [],
}: {
  colaboradorId: string
  linhas: readonly LinhaLoteCargaVT[]
  ajustesAnteriores: readonly LancamentoAjusteVT[]
  pendencias?: readonly PendenciaLoteCargaVT[]
}): TotalColaboradorLoteCargaVT {
  const linhasDaPessoa = linhas.filter((linha) => linha.colaboradorId === colaboradorId)
  const ajustesDaPessoa = ajustesAnteriores.filter((ajuste) =>
    ajuste.colaboradorId === colaboradorId && ajuste.consumidoPorLoteId == null
  )
  const pendenciasQueImpedem = pendencias.filter((pendencia) =>
    pendencia.impeditivaConfirmacao &&
    (pendencia.colaboradorId == null || pendencia.colaboradorId === colaboradorId)
  )
  const ajustesPendentes = ajustesDaPessoa.filter((ajuste) =>
    ajuste.tipo === 'pendencia' || ajuste.valorCentavos == null
  )
  const ajustesConsumiveis = ajustesDaPessoa.filter((ajuste) =>
    ajuste.tipo !== 'pendencia' && ajuste.valorCentavos != null
  )
  const necessidadeCentavos = linhasDaPessoa.reduce(
    (soma, linha) => soma + (linha.custoDiaCentavos ?? 0),
    0,
  )
  const ajusteCentavos = ajustesConsumiveis.reduce((soma, ajuste) =>
    soma + (ajuste.tipo === 'debito' ? -Math.abs(ajuste.valorCentavos!) : Math.abs(ajuste.valorCentavos!)),
  0)
  const extras = ajustesConsumiveis.filter((ajuste) => ajuste.origem === 'extra_mensal')
  if (extras.some((extra) => extra.tipo !== 'credito' || extra.evidencia.trim() === '')) {
    throw new Error('O extra mensal precisa ser um crédito com motivo.')
  }
  const extraMensalCentavos = extras.reduce((soma, extra) => soma + Math.abs(extra.valorCentavos!), 0)
  const pendenciaIds = [...new Set([
    ...pendenciasQueImpedem.map((pendencia) => pendencia.id),
    ...ajustesPendentes.map((ajuste) => ajuste.id),
    ...linhasDaPessoa.flatMap((linha) => linha.pendenciaIds),
  ])]
  const completo = pendenciaIds.length === 0 && linhasDaPessoa.every((linha) => linha.custoDiaCentavos != null)
  const bruto = necessidadeCentavos + ajusteCentavos

  return {
    colaboradorId,
    status: completo ? 'completo' : 'parcial',
    necessidadeCentavos,
    ajusteCentavos,
    valorCentavos: completo ? Math.max(0, bruto) : null,
    excedenteTruncadoCentavos: completo ? Math.max(0, -bruto) : null,
    lancamentoAjusteIds: ajustesConsumiveis.map((ajuste) => ajuste.id),
    pendenciaIds,
    ...(extras.length > 0
      ? {
          extraMensalCentavos,
          extraMensalMotivo: extras.map((extra) => extra.evidencia.trim()).join(' | '),
        }
      : {}),
  }
}
