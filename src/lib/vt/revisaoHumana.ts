/**
 * Rotas que o sistema NUNCA confirma sozinho (auditoria de 21/11/2026): o preço pode estar
 * certo, mas a rota tem cara de não ser a que a pessoa faz. O RH confere com o colaborador
 * e confirma na tela — aqui é só aviso, não bloqueia a confirmação humana.
 */

export interface PernaParaRevisao {
  linha?: string | null
}

function normalizar(linha: string | null | undefined): string {
  return (linha ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

function normalizarCidade(cidade: string | null | undefined): string {
  return (cidade ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
}

/** Linha DETRO que vai para a cidade do Rio (código de 3–4 dígitos terminado em D: 709D, 7721D). */
export function ehLinhaParaORio(linha: string | null | undefined): boolean {
  return /^\d{3,4}D$/.test(normalizar(linha))
}

const noRio = (cidade: string | null | undefined) => normalizarCidade(cidade) === 'RIO DE JANEIRO'
const semCidade = (cidade: string | null | undefined) => {
  const c = normalizarCidade(cidade)
  return c === '' || c === 'DESCONHECIDA' || c === 'DESCONHECIDO'
}

/**
 * Regra da gestora (24/11/2026): "não vamos marcar para ninguém pegar a linha D se é o caso de
 * ainda ficar em Niterói". Linha D (vai para a cidade do Rio) só é legítima quando a casa OU o
 * posto fica no Rio.
 *  - 'liberada': casa ou posto no Rio de Janeiro.
 *  - 'proibida': as DUAS cidades são conhecidas e nenhuma é o Rio (a viagem fica do lado de cá da baía).
 *  - 'conferir': falta a cidade de um dos lados — nunca bloqueia por palpite, fica como aviso.
 */
export type SituacaoLinhaD = 'liberada' | 'proibida' | 'conferir'

export function situacaoLinhaD(cidadeCasa: string | null | undefined, cidadePosto: string | null | undefined): SituacaoLinhaD {
  if (noRio(cidadeCasa) || noRio(cidadePosto)) return 'liberada'
  if (semCidade(cidadeCasa) || semCidade(cidadePosto)) return 'conferir'
  return 'proibida'
}

/** Linhas D (sem repetição) presentes nas conduções. */
export function linhasDDasPernas(...sentidos: ReadonlyArray<readonly PernaParaRevisao[]>): string[] {
  return [...new Set(sentidos.flat().map((p) => normalizar(p.linha)).filter(ehLinhaParaORio))]
}

/**
 * Linhas D que NÃO podem ser escolhidas/confirmadas (vazio = nada proibido). Vale para ida e volta
 * (a volta pré-marcada igual à ida segue a mesma regra, pois usa as mesmas linhas).
 */
export function linhasDProibidas(
  cidadeCasa: string | null | undefined,
  cidadePosto: string | null | undefined,
  ...sentidos: ReadonlyArray<readonly PernaParaRevisao[]>
): string[] {
  return situacaoLinhaD(cidadeCasa, cidadePosto) === 'proibida' ? linhasDDasPernas(...sentidos) : []
}

export const TEXTO_LINHA_D_PROIBIDA = 'Linha para o Rio — não usar para trajeto que fica em Niterói/São Gonçalo/região'

export function motivosRevisaoHumana(
  ida: readonly PernaParaRevisao[],
  volta: readonly PernaParaRevisao[],
  cidadeCasa: string | null | undefined,
  cidadePosto: string | null | undefined,
): string[] {
  const motivos: string[] = []
  const sentidos: Array<[string, readonly PernaParaRevisao[]]> = [['ida', ida], ['volta', volta]]

  for (const [nome, pernas] of sentidos) {
    if (pernas.length >= 3) motivos.push(`${pernas.length} conduções na ${nome}`)
    for (let i = 0; i + 1 < pernas.length; i++) {
      const linha = normalizar(pernas[i].linha)
      if (linha && linha === normalizar(pernas[i + 1].linha)) {
        motivos.push(`a mesma linha ${linha} aparece duas vezes seguidas na ${nome}`)
        break
      }
    }
  }

  if (situacaoLinhaD(cidadeCasa, cidadePosto) !== 'liberada') {
    const paraORio = linhasDDasPernas(ida, volta)
    if (paraORio.length) {
      const incerta = situacaoLinhaD(cidadeCasa, cidadePosto) === 'conferir'
      motivos.push(
        `linha para o Rio (${paraORio.join(', ')}) usada como trecho local`
        + (incerta ? ' — a cidade da casa ou do posto não está informada: confira se o trajeto fica fora do Rio' : ''),
      )
    }
  }
  return motivos
}
