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

  const rioNaPonta = [cidadeCasa, cidadePosto].some((c) => normalizarCidade(c) === 'RIO DE JANEIRO')
  if (!rioNaPonta) {
    const paraORio = [...new Set([...ida, ...volta].map((p) => normalizar(p.linha)).filter(ehLinhaParaORio))]
    if (paraORio.length) {
      motivos.push(`linha para o Rio (${paraORio.join(', ')}) usada como trecho local`)
    }
  }
  return motivos
}
