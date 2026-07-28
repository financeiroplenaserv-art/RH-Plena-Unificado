// Lógica pura de importação do espelho de ponto (PDF do Flit) para ocorrências.
// Portado do script validado scripts/extrair-ponto-unificado.cjs.
// Não depende de Supabase nem de pdfjs: recebe os itens de texto posicionados
// de cada página e a lista de colaboradores como parâmetros.
import { TIPOS_OCORRENCIA, exigeDocumento } from './tiposOcorrencia'

// ===================== Tipos de entrada =====================

/** Item de texto posicionado vindo do pdfjs (getTextContent). */
export interface ItemTextoPDF {
  x: number
  y: number
  texto: string
}

/** Uma página do PDF já convertida em itens de texto posicionados. */
export interface PaginaPDF {
  numero: number
  itens: ItemTextoPDF[]
}

/** Subconjunto de colunas da tabela colaboradores usado no matching. */
export interface ColaboradorResumo {
  id: string
  nome_completo: string
  cpf: string | null
  empresa_id: string | null
  status?: string | null
}

// ===================== Tipos de saída =====================

export type ClassificacaoDia = 'trabalhado' | 'falta' | 'atestado' | 'nao_trabalhado' | 'outro'

export interface DiaPonto {
  data: string // ISO yyyy-mm-dd
  realizado: string
  justificativa: string
  categoria: string | null // texto casado do PDF (Falta, Atestado, Folga, ...)
  classificacao: ClassificacaoDia
}

export interface EspelhoColaborador {
  pagina: number
  nomePdf: string
  cpfPdf: string
  periodoInicio: string | null // dd/mm/aaaa, como impresso no cabeçalho
  periodoFim: string | null
  dias: DiaPonto[]
}

export type StatusMatch = 'OK' | 'NOME_DIVERGE' | 'NAO_ENCONTRADO'

export interface OcorrenciaPlanejada {
  pagina: number
  nomePdf: string
  cpfPdf: string
  match: StatusMatch
  colaborador: ColaboradorResumo | null
  tipo: string
  macroGrupo: string
  gravidade: string
  baseLegal: string
  titulo: string
  descricao: string
  dataInicio: string // ISO
  dataFim: string // ISO
  dias: number // dias corridos do período
  status: 'Pendente' | 'Ativa'
  justificativas: string[]
  avisos: string[]
  duplicada: boolean
}

/** Linha mínima da tabela ocorrencias usada na deduplicação. */
export interface OcorrenciaExistente {
  colaborador_id: string | null
  data_ocorrencia: string
  tipo_ocorrencia: string
}

// ===================== Constantes e normalização =====================

// Categorias reconhecidas na coluna Realizado. O match é por prefixo e testa
// SEMPRE as mais longas primeiro ("Falta BH" antes de "Falta").
const CATEGORIAS_PONTO = ['Falta BH', 'Suspensão', 'Afastado', 'Atestado', 'Feriado', 'Férias', 'Folga', 'Falta']

const TIPO_FALTA = 'Falta Injustificada'
const TIPO_ATESTADO = 'Falta Justificada (atestado)'
const TIPO_LICENCA_ATE_15 = 'Licença Médica (até 15 dias)'
const TIPO_LICENCA_INSS = 'Licença Médica (acima 15 dias — INSS)'

const LIMIAR_ATESTADO_DIAS = 8
const LIMIAR_LICENCA_DIAS = 15

export function normalizarCPF(cpf: string | null | undefined): string {
  return (cpf || '').replace(/\D/g, '').padStart(11, '0')
}

export function normalizarNome(nome: string | null | undefined): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[….]/g, '') // reticências de nome truncado e pontos
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

// ===================== Datas =====================

