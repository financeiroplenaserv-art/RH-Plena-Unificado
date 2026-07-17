import type { Colaborador } from '@/types/database'
import { normalizarTexto, normalizarMatricula } from './normalizarTexto'

export interface BatidaFlit {
  nomeColaborador: string
  matricula: string
  dataHora: Date
  data: string // YYYY-MM-DD
  hora: string // HH:MM
  tipoDispositivo: string
  nomeDispositivo: string
  perimetro: string
  departamento: string
  turno: string
}

export interface DiaFlit {
  nomeColaborador: string
  matricula: string
  data: string
  tipoDispositivo: string
  nomeDispositivo: string
  perimetro: string
  departamento: string
  turno: string
  batidas: Array<{ hora: string }>
  // Quando o arquivo for uma exportação do CORH, guarda o nome do local já resolvido.
  localTrabalhoNome?: string
}

export type FormatoEscalasExcel = 'flit' | 'exportacao_corh' | 'desconhecido'

export interface ResultadoImportacaoFlit {
  dias: DiaFlit[]
  totalLinhas: number
  colaboradoresNaoEncontrados: string[]
  formato: FormatoEscalasExcel
}

async function getXLSX() {
  return import('@e965/xlsx')
}

// Converte número serial do Excel para data local
function excelSerialParaData(serial: number): Date {
  // O Excel conta dias a partir de 30/12/1899 (com o bug do ano bissexto de 1900)
  const dataBase = new Date(Date.UTC(1899, 11, 30))
  const msPorDia = 24 * 60 * 60 * 1000
  const dataUtc = new Date(dataBase.getTime() + serial * msPorDia)
  // Converte para local
  return new Date(dataUtc.getUTCFullYear(), dataUtc.getUTCMonth(), dataUtc.getUTCDate())
}

function converterDataBrasileira(dataStr: string): Date | null {
  const partes = String(dataStr).trim().split('/')
  if (partes.length !== 3) return null
  const dia = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10) - 1
  const ano = parseInt(partes[2], 10)
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null
  return new Date(ano, mes, dia)
}

function extrairHora(horaValor: unknown): string {
  if (horaValor === undefined || horaValor === null) return '00:00'

  // Se for número (fração do dia no Excel)
  if (typeof horaValor === 'number') {
    if (horaValor >= 0 && horaValor < 1) {
      const totalMinutos = Math.round(horaValor * 24 * 60)
      const h = Math.floor(totalMinutos / 60)
      const m = totalMinutos % 60
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }

  const horaStr = String(horaValor).trim()
  if (!horaStr) return '00:00'

  // Se já estiver no formato HH:MM ou HH:MM:SS
  const match = horaStr.match(/^(\d{1,2}):(\d{2})/)
  if (match) {
    return `${String(parseInt(match[1], 10)).padStart(2, '0')}:${match[2]}`
  }

  return '00:00'
}

function extrairDataHora(dataValor: unknown, horaValor: unknown): { data: string; hora: string; dataHora: Date } | null {
  let dataConvertida: Date | null

  if (dataValor instanceof Date) {
    dataConvertida = new Date(dataValor.getFullYear(), dataValor.getMonth(), dataValor.getDate())
  } else if (typeof dataValor === 'number') {
    // Número serial do Excel
    dataConvertida = excelSerialParaData(dataValor)
  } else {
    const dataStr = String(dataValor).trim()
    // Tenta DD/MM/YYYY primeiro
    dataConvertida = converterDataBrasileira(dataStr)
    if (!dataConvertida) {
      // Tenta YYYY-MM-DD
      const date = new Date(dataStr)
      if (!isNaN(date.getTime())) {
        dataConvertida = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      }
    }
  }

  if (!dataConvertida || isNaN(dataConvertida.getTime())) return null

  const dataStr = `${dataConvertida.getFullYear()}-${String(dataConvertida.getMonth() + 1).padStart(2, '0')}-${String(dataConvertida.getDate()).padStart(2, '0')}`
  const horaStr = extrairHora(horaValor)

  const [h, m] = horaStr.split(':').map(Number)
  const dataHoraCompleta = new Date(dataConvertida.getFullYear(), dataConvertida.getMonth(), dataConvertida.getDate(), h || 0, m || 0)

  return { data: dataStr, hora: horaStr, dataHora: dataHoraCompleta }
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

function coletarTodasAsChaves(jsonData: Record<string, unknown>[]): string[] {
  const chaves = new Set<string>()
  for (const row of jsonData) {
    for (const key of Object.keys(row)) {
      chaves.add(key)
    }
  }
  return Array.from(chaves)
}

function detectarFormato(todasAsChaves: string[]): FormatoEscalasExcel {
  const chavesNormalizadas = todasAsChaves.map((k) => normalizarTexto(k))
  const temNome = chavesNormalizadas.some((k) => ['colaborador', 'nome', 'nome do colaborador', 'funcionario'].includes(k))
  const temData = chavesNormalizadas.some((k) => ['data', 'data da batida', 'dia'].includes(k))
  const temHora = chavesNormalizadas.some((k) => ['hora', 'horario', 'horário'].includes(k))
  const temLocalExportacao = chavesNormalizadas.includes('local de trabalho')
  const temFonteExportacao = chavesNormalizadas.includes('fonte')

  if (temLocalExportacao && temFonteExportacao && temNome && temData) {
    return 'exportacao_corh'
  }
  if (temNome && temData && temHora) {
    return 'flit'
  }
  return 'desconhecido'
}

function extrairNomeMatricula(colaboradorValor: unknown): { nome: string; matricula: string } {
  const texto = String(colaboradorValor || '').trim()
  // Formato esperado: "NOME COMPLETO (000123)"
  const match = texto.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (match) {
    return { nome: match[1].trim(), matricula: match[2].trim() }
  }
  return { nome: texto, matricula: '' }
}

function parseDataExportacaoCorh(dataValor: unknown): string | null {
  const dataStr = String(dataValor).trim()
  // DD/MM/YYYY
  const partes = dataStr.split('/')
  if (partes.length === 3) {
    const dia = parseInt(partes[0], 10)
    const mes = parseInt(partes[1], 10) - 1
    const ano = parseInt(partes[2], 10)
    if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
      const data = new Date(ano, mes, dia)
      if (!isNaN(data.getTime())) {
        return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
      }
    }
  }
  // Tenta outros formatos
  const data = new Date(dataStr)
  if (!isNaN(data.getTime())) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  }
  return null
}

