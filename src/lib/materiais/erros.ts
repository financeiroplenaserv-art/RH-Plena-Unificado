// Detecta o caso "estrutura do banco ainda não aplicada" (migrations 121–123
// versionadas mas não rodadas): as telas mostram um aviso claro em vez de
// quebrar ou soltar a mensagem técnica do PostgREST.

export interface ErroBanco {
  code?: string | null
  message?: string | null
}

const CODIGOS_TABELA = new Set([
  '42P01', // relation does not exist (Postgres)
  'PGRST205', // tabela/view fora do schema cache (PostgREST)
  'PGRST202', // função (RPC) não encontrada no schema cache
  '42883', // undefined_function
])

const CODIGOS_COLUNA = new Set([
  '42703', // undefined_column (Postgres)
  'PGRST204', // coluna fora do schema cache (PostgREST)
])

/**
 * true quando o erro indica tabela/view/RPC inexistente. Com
 * `incluirColunas`, também coluna inexistente (ex.: `fornecedores.ativo`,
 * criada pela migration 121 numa tabela que já existe).
 */
export function estruturaAusente(erro: ErroBanco | null | undefined, incluirColunas = false): boolean {
  if (!erro) return false
  const code = erro.code ?? ''
  if (CODIGOS_TABELA.has(code)) return true
  if (incluirColunas && CODIGOS_COLUNA.has(code)) return true
  const msg = (erro.message ?? '').toLowerCase()
  if (/relation .* does not exist/.test(msg)) return true
  if (msg.includes('could not find the table') || msg.includes('could not find the function')) return true
  if (incluirColunas && (/column .* does not exist/.test(msg) || msg.includes('could not find the'))) return true
  return false
}

export const MENSAGEM_ESTRUTURA_PENDENTE = 'Módulo em preparação — estrutura do banco ainda não aplicada'

/** Mensagem legível para o toast a partir de um erro do PostgREST. */
export function mensagemErroMateriais(erro: ErroBanco | null | undefined, acao: string): string {
  if (!erro) return `Erro ao ${acao}`
  if (estruturaAusente(erro, true)) return `${MENSAGEM_ESTRUTURA_PENDENTE}.`
  if (erro.code === '23505') return `Não foi possível ${acao}: já existe um registro com esses dados.`
  if (erro.code === '42501') return `Sem permissão para ${acao}.`
  return `Erro ao ${acao}: ${erro.message ?? 'erro desconhecido'}`
}
