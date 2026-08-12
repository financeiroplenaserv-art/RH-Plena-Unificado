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