function parseExportacaoCorh(jsonData: Record<string, unknown>[]): DiaFlit[] {
  if (jsonData.length === 0) return []

  const todasAsChaves = coletarTodasAsChaves(jsonData)
  const colDia = detectarColuna(todasAsChaves, ['dia', 'data'])
  const colColaborador = detectarColuna(todasAsChaves, ['colaborador', 'nome', 'nome do colaborador', 'funcionario'])
  const colLocal = detectarColuna(todasAsChaves, ['local de trabalho'])

  if (!colDia || !colColaborador || !colLocal) {
    throw new Error(`Colunas obrigatórias não encontradas na exportação do CORH (Dia, Colaborador, Local de Trabalho). Colunas detectadas: ${todasAsChaves.join(', ')}`)
  }

  return jsonData
    .map((row): DiaFlit | null => {
      const data = parseDataExportacaoCorh(row[colDia])
      if (!data) return null

      const { nome, matricula } = extrairNomeMatricula(row[colColaborador])
      if (!nome) return null

      return {
        nomeColaborador: nome,
        matricula,
        data,
        tipoDispositivo: '',
        nomeDispositivo: '',
        perimetro: '',
        departamento: '',
        turno: '',
        batidas: [],
        localTrabalhoNome: String(row[colLocal] || '').trim() || undefined,
      }
    })
    .filter((d): d is DiaFlit => d !== null)
}

