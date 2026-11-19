import type { ItinerarioVT } from '@/lib/vt/contratosTarifarios'

/** Linhas orçadas de um itinerário salvo, para mostrar na aba Trajetos. */
export interface LinhasOrcadasVT {
  /** Linhas da ida na ordem das conduções ("62", "39A"; sem número, o modal). */
  ida: string[]
  /** Linhas da volta; vazio quando a evidência não registra a volta. */
  volta: string[]
  /** "Ida: 62 → 39A · Volta: 39A → 62", "Ida e volta: 404M" ou "Ida: 422M · Volta: não registrada". */
  texto: string
  /** Valor do dia calculado pelo motor e gravado na evidência (null em evidência antiga). */
  valorDiaCentavos: number | null
}

function nomeDaPerna(perna: ItinerarioVT['pernas'][number]): string {
  const linha = perna.linha?.trim()
  return linha ? linha.toUpperCase() : perna.modal
}

export function linhasOrcadasDoItinerario(itinerario: ItinerarioVT): LinhasOrcadasVT | null {
  const pernas = [...itinerario.pernas].sort((a, b) => a.sequencia - b.sequencia)
  const ida = pernas.filter((p) => p.sentido === 'ida').map(nomeDaPerna)
  const volta = pernas.filter((p) => p.sentido === 'volta').map(nomeDaPerna)
  if (ida.length === 0 && volta.length === 0) return null

  const juntar = (linhas: string[]) => linhas.join(' → ')
  let texto: string
  if (ida.length > 0 && volta.length > 0 && juntar(ida) === juntar(volta)) {
    texto = `Ida e volta: ${juntar(ida)}`
  } else {
    const parteIda = ida.length > 0 ? juntar(ida) : 'não registrada'
    const parteVolta = volta.length > 0 ? juntar(volta) : 'não registrada'
    texto = `Ida: ${parteIda} · Volta: ${parteVolta}`
  }
  return { ida, volta, texto, valorDiaCentavos: itinerario.calculoMotor?.valorDiaCentavos ?? null }
}