function paraUTC(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

function diffDias(inicioISO: string, fimISO: string): number {
  return Math.round((paraUTC(fimISO) - paraUTC(inicioISO)) / 86400000)
}

function somarDias(iso: string, n: number): string {
  const dt = new Date(paraUTC(iso) + n * 86400000)
  return dt.toISOString().slice(0, 10)
}

export function formatarDataBR(iso: string): string {
  return iso.split('-').reverse().join('/')
}

// ===================== Classificação do dia =====================

export function classificarRealizado(realizado: string): {
  categoria: string | null
  classificacao: ClassificacaoDia
} {
  const lower = realizado.trim().toLowerCase()
  const categoria =
    [...CATEGORIAS_PONTO]
      .sort((a, b) => b.length - a.length)
      .find((c) => lower.startsWith(c.toLowerCase())) ?? null

  if (categoria === 'Falta') return { categoria, classificacao: 'falta' }
  if (categoria === 'Atestado') return { categoria, classificacao: 'atestado' }
  if (categoria === 'Folga' || categoria === 'Feriado' || categoria === 'Férias') {
    return { categoria, classificacao: 'nao_trabalhado' }
  }
  // Falta BH, Afastado e Suspensão não viram ocorrência nem "ponte" de atestado
  if (categoria) return { categoria, classificacao: 'outro' }
  // Realizado com horários (ex.: "06:51 12:00 (M) 13:00 19:05 (A)") = dia trabalhado
  if (/\d{2}:\d{2}/.test(realizado)) return { categoria: null, classificacao: 'trabalhado' }
  return { categoria: null, classificacao: 'outro' }
}

// ===================== Parse das páginas =====================

/**
 * Converte as páginas (itens posicionados do pdfjs) em espelhos por colaborador.
 * Coordenadas herdadas do parser validado contra o PDF real:
 * Realizado em x ∈ [290, 440); Justificativa em x ∈ [645, 775).
 */
export function parsePaginasEspelho(paginas: PaginaPDF[]): EspelhoColaborador[] {
  const espelhos: EspelhoColaborador[] = []

  for (const pagina of paginas) {
    // Agrupa itens por Y arredondado e ordena as linhas de cima para baixo
    const linhas = new Map<number, { x: number; t: string }[]>()
    for (const item of pagina.itens) {
      const y = Math.round(item.y)
      if (!linhas.has(y)) linhas.set(y, [])
      linhas.get(y)!.push({ x: Math.round(item.x), t: item.texto })
    }
    const ordenadas = [...linhas.entries()].sort((a, b) => b[0] - a[0])

    let nome = ''
    let cpf = ''
    let periodoInicio: string | null = null
    let periodoFim: string | null = null
    const dias: DiaPonto[] = []

    for (const [, itens] of ordenadas) {
      itens.sort((a, b) => a.x - b.x)
      const textoLinha = itens.map((i) => i.t).join(' ')

      if (!cpf) {
        const mCpf = textoLinha.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
        if (mCpf && textoLinha.includes('Colaborador CPF')) cpf = mCpf[0]
      }

      const idxColab = itens.findIndex((i) => i.t.trim() === 'Colaborador:')
      if (idxColab >= 0) {
        // Nome = itens entre "Colaborador:" e "Período:" na mesma linha
        const partes: string[] = []
        let i = idxColab + 1
        for (; i < itens.length; i++) {
          if (itens[i].t.trim() === 'Período:') break
          partes.push(itens[i].t)
        }
        nome = partes.join('').replace(/\s+/g, ' ').trim()
        // Período = itens após "Período:" na mesma linha
        if (i < itens.length) {
          const textoPeriodo = itens
            .slice(i + 1)
            .map((p) => p.t)
            .join(' ')
          const mPeriodo = textoPeriodo.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/)
          if (mPeriodo) {
            periodoInicio = mPeriodo[1]
            periodoFim = mPeriodo[2]
          }
        }
        continue
      }

      // Linhas de dados começam com data dd/mm/aa
      const primeiro = itens.find((item) => item.t.trim())
      if (!primeiro || !/^\d{2}\/\d{2}\/\d{2}/.test(primeiro.t.trim())) continue
      const dataStr = primeiro.t.trim().slice(0, 8) // dd/mm/aa

      const realizado = itens
        .filter((item) => item.x >= 290 && item.x < 440)
        .map((item) => item.t.trim())
        .filter(Boolean)
        .join(' ')

      const justificativa = itens
        .filter((item) => item.x >= 645 && item.x < 775 && !/^[\d:]+$/.test(item.t.trim()))
        .map((item) => item.t.trim())
        .filter(Boolean)
        .join(' ')

      const { categoria, classificacao } = classificarRealizado(realizado)
      const [dd, mm, aa] = dataStr.split('/')
      dias.push({
        data: `20${aa}-${mm}-${dd}`,
        realizado,
        justificativa,
        categoria,
        classificacao,
      })
    }

    espelhos.push({ pagina: pagina.numero, nomePdf: nome, cpfPdf: cpf, periodoInicio, periodoFim, dias })
  }

  return espelhos
}

