import { extrairPaginasPDF } from '@/lib/vr/pdfExtractor'
import type { StatusDiaAdicional } from '@/types/adicionais'

export interface PontoDia {
  data: string // YYYY-MM-DD
  dataOriginal: string // DD/MM/YYYY
  status: StatusDiaAdicional
  horarios: string[]
  observacao?: string
  revisao: boolean
}

export interface PontoColaborador {
  nome: string
  matricula: string
  periodoInicio: string // YYYY-MM-DD
  periodoFim: string // YYYY-MM-DD
  dias: PontoDia[]
}

export function normalizarMatricula(matricula: string | null | undefined): string {
  if (!matricula) return ''
  return String(matricula).replace(/\D/g, '').replace(/^0+/, '') || '0'
}

function converterData(dataStr: string, anoReferencia?: number): string | null {
  const partes = dataStr.split('/')
  if (partes.length < 2) return null
  const dia = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10)
  let ano = anoReferencia || new Date().getFullYear()
  if (partes.length >= 3) {
    ano = parseInt(partes[2], 10)
  }
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function detectarStatus(texto: string, statusAnterior: StatusDiaAdicional | null): { status: StatusDiaAdicional; horarios: string[]; observacao: string; revisao: boolean } {
  const t = texto.toLowerCase().trim()
  const horarios = Array.from(texto.match(/\d{2}:\d{2}/g) || [])
  const horasTrabalhadas = horarios.length > 0 ? horarios[horarios.length - 1] : null
  const temHorariosTrabalho = horarios.some(h => h !== '00:00')

  if (t.includes('atestado')) {
    return { status: 'afastado', horarios: [], observacao: texto, revisao: false }
  }
  if (t.includes('férias') || t.includes('ferias')) {
    return { status: 'ferias', horarios: [], observacao: texto, revisao: false }
  }
  if (t.includes('falta')) {
    return { status: 'falta', horarios: [], observacao: texto, revisao: false }
  }
  if (t.includes('folga')) {
    return { status: 'folga', horarios: [], observacao: texto, revisao: false }
  }
  if (temHorariosTrabalho) {
    return { status: 'trabalhou', horarios, observacao: texto, revisao: false }
  }

  // H. trab. = 00:00 ou linha vazia: aplica regra 12x36
  if (horasTrabalhadas === '00:00' || t === '' || t === '00:00') {
    if (statusAnterior === 'trabalhou') {
      return { status: 'folga', horarios: [], observacao: texto || 'Folga (12x36)', revisao: false }
    }
    if (statusAnterior === 'folga') {
      return { status: 'falta', horarios: [], observacao: texto || 'Falta (12x36)', revisao: false }
    }
    return { status: 'trabalhou', horarios: [], observacao: texto, revisao: true }
  }

  return { status: 'trabalhou', horarios: [], observacao: texto, revisao: true }
}

function linhaContem(texto: string, termos: string[]): boolean {
  const limpo = texto.toLowerCase().replace(/[^a-z0-9]/g, '')
  return termos.some(t => limpo.includes(t.toLowerCase().replace(/[^a-z0-9]/g, '')))
}

