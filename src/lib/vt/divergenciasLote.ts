import type { TotalColaboradorLoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import { jsonCanonico, sha256Hex } from '@/lib/vt/loteConteudo'

export interface DivergenciaColaboradorLote {
  colaboradorId: string
  tipo: 'incluido' | 'removido' | 'alterado' | 'inalterado'
  anterior: TotalColaboradorLoteCargaVT | null
  atual: TotalColaboradorLoteCargaVT | null
  diferencaValorCentavos: number | null
  camposAlterados: string[]
  exigeAprovacao: boolean
}

export interface AprovacaoDivergenciaLote {
  colaboradorId: string
  divergenciaHash: string
  aprovadaPor: string
  aprovadaEm: string
}

function totalParaComparacao(total: TotalColaboradorLoteCargaVT | null): unknown {
  if (!total) return null
  return {
    colaboradorId: total.colaboradorId,
    status: total.status,
    necessidadeCentavos: total.necessidadeCentavos,
    ajusteCentavos: total.ajusteCentavos,
    valorCentavos: total.valorCentavos,
    excedenteTruncadoCentavos: total.excedenteTruncadoCentavos,
    lancamentoAjusteIds: [...total.lancamentoAjusteIds].sort(),
    pendenciaIds: [...total.pendenciaIds].sort(),
  }
}

function camposDiferentes(
  anterior: TotalColaboradorLoteCargaVT,
  atual: TotalColaboradorLoteCargaVT,
): string[] {
  const campos: string[] = []
  if (anterior.status !== atual.status) campos.push('situação')
  if (anterior.necessidadeCentavos !== atual.necessidadeCentavos) campos.push('necessidade')
  if (anterior.ajusteCentavos !== atual.ajusteCentavos) campos.push('ajuste')
  if (anterior.valorCentavos !== atual.valorCentavos) campos.push('valor final')
  if (anterior.excedenteTruncadoCentavos !== atual.excedenteTruncadoCentavos) campos.push('excedente truncado')
  if (jsonCanonico([...anterior.lancamentoAjusteIds].sort()) !== jsonCanonico([...atual.lancamentoAjusteIds].sort())) {
    campos.push('lançamentos consumidos')
  }
  if (jsonCanonico([...anterior.pendenciaIds].sort()) !== jsonCanonico([...atual.pendenciaIds].sort())) {
    campos.push('pendências')
  }
  return campos
}

export function compararTotaisPorColaborador(
  anteriores: readonly TotalColaboradorLoteCargaVT[],
  atuais: readonly TotalColaboradorLoteCargaVT[],
): DivergenciaColaboradorLote[] {
  const anteriorPorId = new Map(anteriores.map((total) => [total.colaboradorId, total]))
  const atualPorId = new Map(atuais.map((total) => [total.colaboradorId, total]))
  const ids = [...new Set([...anteriorPorId.keys(), ...atualPorId.keys()])].sort()

  return ids.map((colaboradorId) => {
    const anterior = anteriorPorId.get(colaboradorId) ?? null
    const atual = atualPorId.get(colaboradorId) ?? null
    const diferencaValorCentavos = anterior && atual && anterior.valorCentavos != null && atual.valorCentavos != null
      ? atual.valorCentavos - anterior.valorCentavos
      : null
    if (!anterior || !atual) {
      const incluido = !anterior
      return {
        colaboradorId,
        tipo: incluido ? 'incluido' : 'removido',
        anterior,
        atual,
        diferencaValorCentavos: null,
        camposAlterados: [incluido ? 'colaborador incluído' : 'colaborador removido'],
        exigeAprovacao: true,
      }
    }
    const camposAlterados = camposDiferentes(anterior, atual)
    return {
      colaboradorId,
      tipo: camposAlterados.length > 0 ? 'alterado' : 'inalterado',
      anterior,
      atual,
      diferencaValorCentavos,
      camposAlterados,
      exigeAprovacao: camposAlterados.length > 0,
    }
  })
}

export async function hashDivergenciaColaborador(
  divergencia: Pick<DivergenciaColaboradorLote, 'anterior' | 'atual'>,
): Promise<string> {
  return sha256Hex(jsonCanonico({
    anterior: totalParaComparacao(divergencia.anterior),
    atual: totalParaComparacao(divergencia.atual),
  }))
}

export async function aprovarDivergenciaColaborador(
  divergencia: DivergenciaColaboradorLote,
  usuarioId: string,
  agora: string,
): Promise<AprovacaoDivergenciaLote> {
  if (!divergencia.exigeAprovacao) throw new Error('A divergência não exige aprovação.')
  return {
    colaboradorId: divergencia.colaboradorId,
    divergenciaHash: await hashDivergenciaColaborador(divergencia),
    aprovadaPor: usuarioId,
    aprovadaEm: agora,
  }
}

export async function verificarAprovacoesDivergencias(
  divergencias: readonly DivergenciaColaboradorLote[],
  aprovacoes: readonly AprovacaoDivergenciaLote[],
): Promise<{
  completa: boolean
  pendentes: DivergenciaColaboradorLote[]
  validas: AprovacaoDivergenciaLote[]
}> {
  const pendentes: DivergenciaColaboradorLote[] = []
  const validas: AprovacaoDivergenciaLote[] = []
  for (const divergencia of divergencias) {
    if (!divergencia.exigeAprovacao) continue
    const hash = await hashDivergenciaColaborador(divergencia)
    const aprovacao = aprovacoes.find((item) =>
      item.colaboradorId === divergencia.colaboradorId && item.divergenciaHash === hash
    )
    if (aprovacao) validas.push(aprovacao)
    else pendentes.push(divergencia)
  }
  return { completa: pendentes.length === 0, pendentes, validas }
}
