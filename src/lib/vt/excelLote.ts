import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import { calcularConteudoHashLote } from '@/lib/vt/loteConteudo'
import type { RepositorioLoteCargaAplicacao } from '@/hooks/useVtLoteCarga'
import { formatarCentavos } from '@/lib/vt/bilhetes'

function agruparPorPosto(lote: LoteCargaVT, colaboradorId: string): string {
  const grupos = new Map<string, { dias: Set<string>; custos: Map<number, number> }>()
  for (const linha of lote.linhas.filter((item) => item.colaboradorId === colaboradorId)) {
    const grupo = grupos.get(linha.departamentoId) ?? { dias: new Set<string>(), custos: new Map<number, number>() }
    grupo.dias.add(linha.data)
    if (linha.custoDiaCentavos != null) {
      grupo.custos.set(linha.custoDiaCentavos, (grupo.custos.get(linha.custoDiaCentavos) ?? 0) + 1)
    }
    grupos.set(linha.departamentoId, grupo)
  }
  return [...grupos.entries()].map(([posto, grupo]) => {
    const custos = [...grupo.custos.entries()]
      .map(([custo, dias]) => `${dias}d × ${formatarCentavos(custo)}`)
      .join(' + ')
    return `${posto}: ${grupo.dias.size} dia(s)${custos ? ` (${custos})` : ''}`
  }).join('; ')
}

export async function montarWorkbookLote(lote: LoteCargaVT, nomes?: ReadonlyMap<string, string>) {
  if (lote.status !== 'confirmado') throw new Error('O Excel só pode ser gerado de um lote confirmado.')
  if (await calcularConteudoHashLote(lote) !== lote.conteudoHash) {
    throw new Error('O hash do lote confirmado não confere; a exportação foi bloqueada.')
  }

  const XLSX = await import('@e965/xlsx')
  const dados = lote.totaisPorColaborador.map((total) => ({
    Colaborador: nomes?.get(total.colaboradorId) ?? total.colaboradorId,
    Postos: agruparPorPosto(lote, total.colaboradorId),
    'Necessidade (R$)': total.necessidadeCentavos / 100,
    // Ajuste do fechamento do mês anterior; o extra mensal tem coluna própria (não conta duas vezes).
    'Ajuste (R$)': (total.ajusteCentavos - (total.extraMensalCentavos ?? 0)) / 100,
    'Extra no mês (R$)': (total.extraMensalCentavos ?? 0) / 100,
    'Motivo do extra': total.extraMensalMotivo ?? '',
    'Total a creditar (R$)': total.valorCentavos == null ? null : total.valorCentavos / 100,
  }))
  const worksheet = XLSX.utils.json_to_sheet(dados)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Carga VT')
  return workbook
}

export async function baixarExcelLoteConfirmado(
  repositorio: RepositorioLoteCargaAplicacao,
  loteId: string,
  nomes?: ReadonlyMap<string, string>,
): Promise<void> {
  const lote = await repositorio.obter(loteId)
  if (!lote) throw new Error('Lote não encontrado para exportação.')
  const workbook = await montarWorkbookLote(lote, nomes)
  const XLSX = await import('@e965/xlsx')
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `vt_lote_${lote.competencia}_${lote.id}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
