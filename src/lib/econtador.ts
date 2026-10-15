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

import {
  encontrarDepartamentoFuzzy,
  redirecionarDepartamentoInativo,
  type DepartamentoFuzzy,
} from './departamentos'

export interface ResultadoMapeamentoDepartamentos {
  /** chaveDepartamento(nome) → id do departamento existente */
  mapa: Map<string, string>
  /** nomes sem correspondência ativa — NUNCA criados automaticamente */
  naoResolvidos: string[]
}

/**
 * Chave canônica do mapa de departamentos da importação: trim + lower-case.
 * DEVE ser usada na gravação E na consulta — a Alterdata manda o nome com
 * espaço no fim ("CONDOMINIO ... RESIDENCIAL ") e a consulta sem trim não
 * achava a chave (gravada aparada), zerando o departamento_id no upsert
 * (bug encontrado em 15/10/2026: 244 colaboradores sem vínculo).
 */
export function chaveDepartamento(nome: string): string {
  return nome.trim().toLowerCase()
}

/**
 * Decisão da gestão (09/10/2026): a importação NUNCA cria departamento.
 * O sync automático criava linha nova (Ativa, sem nome_curto) para qualquer
 * texto sem match — inclusive de contratos encerrados que a Alterdata manda
 * todo dia junto com os demitidos, re-sujando o cadastro a cada importação.
 * Sem match, o nome vai para `naoResolvidos` e o histórico avisa; o
 * departamento novo é cadastrado manualmente com nome_curto e a próxima
 * importação passa a casar. Espelhado em Deno no sync-econtador.
 *
 * 15/10/2026: `existentes` passa a receber TODAS as linhas (qualquer status)
 * — o texto do contrato encerrado precisa casar com a linha INATIVA para o
 * redirect explícito/irmã ativa decidir o destino (ver
 * redirecionarDepartamentoInativo, ex.: DALIAS → ITAGUAÍ). Linha inativa sem
 * destino vai para `naoResolvidos` como antes.
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
    const destino = existente ? redirecionarDepartamentoInativo(existentes, existente) : null
    if (destino && destino.status !== 'Inativo') mapa.set(chaveDepartamento(nome), destino.id)
    else naoResolvidos.push(nome)
  }
  return { mapa, naoResolvidos }
}

/** Mensagem registrada no histórico da importação para cada nome não resolvido. */
export function mensagemDepartamentoNaoResolvido(nome: string): string {
  return `Departamento sem correspondência ativa: "${nome}" — não criado automaticamente; cadastre na tela Departamentos (com nome curto) e reimporte`
}

// ------------------------------------------------------------
// Deduplicação da lista da Alterdata
// ------------------------------------------------------------

export interface FuncionarioDedup {
  cpf?: string | null
  codigo?: string | null
  id?: string | null
  demissao?: string | null
  admissao?: string | null
  nome?: string | null
}

export interface DuplicadoImportacao<T> {
  descartado: T
  mantido: T
}

/**
 * O candidato vence o atual quando é o contrato vigente (sem demissão)
 * contra um demitido; em empate de situação, vence a admissão mais recente
 * (datas ISO comparam como texto); persistindo o empate, fica o primeiro da
 * lista (ordem da API).
 */
function contratoVigenteVence(candidato: FuncionarioDedup, atual: FuncionarioDedup): boolean {
  const candidatoVigente = !candidato.demissao
  const atualVigente = !atual.demissao
  if (candidatoVigente !== atualVigente) return candidatoVigente
  return (candidato.admissao || '') > (atual.admissao || '')
}

/**
 * A Alterdata devolve a MESMA PESSOA duas vezes quando há contrato antigo de
 * demitido além do atual — os dois registros casam com o mesmo colaborador do
 * CORH (CPF/matrícula) e cada um gerava um UPDATE por execução: o do contrato
 * antigo derrubava o status para Inativo por alguns segundos (e, se viesse
 * por último, deixaria Inativo em definitivo). Regra (15/10/2026): vale um
 * registro por pessoa (CPF, senão código/matrícula, senão id) — o do contrato
 * vigente. Espelhado em Deno no sync-econtador.
 */
export function deduplicarFuncionariosImportacao<T extends FuncionarioDedup>(
  lista: T[]
): { unicos: T[]; duplicados: DuplicadoImportacao<T>[] } {
  const porChave = new Map<string, number>()
  const unicos: T[] = []
  const duplicados: DuplicadoImportacao<T>[] = []
  for (const f of lista) {
    const chave = f.cpf?.trim() || f.codigo?.trim() || f.id?.trim() || ''
    if (!chave) {
      unicos.push(f)
      continue
    }
    const indice = porChave.get(chave)
    if (indice === undefined) {
      porChave.set(chave, unicos.length)
      unicos.push(f)
      continue
    }
    const atual = unicos[indice]
    const mantido = contratoVigenteVence(f, atual) ? f : atual
    unicos[indice] = mantido
    duplicados.push({ descartado: mantido === f ? atual : f, mantido })
  }
  return { unicos, duplicados }
}
