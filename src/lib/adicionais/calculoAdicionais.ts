import type { ContratoAdicional } from '@/types/adicionais'

export const NOMES_DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function nomeDiaSemana(dataStr: string): string {
  const dia = new Date(dataStr + 'T00:00:00').getDay()
  return NOMES_DIA_SEMANA[dia]
}

export function diaIntrajornada(contrato: ContratoAdicional | undefined | null, dataStr: string): boolean {
  if (!contrato || !contrato.adicionais?.intrajornada) return false
  if (!contrato.dias_intrajornada || contrato.dias_intrajornada.length === 0) return false

  const diaSemana = new Date(dataStr + 'T00:00:00').getDay()
  return contrato.dias_intrajornada.includes(diaSemana)
}
