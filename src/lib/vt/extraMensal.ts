/**
 * "Extra no mês (R$)" (decisão da gestora, 22/11/2026 — migration 176): valor TOTAL do mês por
 * pessoa, com motivo obrigatório, válido só para a competência. Lançamento humano, nunca automático.
 * Lógica pura de validação; a gravação fica no hook `useVtExtrasMensais`.
 */
import { parseMoedaParaCentavos } from '@/lib/utils'

export interface ExtraMensalValidado {
  valorCentavos: number
  motivo: string
}

export type ResultadoValidacaoExtra =
  | { ok: true; extra: ExtraMensalValidado }
  | { ok: false; erro: string }

/** Teto definido pela gestora em 22/11/2026: R$ 500,00 por extra no mês (barra digitação errada). */
export const TETO_EXTRA_MENSAL_CENTAVOS = 50_000

export function validarExtraMensal(valorTexto: string, motivoTexto: string): ResultadoValidacaoExtra {
  const valorCentavos = parseMoedaParaCentavos(valorTexto)
  if (valorCentavos == null || !Number.isInteger(valorCentavos) || valorCentavos <= 0) {
    return { ok: false, erro: 'Informe o valor total do mês, maior que zero (ex.: 15,00).' }
  }
  if (valorCentavos > TETO_EXTRA_MENSAL_CENTAVOS) {
    return { ok: false, erro: 'Valor acima de R$ 500,00 — confira se não foi digitado a mais.' }
  }
  const motivo = motivoTexto.trim()
  if (!motivo) return { ok: false, erro: 'O motivo é obrigatório.' }
  return { ok: true, extra: { valorCentavos, motivo } }
}

/** Centavos → texto editável "15,00" (sem símbolo de moeda). */
export function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