// ===================== Matching de colaborador =====================

export function casarColaborador(
  espelho: Pick<EspelhoColaborador, 'cpfPdf' | 'nomePdf'>,
  colaboradores: ColaboradorResumo[]
): { colaborador: ColaboradorResumo | null; match: StatusMatch } {
  const cpfNorm = normalizarCPF(espelho.cpfPdf)
  const candidatos = cpfNorm.replace(/\D/g, '')
    ? colaboradores.filter((c) => normalizarCPF(c.cpf) === cpfNorm)
    : []

  // Em CPF duplicado no cadastro, prefere o colaborador Ativo
  const colaborador = candidatos.find((c) => c.status === 'Ativo') || candidatos[0] || null
  if (!colaborador) return { colaborador: null, match: 'NAO_ENCONTRADO' }

  const nomePdf = normalizarNome(espelho.nomePdf)
  const nomeCorh = normalizarNome(colaborador.nome_completo)
  const match: StatusMatch =
    nomePdf && nomeCorh && (nomeCorh.startsWith(nomePdf) || nomePdf.startsWith(nomeCorh))
      ? 'OK'
      : 'NOME_DIVERGE'
  return { colaborador, match }
}

// ===================== Agrupamento e planejamento =====================

function tipoPorDuracao(dias: number): string {
  if (dias <= LIMIAR_ATESTADO_DIAS) return TIPO_ATESTADO
  if (dias <= LIMIAR_LICENCA_DIAS) return TIPO_LICENCA_ATE_15
  return TIPO_LICENCA_INSS
}

function dadosCatalogo(tipo: string): { macroGrupo: string; gravidade: string; baseLegal: string } {
  const modelo = TIPOS_OCORRENCIA.find((t) => t.tipo === tipo)
  return {
    macroGrupo: modelo?.macroGrupo ?? '',
    gravidade: modelo?.gravidade ?? '',
    baseLegal: modelo?.baseLegal ?? '',
  }
}

function montarDescricao(params: {
  inicio: string
  fim: string
  dias: number
  justificativas: string[]
  espelho: EspelhoColaborador
}): string {
  const { inicio, fim, dias, justificativas, espelho } = params
  const partes: string[] = []
  if (inicio === fim) {
    partes.push(`Dia ${formatarDataBR(inicio)}.`)
  } else {
    partes.push(
      `Período de ${formatarDataBR(inicio)} a ${formatarDataBR(fim)} — ${dias} ${dias === 1 ? 'dia corrido' : 'dias corridos'}.`
    )
  }
  if (justificativas.length > 0) {
    partes.push(`Justificativa no ponto: ${justificativas.join('; ')}.`)
  }
  const periodoEspelho =
    espelho.periodoInicio && espelho.periodoFim
      ? `${espelho.periodoInicio} a ${espelho.periodoFim}`
      : 'período não identificado'
  partes.push(`Importado do espelho de ponto ${periodoEspelho} (página ${espelho.pagina} do PDF).`)
  return partes.join('\n')
}

function basePlanejada(
  espelho: EspelhoColaborador,
  colaborador: ColaboradorResumo | null,
  match: StatusMatch
): Pick<OcorrenciaPlanejada, 'pagina' | 'nomePdf' | 'cpfPdf' | 'match' | 'colaborador' | 'duplicada'> {
  return {
    pagina: espelho.pagina,
    nomePdf: espelho.nomePdf,
    cpfPdf: espelho.cpfPdf,
    match,
    colaborador,
    duplicada: false,
  }
}

