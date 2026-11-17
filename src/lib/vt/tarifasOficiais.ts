import { removerAcentos } from '@/lib/utils'
import { REGRA_DETRO_2026, REGRAS_OFICIAIS_VT } from '@/lib/vt/regrasOficiais'
import type { RegraOficialVT } from '@/lib/vt/contratosTarifarios'

export function tarifaLinhaDetro(
  linha: string | null,
  regras: readonly RegraOficialVT[] = REGRAS_OFICIAIS_VT,
): number | null {
  const codigo = removerAcentos((linha ?? '').trim()).toUpperCase().replace(/\s+/g, '')
  const regra = regras.find((item) => item.id === REGRA_DETRO_2026)
  const valor = regra?.parametros[codigo]
  return typeof valor === 'number' ? valor : null
}
