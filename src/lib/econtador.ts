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

// ------------------------------------------------------------
// Mapeamento de departamentos na importação
// ------------------------------------------------------------

import { encontrarDepartamentoFuzzy, type DepartamentoFuzzy } from './departamentos'

export interface ResultadoMapeamentoDepartamentos {
  /** nome do e-Contador em lower-case → id do departamento existente */
  mapa: Map<string, string>
  /** nomes sem correspondência ativa — NUNCA criados automaticamente */
  naoResolvidos: string[]
}

/**
 * Decisão da gestão (09/10/2026): a importação NUNCA cria departamento.
 * O sync automático criava linha nova (Ativa, sem nome_curto) para qualquer
 * texto sem match — inclusive de contratos encerrados que a Alterdata manda
 * todo dia junto com os demitidos, re-sujando o cadastro a cada importação.
 * Sem match entre os ATIVOS, o nome vai para `naoResolvidos` (o colaborador
 * fica só com o texto legado, departamento_id null) e o histórico avisa;
 * o departamento novo é cadastrado manualmente com nome_curto e a próxima
 * importação passa a casar. Espelhado em Deno no sync-econtador.
 */
export function mapearDepartamentosImportacao(
  nomes: string[],
  existentes: DepartamentoFuzzy[],
  empresaId: string | null
): ResultadoMapeamentoDepartamentos {
  const mapa = new Map<string, string>()
  const naoResolvidos: string[] = []
  for (const nome of nomes) {
    const existente = encontrarDepartamentoFuzzy(existentes, null, nome, empresaId)
    if (existente) mapa.set(nome.toLowerCase(), existente.id)
    else naoResolvidos.push(nome)
  }
  return { mapa, naoResolvidos }
}

/** Mensagem registrada no histórico da importação para cada nome não resolvido. */
export function mensagemDepartamentoNaoResolvido(nome: string): string {
  return `Departamento sem correspondência ativa: "${nome}" — não criado automaticamente; cadastre na tela Departamentos (com nome curto) e reimporte`
}
