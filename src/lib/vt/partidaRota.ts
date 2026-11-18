import { agoraBrasil } from '@/lib/utils'

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Próxima segunda-feira no horário de Brasília (UTC-3, sem horário de verão desde
 * 2019), em ISO UTC — horário de partida enviado ao Google Routes (ida ou volta).
 */
export function partidaProximaSegundaBRT(horaMinuto: string): string {
  const casamento = HORA_VALIDA.exec(horaMinuto.trim())
  if (!casamento) throw new Error('Horário inválido. Use o formato HH:MM (ex.: 18:00).')
  const agora = agoraBrasil()
  const diasAteSegunda = (8 - agora.getDay()) % 7 || 7
  const segunda = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + diasAteSegunda)
  const dia = `${segunda.getFullYear()}-${String(segunda.getMonth() + 1).padStart(2, '0')}-${String(segunda.getDate()).padStart(2, '0')}`
  return new Date(`${dia}T${casamento[1]}:${casamento[2]}:00-03:00`).toISOString()
}