function planejarFalta(
  grupo: DiaPonto[],
  espelho: EspelhoColaborador,
  colaborador: ColaboradorResumo | null,
  match: StatusMatch
): OcorrenciaPlanejada {
  const inicio = grupo[0].data
  const fim = grupo[grupo.length - 1].data
  const dias = grupo.length
  const titulo =
    dias === 1
      ? `Falta injustificada em ${formatarDataBR(inicio)}`
      : `Falta injustificada — ${dias} dias (${formatarDataBR(inicio)} a ${formatarDataBR(fim)})`
  const justificativas = [...new Set(grupo.map((d) => d.justificativa).filter(Boolean))]
  return {
    ...basePlanejada(espelho, colaborador, match),
    tipo: TIPO_FALTA,
    ...dadosCatalogo(TIPO_FALTA),
    titulo,
    descricao: montarDescricao({ inicio, fim, dias, justificativas, espelho }),
    dataInicio: inicio,
    dataFim: fim,
    dias,
    status: exigeDocumento(TIPO_FALTA) ? 'Pendente' : 'Ativa',
    justificativas,
    avisos: [],
  }
}

/** Extrai "N dias" de uma justificativa de ponto (ex.: "Atestado 5 dias"). */
export function extrairDiasDeclarados(justificativa: string): number | null {
  const m = justificativa.match(/(\d+)\s*dias?\b/i)
  return m ? Number(m[1]) : null
}

function planejarAtestado(
  registros: DiaPonto[],
  inicio: string,
  fim: string,
  espelho: EspelhoColaborador,
  colaborador: ColaboradorResumo | null,
  match: StatusMatch
): OcorrenciaPlanejada {
  const dias = diffDias(inicio, fim) + 1 // dias corridos do período
  const tipo = tipoPorDuracao(dias)
  const titulo =
    tipo === TIPO_ATESTADO
      ? `Atestado de ${dias} ${dias === 1 ? 'dia' : 'dias'}`
      : `Licença médica de ${dias} dias`
  const justificativas = [...new Set(registros.map((d) => d.justificativa).filter(Boolean))]

  const avisos: string[] = []
  for (const j of justificativas) {
    const declarados = extrairDiasDeclarados(j)
    if (declarados !== null && declarados !== dias) {
      avisos.push(
        `A justificativa do ponto menciona ${declarados} ${declarados === 1 ? 'dia' : 'dias'}, mas o período calculado é de ${dias} ${dias === 1 ? 'dia' : 'dias'} (usado o calculado).`
      )
    }
  }

  return {
    ...basePlanejada(espelho, colaborador, match),
    tipo,
    ...dadosCatalogo(tipo),
    titulo,
    descricao: montarDescricao({ inicio, fim, dias, justificativas, espelho }),
    dataInicio: inicio,
    dataFim: fim,
    dias,
    status: exigeDocumento(tipo) ? 'Pendente' : 'Ativa',
    justificativas,
    avisos,
  }
}

/**
 * Gera as ocorrências planejadas de um espelho:
 * - Faltas: agrupa apenas dias estritamente consecutivos (1 dia corrido de diferença).
 * - Atestados: funde dias "pulando" apenas dias não trabalhados (Folga/Feriado/Férias)
 *   entre eles; dia trabalhado, falta ou outra categoria no meio quebra o período.
 */
