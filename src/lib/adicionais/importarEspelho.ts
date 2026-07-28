// Mapeamento do espelho de ponto (parser único em src/lib/ocorrencias/importacaoPonto.ts)
// para a estrutura de dias do módulo Adicionais (calendario_adicionais).
// Lógica pura: não depende de Supabase nem de pdfjs.
import type { StatusDiaAdicional } from '@/types/adicionais'
import type { ColaboradorResumo, DiaPonto, EspelhoColaborador } from '@/lib/ocorrencias/importacaoPonto'
import { formatarDataBR } from '@/lib/ocorrencias/importacaoPonto'

// ===================== Tipos =====================

export interface DiaEspelho {
  data: string // ISO yyyy-mm-dd
  dataOriginal: string // dd/mm/aaaa, para exibição
  status: StatusDiaAdicional
  horarios: string[] // HH:MM extraídos do realizado
  observacao?: string // justificativa do ponto
  revisao: boolean
}

export interface PontoEspelho {
  nome: string
  matricula: string // matrícula do cadastro (o espelho do Flit não tem matrícula)
  periodoInicio: string // ISO
  periodoFim: string // ISO
  dias: DiaEspelho[]
}

// ===================== Mapeamento de status =====================

/**
 * Converte um dia do espelho (categoria/classificação do parser) no status
 * do calendário de adicionais.
 *
 * Defaults de classificação combinados com a usuária (ajustar se mudar o entendimento):
 * - Suspensão → falta (desconta dos 30 dias);
 * - Falta BH → folga (coberta por banco de horas, não desconta);
 * - Feriado → folga.
 * Qualquer caso não reconhecido vira folga com revisao: true.
 */
export function statusAdicionalDoDia(dia: DiaPonto): { status: StatusDiaAdicional; revisao: boolean } {
  switch (dia.categoria) {
    case 'Falta':
      return { status: 'falta', revisao: false }
    case 'Suspensão':
      // Default documentado: suspensão desconta dos 30 dias, como a falta
      return { status: 'falta', revisao: false }
    case 'Falta BH':
      // Default documentado: falta coberta por banco de horas não desconta
      return { status: 'folga', revisao: false }
    case 'Folga':
    case 'Feriado':
      return { status: 'folga', revisao: false }
    case 'Férias':
      return { status: 'ferias', revisao: false }
    case 'Atestado':
    case 'Afastado':
      return { status: 'afastado', revisao: false }
  }
  if (dia.classificacao === 'trabalhado') return { status: 'trabalhou', revisao: false }
  // Caso não reconhecido: assume folga e marca para revisão manual
  return { status: 'folga', revisao: true }
}

// ===================== Conversões =====================

/** dd/mm/aaaa → ISO yyyy-mm-dd (null se inválida). */
function dataBRParaISO(dataBR: string | null): string | null {
  if (!dataBR) return null
  const m = dataBR.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

/**
 * Converte o espelho de um colaborador para a estrutura consumida pela
 * página de importação dos Adicionais. A matrícula exibida vem do cadastro
 * (o espelho do Flit com CPF não traz matrícula).
 */
export function espelhoParaPonto(
  espelho: EspelhoColaborador,
  colaborador: (ColaboradorResumo & { matricula?: string | null }) | null
): PontoEspelho {
  const periodoInicio = dataBRParaISO(espelho.periodoInicio) ?? ''
  const periodoFim = dataBRParaISO(espelho.periodoFim) ?? ''
  return {
    nome: colaborador?.nome_completo || espelho.nomePdf || 'Desconhecido',
    matricula: colaborador?.matricula || '',
    periodoInicio,
    periodoFim,
    dias: espelho.dias.map((dia) => {
      const { status, revisao } = statusAdicionalDoDia(dia)
      return {
        data: dia.data,
        dataOriginal: formatarDataBR(dia.data),
        status,
        horarios: dia.realizado.match(/\d{2}:\d{2}/g) || [],
        observacao: dia.justificativa || undefined,
        revisao,
      }
    }),
  }
}

/**
 * Período coberto pelos espelhos: usa o cabeçalho (dd/mm/aaaa → ISO);
 * se nenhum cabeçalho tiver período, usa a menor/maior data dos dias.
 */
export function periodoDosEspelhos(espelhos: EspelhoColaborador[]): { inicio: string; fim: string } | null {
  const inicios: string[] = []
  const fins: string[] = []
  for (const e of espelhos) {
    const inicio = dataBRParaISO(e.periodoInicio)
    const fim = dataBRParaISO(e.periodoFim)
    if (inicio) inicios.push(inicio)
    if (fim) fins.push(fim)
  }
  if (inicios.length > 0 && fins.length > 0) {
    inicios.sort()
    fins.sort()
    return { inicio: inicios[0], fim: fins[fins.length - 1] }
  }
  const datas = espelhos.flatMap((e) => e.dias.map((d) => d.data)).sort()
  if (datas.length === 0) return null
  return { inicio: datas[0], fim: datas[datas.length - 1] }
}

/** Contadores por status para o resumo da pré-visualização. */
export function resumoPontoEspelho(ponto: PontoEspelho) {
  const trabalhou = ponto.dias.filter((d) => d.status === 'trabalhou').length
  const folga = ponto.dias.filter((d) => d.status === 'folga' || d.status === 'folga_substituicao').length
  const falta = ponto.dias.filter((d) => d.status === 'falta').length
  const ferias = ponto.dias.filter((d) => d.status === 'ferias').length
  const afastado = ponto.dias.filter((d) => d.status === 'afastado').length
  const revisao = ponto.dias.filter((d) => d.revisao).length
  return { trabalhou, folga, falta, ferias, afastado, revisao }
}