function parsePagina(texto: string): PontoColaborador | null {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  if (linhas.length === 0) return null


  // Nome: quando o PDF quebra "Colaborador:" e o nome em linhas separadas
  let nome = ''
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (linhaContem(linha, ['colaborador']) || /^colaborador[:\s]*$/i.test(linha)) {
      // Tenta primeiro o valor na mesma linha (depois dos dois pontos)
      const matchMesmaLinha = linha.match(/colaborador[:\s]+(.+)/i)
      if (matchMesmaLinha && matchMesmaLinha[1].trim()) {
        nome = matchMesmaLinha[1].trim()
      } else if (i + 1 < linhas.length) {
        nome = linhas[i + 1].trim()
      }
      break
    }
  }

  // Fallback antigo: procura "Nome:"
  if (!nome) {
    for (const linha of linhas) {
      const matchNome = linha.match(/nome[:\s]+(.+)/i)
      if (matchNome) {
        nome = matchNome[1].trim()
        break
      }
    }
  }

  // Matrícula: quando o PDF quebra "Matrícula:" e o número em linhas separadas
  let matricula = ''
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (linhaContem(linha, ['matrícula', 'matricula']) || /^matr[íi]cula[:\s]*$/i.test(linha)) {
      const matchMesmaLinha = linha.match(/matr[íi]cula[:\s]+(\d+)/i)
      if (matchMesmaLinha) {
        matricula = normalizarMatricula(matchMesmaLinha[1])
      } else if (i + 1 < linhas.length) {
        const proxima = linhas[i + 1].trim()
        const matchProxima = proxima.match(/^(\d+)$/)
        if (matchProxima) {
          matricula = normalizarMatricula(matchProxima[1])
        }
      }
      break
    }
  }

  // Fallback: qualquer linha com "Matrícula: número"
  if (!matricula) {
    for (const linha of linhas) {
      const match = linha.match(/matr[íi]cula[:\s]+(\d+)/i)
      if (match) {
        matricula = normalizarMatricula(match[1])
        break
      }
    }
  }

  // Se não achou nome, tenta inferir pela linha anterior à matrícula
  if (!nome && matricula) {
    const idxMatricula = linhas.findIndex(l => normalizarMatricula(l.match(/\d+/)?.[0]) === matricula)
    if (idxMatricula > 0) {
      nome = linhas[idxMatricula - 1]
    }
  }

  // Período: quando o PDF quebra "Período:" e as datas em linhas separadas
  let periodoInicio = ''
  let periodoFim = ''
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    const ehLabelPeriodo = /^per[íi]odo[:\s]*$/i.test(linha.trim()) || /^per[íi]odo[:\s]+$/i.test(linha.trim())
    const contemPeriodo = linhaContem(linha, ['período', 'periodo'])
    if (ehLabelPeriodo || contemPeriodo) {
      // Tenta valor na mesma linha
      const matchMesmaLinha = linha.match(/per[íi]odo[:\s]*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/i)
      if (matchMesmaLinha) {
        periodoInicio = converterData(matchMesmaLinha[1]) || ''
        periodoFim = converterData(matchMesmaLinha[2]) || ''
      } else if (i + 1 < linhas.length) {
        const proxima = linhas[i + 1].trim()
        const matchProxima = proxima.match(/(\d{2}\/\d{2}\/\d{4})\s*[-a]\s*(\d{2}\/\d{2}\/\d{4})/)
        if (matchProxima) {
          periodoInicio = converterData(matchProxima[1]) || ''
          periodoFim = converterData(matchProxima[2]) || ''
        }
      }
      if (periodoInicio && periodoFim) break
    }
  }

  // Fallback: procura qualquer linha com o padrão de datas de período
  if (!periodoInicio || !periodoFim) {
    for (const linha of linhas) {
      const match = linha.match(/(\d{2}\/\d{2}\/\d{4})\s*[-a]\s*(\d{2}\/\d{2}\/\d{4})/)
      if (match) {
        periodoInicio = converterData(match[1]) || ''
        periodoFim = converterData(match[2]) || ''
        break
      }
    }
  }

  const anoReferencia = periodoInicio ? parseInt(periodoInicio.split('-')[0], 10) : undefined

  const dias: PontoDia[] = []
  let statusAnterior: StatusDiaAdicional | null = null

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    const dataMatch = linha.match(/^(\d{2}\/\d{2})(?:\/\d{2,4})?\s*-\s*[A-Za-zÀ-ÿ]{3}/)
    if (!dataMatch) continue

    const dataCompleta = dataMatch[0].includes('/20') ? dataMatch[0] : `${dataMatch[1]}/${anoReferencia || new Date().getFullYear()}`
    const data = converterData(dataCompleta)
    if (!data) continue

    const resto = linha.substring(dataMatch[0].length).trim()
    let proximaLinha = ''

    // Se a linha seguinte não for data nem cabeçalho conhecido, pode ser continuação (ex: Folga, 00:00)
    if (i + 1 < linhas.length) {
      const next = linhas[i + 1].trim()
      if (next && !/^\d{2}\/\d{2}/.test(next) && !linhaContem(next, ['colaborador', 'matrícula', 'matricula', 'período', 'periodo', 'data', 'realizado', 'h.trab', 'htrab'])) {
        proximaLinha = next
      }
    }

    const textoParaAnalise = [resto, proximaLinha].filter(Boolean).join(' ')
    const { status, horarios, observacao, revisao } = detectarStatus(textoParaAnalise, statusAnterior)
    statusAnterior = status

    dias.push({
      data,
      dataOriginal: dataMatch[1],
      status,
      horarios,
      observacao: observacao || undefined,
      revisao,
    })
  }

  if (!nome && !matricula && dias.length === 0) return null

  return {
    nome: nome || 'Desconhecido',
    matricula: matricula || '',
    periodoInicio,
    periodoFim,
    dias,
  }
}

export async function parsePontoPDF(file: File): Promise<PontoColaborador[]> {
  const paginas = await extrairPaginasPDF(file)

  const resultados: PontoColaborador[] = []
  for (let i = 0; i < paginas.length; i++) {
    const pagina = paginas[i]
    const colaborador = parsePagina(pagina)
    if (colaborador) {
      resultados.push(colaborador)
    }
  }

  return resultados
}

export function resumoPonto(colaborador: PontoColaborador) {
  const trabalhou = colaborador.dias.filter(d => d.status === 'trabalhou').length
  const folga = colaborador.dias.filter(d => d.status === 'folga').length
  const falta = colaborador.dias.filter(d => d.status === 'falta').length
  const ferias = colaborador.dias.filter(d => d.status === 'ferias').length
  const afastado = colaborador.dias.filter(d => d.status === 'afastado').length
  const revisao = colaborador.dias.filter(d => d.revisao).length
  return { trabalhou, folga, falta, ferias, afastado, revisao }
}

export function calcularPeriodoPDF(resultados: PontoColaborador[]): { inicio: string; fim: string } | null {
  const todasDatas = resultados.flatMap(c => c.dias.map(d => d.data))
  if (todasDatas.length === 0) return null
  todasDatas.sort()
  return { inicio: todasDatas[0], fim: todasDatas[todasDatas.length - 1] }
}
