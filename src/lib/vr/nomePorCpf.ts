// ============================================================
// Resolução do NOME DE EXIBIÇÃO pelo CPF no cadastro de colaboradores.
//
// Contexto: o espelho de ponto do Flit pode trazer o nome errado atrelado
// a um CPF (homônimos — ex.: o CPF de MARCO ANTONIO DO VALLE TALAVEIRA
// aparecia no ponto com o nome de MARCO ANTONIO FARIA PEDROSA). Como o VR
// é processado pelo CPF, o pagamento sai correto, mas os relatórios
// exibiam o nome trocado.
//
// ATENÇÃO: este módulo é APENAS de apresentação (tabela da tela,
// comprovantes, recibos e planilha de conferência). Ele NÃO altera
// cálculo, matching, nem os arquivos de pedido (PAT/Alterdata).
// ============================================================

/**
 * Normaliza um CPF para a chave de 11 dígitos.
 * O cadastro pode estar sem o zero à esquerda (ex.: '6028056782'),
 * enquanto o PDF do ponto traz os 11 dígitos ('06028056782').
 */
export function chaveCpf(cpf?: string | null): string | null {
  const digitos = (cpf || '').replace(/\D/g, '')
  if (digitos.length < 10 || digitos.length > 11) return null
  return digitos.padStart(11, '0')
}

/** Monta o mapa CPF (11 dígitos) → nome completo a partir do cadastro. */
export function montarMapaNomesPorCpf(
  colaboradores: { cpf: string | null; nome_completo: string }[]
): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const c of colaboradores) {
    const chave = chaveCpf(c.cpf)
    if (chave && c.nome_completo?.trim()) {
      mapa.set(chave, c.nome_completo.trim())
    }
  }
  return mapa
}

/**
 * Nome para exibição: o do cadastro quando o CPF consta lá;
 * caso contrário, mantém o nome original da fonte (PDF/escala).
 */
export function nomeExibicaoVR(
  nome: string,
  cpf: string | null | undefined,
  nomesPorCpf?: Map<string, string>
): string {
  if (!nomesPorCpf) return nome
  const chave = chaveCpf(cpf)
  const nomeCadastro = chave ? nomesPorCpf.get(chave) : undefined
  return nomeCadastro || nome
}