function parseJsonRows(jsonData: Record<string, unknown>[]): DiaFlit[] {
  if (jsonData.length === 0) return []

  const todasAsChaves = coletarTodasAsChaves(jsonData)
  const formato = detectarFormato(todasAsChaves)

  if (formato === 'exportacao_corh') {
    return parseExportacaoCorh(jsonData)
  }

  if (formato === 'desconhecido') {
    throw new Error(`Colunas obrigatórias não encontradas no Excel (Nome, Data e Hora). Colunas detectadas: ${todasAsChaves.join(', ')}`)
  }

  // Formato Flit padrão
  const colNome = detectarColuna(todasAsChaves, ['colaborador', 'nome', 'nome do colaborador', 'funcionario'])
  const colMatricula = detectarColuna(todasAsChaves, ['matricula', 'matrícula'])
  const colData = detectarColuna(todasAsChaves, ['data', 'data da batida', 'dia'])
  const colHora = detectarColuna(todasAsChaves, ['hora', 'horario', 'horário'])
  const colTipoDispositivo = detectarColuna(todasAsChaves, ['dispositivo', 'tipo do dispositivo', 'tipo dispositivo', 'tipo'])
  const colNomeDispositivo = detectarColuna(todasAsChaves, ['nome do dispositivo'])
  const colPerimetro = detectarColuna(todasAsChaves, ['perimetro', 'perímetro', 'localizacao', 'localização'])
  const colDepartamento = detectarColuna(todasAsChaves, ['departamento'])
  const colTurno = detectarColuna(todasAsChaves, ['escala', 'horario', 'horário', 'turno'])

  if (!colNome || !colData || !colHora) {
    throw new Error(`Colunas obrigatórias não encontradas no Excel (Nome, Data e Hora). Colunas detectadas: ${todasAsChaves.join(', ')}`)
  }

  const batidas = jsonData
    .map((row) => {
      const dataHoraInfo = extrairDataHora(row[colData], row[colHora])
      if (!dataHoraInfo) return null

      return {
        nomeColaborador: getString(row, colNome).trim(),
        matricula: colMatricula ? getString(row, colMatricula) : '',
        dataHora: dataHoraInfo.dataHora,
        data: dataHoraInfo.data,
        hora: dataHoraInfo.hora,
        tipoDispositivo: colTipoDispositivo ? getString(row, colTipoDispositivo) : '',
        nomeDispositivo: colNomeDispositivo ? getString(row, colNomeDispositivo) : '',
        perimetro: colPerimetro ? getString(row, colPerimetro) : '',
        departamento: colDepartamento ? getString(row, colDepartamento) : '',
        turno: colTurno ? getString(row, colTurno) : '',
      }
    })
    .filter((b): b is BatidaFlit => b !== null && b.nomeColaborador.length > 0)

  return agruparBatidasPorDia(batidas)
}

export async function parseWorkbookBinary(binaryData: string | ArrayBuffer): Promise<DiaFlit[]> {
  const XLSX = await getXLSX()
  const workbook = XLSX.read(binaryData, { type: typeof binaryData === 'string' ? 'binary' : 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet)
  const dias = parseJsonRows(jsonData)
  return dias
}

export async function parseExcelFlit(file: File): Promise<DiaFlit[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          throw new Error('Não foi possível ler o conteúdo do arquivo')
        }
        const dias = await parseWorkbookBinary(data)
        resolve(dias)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.onabort = () => reject(new Error('Leitura do arquivo abortada'))
    reader.readAsArrayBuffer(file)
  })
}

export function agruparBatidasPorDia(batidas: BatidaFlit[]): DiaFlit[] {
  const grupos = new Map<string, DiaFlit>()

  for (const batida of batidas) {
    // Agrupa por matrícula normalizada (ignora zeros à esquerda) quando disponível.
    // Isso evita que '000772' e '772' sejam tratados como colaboradores diferentes.
    const identificador = batida.matricula
      ? normalizarMatricula(batida.matricula)
      : normalizarTexto(batida.nomeColaborador)
    const chave = `${identificador}|${batida.data}`

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        nomeColaborador: batida.nomeColaborador,
        matricula: batida.matricula,
        data: batida.data,
        tipoDispositivo: batida.tipoDispositivo,
        nomeDispositivo: batida.nomeDispositivo,
        perimetro: batida.perimetro,
        departamento: batida.departamento,
        turno: batida.turno,
        batidas: [],
      })
    }

    const dia = grupos.get(chave)!
    dia.batidas.push({ hora: batida.hora })

    // Se houver prioridade para dispositivo fixo, mantemos os dados mais confiáveis
    const tipoNormalizado = normalizarTexto(batida.tipoDispositivo)
    if (tipoNormalizado.includes('multi')) {
      dia.tipoDispositivo = batida.tipoDispositivo
      dia.nomeDispositivo = batida.nomeDispositivo
    }
  }

  return Array.from(grupos.values())
}

export function encontrarColaborador(
  nome: string,
  matricula: string,
  colaboradores: Colaborador[]
): Colaborador | undefined {
  const nomeNormalizado = normalizarTexto(nome)
  const matriculaNormalizada = normalizarMatricula(matricula)

  // Prioriza busca por matrícula, ignorando zeros à esquerda e caracteres não numéricos.
  if (matriculaNormalizada) {
    const porMatricula = colaboradores.find((c) =>
      normalizarMatricula(c.matricula) === matriculaNormalizada
    )
    if (porMatricula) return porMatricula
  }

  if (!nomeNormalizado) return undefined

  return colaboradores.find((c) => {
    const nomeColaborador = normalizarTexto(c.nome_completo)
    return (
      nomeColaborador === nomeNormalizado ||
      nomeColaborador.includes(nomeNormalizado) ||
      nomeNormalizado.includes(nomeColaborador)
    )
  })
}
