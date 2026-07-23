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

/** Extrai as linhas da planilha (json do sheet_to_json) no formato de férias. */
export function parsePlanilhaFerias(jsonData: Record<string, unknown>[]): LinhaPlanilhaFerias[] {
  if (jsonData.length === 0) return []

  const todasAsChaves = Array.from(new Set(jsonData.flatMap((row) => Object.keys(row))))
  const colNome = detectarColuna(todasAsChaves, ['colaborador', 'nome', 'nome do colaborador', 'funcionario'])
  const colDepartamento = detectarColuna(todasAsChaves, ['departamento'])
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
        ultimoPeriodoTexto: colUltimoPeriodo ? getString(row, colUltimoPeriodo).trim() : '',
        ultimaDescricao: colUltimaDescricao ? getString(row, colUltimaDescricao).trim() || null : null,
        proximoPeriodoTexto: colProximoPeriodo ? getString(row, colProximoPeriodo).trim() : '',
        proximaDescricao: colProximaDescricao ? getString(row, colProximaDescricao).trim() || null : null,
      }
    })
    .filter((l): l is LinhaPlanilhaFerias => l !== null)
}

/**
 * Casa as linhas da planilha com os colaboradores cadastrados por nome
 * normalizado. Em duplicidade de nome, prefere o colaborador Ativo; se ainda
 * houver mais de um, a linha vai para a lista de ambíguos e não é importada.
 */
export function casarColaboradores(
  linhas: LinhaPlanilhaFerias[],
  colaboradores: Colaborador[]
): ResultadoCasamentoFerias {
  const porNome = new Map<string, Colaborador[]>()
  for (const colaborador of colaboradores) {
    const chave = normalizarTexto(colaborador.nome_completo)
    if (!chave) continue
    const lista = porNome.get(chave) ?? []
    lista.push(colaborador)
    porNome.set(chave, lista)
  }

  const periodos: NovoPeriodoFerias[] = []
  const naoEncontrados: string[] = []
  const ambiguos: string[] = []
  const periodosInvalidos: string[] = []
  let encontrados = 0

  for (const linha of linhas) {
    const candidatos = porNome.get(normalizarTexto(linha.nome)) ?? []
    let colaborador: Colaborador | undefined
    if (candidatos.length === 1) {
      colaborador = candidatos[0]
    } else if (candidatos.length > 1) {
      const ativos = candidatos.filter((c) => c.status === 'Ativo')
      if (ativos.length === 1) colaborador = ativos[0]
    }

    if (!colaborador) {
      if (candidatos.length > 1) {
        ambiguos.push(linha.nome)
      } else {
        naoEncontrados.push(linha.nome)
      }
      continue
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