export function planejarOcorrencias(
  espelho: EspelhoColaborador,
  colaborador: ColaboradorResumo | null,
  match: StatusMatch
): OcorrenciaPlanejada[] {
  const dias = [...espelho.dias].sort((a, b) => a.data.localeCompare(b.data))
  const porData = new Map(dias.map((d) => [d.data, d]))
  const resultado: OcorrenciaPlanejada[] = []

  // Faltas — somente consecutivas
  let grupoFaltas: DiaPonto[] = []
  for (const d of dias) {
    if (d.classificacao !== 'falta') continue
    const anterior = grupoFaltas[grupoFaltas.length - 1]
    if (anterior && diffDias(anterior.data, d.data) === 1) {
      grupoFaltas.push(d)
    } else {
      if (grupoFaltas.length > 0) resultado.push(planejarFalta(grupoFaltas, espelho, colaborador, match))
      grupoFaltas = [d]
    }
  }
  if (grupoFaltas.length > 0) resultado.push(planejarFalta(grupoFaltas, espelho, colaborador, match))

  // Atestados — funde se todos os dias entre dois atestados forem não trabalhados
  const podeFundir = (fimAtual: string, proximo: string): boolean => {
    for (let cursor = somarDias(fimAtual, 1); cursor < proximo; cursor = somarDias(cursor, 1)) {
      const dia = porData.get(cursor)
      // Dia ausente do espelho não bloqueia a fusão; qualquer outro status bloqueia
      if (dia && dia.classificacao !== 'nao_trabalhado') return false
    }
    return true
  }

  let registros: DiaPonto[] = []
  let inicioAtual = ''
  let fimAtual = ''
  for (const d of dias) {
    if (d.classificacao !== 'atestado') continue
    if (registros.length > 0 && podeFundir(fimAtual, d.data)) {
      registros.push(d)
      fimAtual = d.data
    } else {
      if (registros.length > 0) {
        resultado.push(planejarAtestado(registros, inicioAtual, fimAtual, espelho, colaborador, match))
      }
      registros = [d]
      inicioAtual = d.data
      fimAtual = d.data
    }
  }
  if (registros.length > 0) {
    resultado.push(planejarAtestado(registros, inicioAtual, fimAtual, espelho, colaborador, match))
  }

  return resultado.sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
}

// ===================== Deduplicação =====================

/**
 * Marca como duplicada toda ocorrência planejada que já existe no banco
 * (mesmo colaborador_id + data_ocorrencia + tipo_ocorrencia).
 */
export function marcarDuplicadas(
  planejadas: OcorrenciaPlanejada[],
  existentes: OcorrenciaExistente[]
): number {
  const chaves = new Set(
    existentes.map((e) => `${e.colaborador_id}|${e.data_ocorrencia}|${e.tipo_ocorrencia}`)
  )
  let total = 0
  for (const p of planejadas) {
    if (p.colaborador && chaves.has(`${p.colaborador.id}|${p.dataInicio}|${p.tipo}`)) {
      p.duplicada = true
      total++
    }
  }
  return total
}

// ===================== Payload de insert =====================

const TEXTO_NAO_INFORMADO = 'Não informada — importação do espelho de ponto.'

/** Monta o payload do insert espelhando o handleSubmit do OcorrenciaFormPage. */
export function montarPayloadInsert(
  planejada: OcorrenciaPlanejada,
  usuarioId: string | null
): Record<string, string | null> {
  const payload: Record<string, string | null> = {
    colaborador_id: planejada.colaborador?.id ?? null,
    empresa_id: planejada.colaborador?.empresa_id ?? null,
    colaborador_nome: planejada.colaborador?.nome_completo ?? planejada.nomePdf ?? null,
    tipo_ocorrencia: planejada.tipo,
    tipo_penalidade: planejada.tipo,
    macro_grupo: planejada.macroGrupo,
    titulo: planejada.titulo,
    data_ocorrencia: planejada.dataInicio,
    data_hora_ocorrido: planejada.dataInicio,
    descricao: planejada.descricao,
    status: planejada.status,
    base_legal: planejada.baseLegal,
    gravidade: planejada.gravidade,
    defesa_funcionario: TEXTO_NAO_INFORMADO,
    medida_corretiva: TEXTO_NAO_INFORMADO,
    usuario_id: usuarioId,
  }
  // Strings vazias viram null, como no formulário
  for (const [k, v] of Object.entries(payload)) {
    if (v === '') payload[k] = null
  }
  return payload
}
