import type { Colaborador } from '@/types/database'
import { normalizarTexto } from '../escalas/normalizarTexto'

// ============================================================
// Parser da planilha de férias exportada do Flit
// ------------------------------------------------------------
// Formato esperado (aba única, uma linha por colaborador):
// Colaborador | Empresa | Departamento | Cargo | Admissão | Tempo de casa
// Último período | Últ. descrição | Próximo período | Próx. descrição
// Períodos no formato "DD/MM/YYYY - DD/MM/YYYY".
// ============================================================

export interface LinhaPlanilhaFerias {
  nome: string
  departamento: string
  /** CPF da planilha (texto cru), quando a coluna existe — match prioritário */
  cpf: string | null
  /** Matrícula da planilha (texto cru), quando a coluna existe — match prioritário */
  matricula: string | null
  ultimoPeriodoTexto: string
  ultimaDescricao: string | null
  proximoPeriodoTexto: string
  proximaDescricao: string | null
}

export interface NovoPeriodoFerias {
  colaborador_id: string
  data_inicio: string // YYYY-MM-DD
  data_fim: string // YYYY-MM-DD
  tipo: 'gozo' | 'agendado'
  descricao: string | null
  origem: 'flit'
}

export interface ResultadoCasamentoFerias {
  periodos: NovoPeriodoFerias[]
  colaboradoresEncontrados: number
  naoEncontrados: string[]
  ambiguos: string[]
  /** Nomes com texto de período preenchido que não pôde ser interpretado */
  periodosInvalidos: string[]
}

async function getXLSX() {
  return import('@e965/xlsx')
}

function getString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null) return String(value)
  }
  return ''
}

function detectarColuna(todasAsChaves: string[], alternativas: string[]): string | undefined {
  for (const alternativa of alternativas) {
    const normalizada = normalizarTexto(alternativa)
    const key = todasAsChaves.find((k) => normalizarTexto(k) === normalizada)
    if (key) return key
  }
  return undefined
}

/** Converte "DD/MM/YYYY" para "YYYY-MM-DD". Retorna null se inválido. */
function converterDataBrasileira(dataStr: string): string | null {
  const partes = dataStr.trim().split('/')
  if (partes.length !== 3) return null
  const dia = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10)
  const ano = parseInt(partes[2], 10)
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Interpreta um período no formato "DD/MM/YYYY - DD/MM/YYYY"
 * (tolera espaços e travessão/hífen). Retorna null se não for possível.
 */
export function parsePeriodo(texto: string | null | undefined): { inicio: string; fim: string } | null {
  if (!texto) return null
  const partes = String(texto).split(/\s*[-–—]\s*/)
  if (partes.length !== 2) return null
  const inicio = converterDataBrasileira(partes[0])
  const fim = converterDataBrasileira(partes[1])
  if (!inicio || !fim || fim < inicio) return null
  return { inicio, fim }
}

/** CPF só dígitos com zero à esquerda (mesma regra dos recibos CEU). */
export function normalizarCpfFerias(cpf: string | null | undefined): string {
  const digitos = (cpf ?? '').replace(/\D/g, '')
  return digitos ? digitos.padStart(11, '0') : ''
}

/** Matrícula sem espaços e sem zeros à esquerda ('000016' e '16' casam). */
export function normalizarMatriculaFerias(matricula: string | null | undefined): string {
  const texto = (matricula ?? '').trim()
  if (!texto) return ''
  const semZeros = texto.replace(/^0+/, '')
  return semZeros || '0'
}

/** Extrai as linhas da planilha (json do sheet_to_json) no formato de férias. */
export function parsePlanilhaFerias(jsonData: Record<string, unknown>[]): LinhaPlanilhaFerias[] {
  if (jsonData.length === 0) return []

  const todasAsChaves = Array.from(new Set(jsonData.flatMap((row) => Object.keys(row))))
  const colNome = detectarColuna(todasAsChaves, ['colaborador', 'nome', 'nome do colaborador', 'funcionario'])
  const colDepartamento = detectarColuna(todasAsChaves, ['departamento'])
  const colCpf = detectarColuna(todasAsChaves, ['cpf'])
  const colMatricula = detectarColuna(todasAsChaves, ['matricula', 'matrícula', 'codigo', 'código'])
  const colUltimoPeriodo = detectarColuna(todasAsChaves, ['último período', 'ultimo periodo'])
  const colUltimaDescricao = detectarColuna(todasAsChaves, ['últ. descrição', 'ult. descricao', 'última descrição'])
  const colProximoPeriodo = detectarColuna(todasAsChaves, ['próximo período', 'proximo periodo'])
  const colProximaDescricao = detectarColuna(todasAsChaves, ['próx. descrição', 'prox. descricao', 'próxima descrição'])

  if (!colNome) {
    throw new Error(`Coluna de colaborador não encontrada no Excel. Colunas detectadas: ${todasAsChaves.join(', ')}`)
  }

  return jsonData
    .map((row): LinhaPlanilhaFerias | null => {
      const nome = getString(row, colNome).trim()
      if (!nome) return null
      return {
        nome,
        departamento: colDepartamento ? getString(row, colDepartamento).trim() : '',
        cpf: colCpf ? getString(row, colCpf).trim() || null : null,
        matricula: colMatricula ? getString(row, colMatricula).trim() || null : null,
        ultimoPeriodoTexto: colUltimoPeriodo ? getString(row, colUltimoPeriodo).trim() : '',
        ultimaDescricao: colUltimaDescricao ? getString(row, colUltimaDescricao).trim() || null : null,
        proximoPeriodoTexto: colProximoPeriodo ? getString(row, colProximoPeriodo).trim() : '',
        proximaDescricao: colProximaDescricao ? getString(row, colProximaDescricao).trim() || null : null,
      }
    })
    .filter((l): l is LinhaPlanilhaFerias => l !== null)
}

