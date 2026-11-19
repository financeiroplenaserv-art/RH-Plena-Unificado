import { agoraBrasil } from '@/lib/utils'

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Próxima segunda-feira no horário de Brasília (UTC-3, sem horário de verão desde
 * 2019), em ISO UTC — horário de partida/chegada enviado ao Google Routes (ida ou volta).
 * `diasDepois` desloca o dia (turno noturno: a volta é na terça de madrugada).
 */
export function partidaProximaSegundaBRT(horaMinuto: string, diasDepois = 0): string {
  const casamento = HORA_VALIDA.exec(horaMinuto.trim())
  if (!casamento) throw new Error('Horário inválido. Use o formato HH:MM (ex.: 18:00).')
  const agora = agoraBrasil()
  const diasAteSegunda = (8 - agora.getDay()) % 7 || 7
  const segunda = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + diasAteSegunda + diasDepois)
  const dia = `${segunda.getFullYear()}-${String(segunda.getMonth() + 1).padStart(2, '0')}-${String(segunda.getDate()).padStart(2, '0')}`
  return new Date(`${dia}T${casamento[1]}:${casamento[2]}:00-03:00`).toISOString()
}

/**
 * Máscara de digitação hh:mm: só números, dois-pontos automático depois do
 * segundo dígito, no máximo 5 caracteres (1000 → 10:00).
 */
export function mascararHoraMinuto(entrada: string): string {
  const digitos = entrada.replace(/\D/g, '').slice(0, 4)
  return digitos.length > 2 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos
}

/** true quando o texto é um horário completo e válido (00:00 a 23:59). */
export function horaMinutoValida(valor: string): boolean {
  return HORA_VALIDA.test(valor.trim())
}
