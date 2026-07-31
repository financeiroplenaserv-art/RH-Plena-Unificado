import type { ContratoAdicional } from '@/types/adicionais'

export function diaIntrajornada(contrato: ContratoAdicional | undefined | null, dataStr: string): boolean {
  if (!contrato || !contrato.adicionais?.intrajornada) return false
  if (!contrato.dias_intrajornada || contrato.dias_intrajornada.length === 0) return false

  const diaSemana = new Date(dataStr + 'T00:00:00').getDay()
  return contrato.dias_intrajornada.includes(diaSemana)
}

/** Previsão da escala (fallback): o vínculo trabalha nesse dia pelo regime? */
export function escaladoParaTrabalhar(regime: string | undefined, dataInicioVinculo: string | undefined, data: string): boolean {
  if (regime === '5x2') {
    const dia = new Date(data + 'T00:00:00').getDay()
    return dia >= 1 && dia <= 5
  }
  if (regime === 'personalizado') return true
  if (!dataInicioVinculo) return true
  const inicio = new Date(dataInicioVinculo + 'T00:00:00')
  const atual = new Date(data + 'T00:00:00')
  const diffDias = Math.floor((atual.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
  if (regime === '6x1') return diffDias % 7 < 6
  // 12x36 (padrão): dia sim, dia não
  return diffDias % 2 === 0
}

/**
 * Adicional de feriado (regra da gestão, 31/07/2026): conta APENAS os
 * feriados cadastrados em que o vínculo estava PREVISTO para trabalhar pela
 * escala. Quem trabalha no feriado sem estar escalado (substituto, cobertura
 * extra) NÃO recebe; e só vale para contratos com o flag `adicionais.feriado`.
 */
export function contarDiasFeriadoEscalado(
  regime: string | undefined,
  dataInicioVinculo: string | undefined,
  diasDoPeriodo: string[],
  datasFeriados: Set<string>
): number {
  let total = 0
  for (const data of diasDoPeriodo) {
    if (datasFeriados.has(data) && escaladoParaTrabalhar(regime, dataInicioVinculo, data)) total++
  }
  return total
}