/**
 * Casa as linhas da planilha com os colaboradores cadastrados. Prioridade:
 * CPF → matrícula → nome normalizado. Em duplicidade de chave, prefere o
 * colaborador Ativo; se ainda houver mais de um, a linha vai para a lista de
 * ambíguos e não é importada.
 */
export function casarColaboradores(
  linhas: LinhaPlanilhaFerias[],
  colaboradores: Colaborador[]
): ResultadoCasamentoFerias {
  const porNome = new Map<string, Colaborador[]>()
  const porCpf = new Map<string, Colaborador[]>()
  const porMatricula = new Map<string, Colaborador[]>()
  const indexar = (mapa: Map<string, Colaborador[]>, chave: string, colaborador: Colaborador) => {
    if (!chave) return
    const lista = mapa.get(chave) ?? []
    lista.push(colaborador)
    mapa.set(chave, lista)
  }
  for (const colaborador of colaboradores) {
    indexar(porNome, normalizarTexto(colaborador.nome_completo), colaborador)
    indexar(porCpf, normalizarCpfFerias(colaborador.cpf), colaborador)
    indexar(porMatricula, normalizarMatriculaFerias(colaborador.matricula), colaborador)
  }

  /** Resolve a lista de candidatos: único, ou único Ativo em duplicidade. */
  const escolher = (candidatos: Colaborador[] | undefined): Colaborador | undefined => {
    if (!candidatos || candidatos.length === 0) return undefined
    if (candidatos.length === 1) return candidatos[0]
    const ativos = candidatos.filter((c) => c.status === 'Ativo')
    if (ativos.length === 1) return ativos[0]
    return undefined
  }

  const periodos: NovoPeriodoFerias[] = []
  const naoEncontrados: string[] = []
  const ambiguos: string[] = []
  const periodosInvalidos: string[] = []
  let encontrados = 0

  for (const linha of linhas) {
    // Prioridade: CPF → matrícula → nome
    let colaborador =
      escolher(porCpf.get(normalizarCpfFerias(linha.cpf))) ??
      escolher(porMatricula.get(normalizarMatriculaFerias(linha.matricula)))

    if (!colaborador) {
      const candidatosNome = porNome.get(normalizarTexto(linha.nome)) ?? []
      colaborador = escolher(candidatosNome)
      if (!colaborador) {
        if (candidatosNome.length > 1) {
          ambiguos.push(linha.nome)
        } else {
          naoEncontrados.push(linha.nome)
        }
        continue
      }
    }

    encontrados += 1

    const ultimoPeriodo = parsePeriodo(linha.ultimoPeriodoTexto)
    const proximoPeriodo = parsePeriodo(linha.proximoPeriodoTexto)
    let algumInvalido = false

    if (ultimoPeriodo) {
      periodos.push({
        colaborador_id: colaborador.id,
        data_inicio: ultimoPeriodo.inicio,
        data_fim: ultimoPeriodo.fim,
        tipo: 'gozo',
        descricao: linha.ultimaDescricao,
        origem: 'flit',
      })
    } else if (linha.ultimoPeriodoTexto) {
      algumInvalido = true
    }

    if (proximoPeriodo) {
      periodos.push({
        colaborador_id: colaborador.id,
        data_inicio: proximoPeriodo.inicio,
        data_fim: proximoPeriodo.fim,
        tipo: 'agendado',
        descricao: linha.proximaDescricao,
        origem: 'flit',
      })
    } else if (linha.proximoPeriodoTexto) {
      algumInvalido = true
    }

    if (algumInvalido) periodosInvalidos.push(linha.nome)
  }

  return {
    periodos,
    colaboradoresEncontrados: encontrados,
    naoEncontrados,
    ambiguos,
    periodosInvalidos,
  }
}

export async function parseExcelFerias(file: File): Promise<LinhaPlanilhaFerias[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          throw new Error('Não foi possível ler o conteúdo do arquivo')
        }
        const XLSX = await getXLSX()
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames.includes('data') ? 'data' : workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: false })
        resolve(parsePlanilhaFerias(jsonData))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.onabort = () => reject(new Error('Leitura do arquivo abortada'))
    reader.readAsArrayBuffer(file)
  })
}
