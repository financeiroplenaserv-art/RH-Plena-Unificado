// Regras puras da importação e-Contador (sem chamadas de rede/banco).

export interface FuncionarioImportacao {
  demissao?: string | null
  status?: string | null
}

/**
 * Decisão da gestão (12/08/2026): quando o e-Contador devolve um funcionário
 * INATIVO/demitido que não casa com nenhum registro do CORH (nem por CPF nem
 * por matrícula) e o INSERT falha por matrícula duplicada, é um registro
 * histórico antigo cuja matrícula foi reutilizada por outro colaborador —
 * a importação ignora em silêncio em vez de contar como erro.
 * Conflito de matrícula em quem está ATIVO continua sendo erro, pois indica
 * problema real de cadastro.
 */
export function deveIgnorarErroImportacao(err: unknown, funcionario: FuncionarioImportacao): boolean {
  const inativo = Boolean(funcionario.demissao) || funcionario.status === 'Inativo'
  if (!inativo || !err || typeof err !== 'object') return false
  const { code, message } = err as { code?: unknown; message?: unknown }
  return code === '23505' && typeof message === 'string' && message.includes('matricula')
}

/**
 * Extrai uma mensagem legível de qualquer formato de erro: Error comum,
 * PostgrestError (objeto simples com code/message — não é instanceof Error),
 * string solta ou string contendo JSON serializado (formato legado gravado em
 * `historico_importacoes_econtador.detalhes_erros` antes de 12/08/2026).
 */
export function extrairMensagemErro(err: unknown): string {
  if (!err) return 'Erro desconhecido'
  if (err instanceof Error) return err.message
  if (typeof err === 'string') {
    const texto = err.trim()
    if (texto.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(texto)
        if (parsed && typeof parsed === 'object') {
          const { message } = parsed as { message?: unknown }
          if (typeof message === 'string' && message) return message
        }
      } catch {
        // não é JSON válido — devolve o texto como está
      }
    }
    return texto || 'Erro desconhecido'
  }
  if (typeof err === 'object') {
    const { message, code } = err as { message?: unknown; code?: unknown }
    if (typeof message === 'string' && message) {
      return typeof code === 'string' && code ? `[${code}] ${message}` : message
    }
    try {
      return JSON.stringify(err).slice(0, 500)
    } catch {
      return 'Erro não serializável'
    }
  }
  return String(err)
}
