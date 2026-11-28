// Calendário da escala do colaborador no pop-up da Carga do VT (pedido da
// gestora, 28/11/2026, opção "b"). Lógica pura: (1) converte os dias do
// relatório "Gestão de escalas" do Flit no formato guardado em vt_escala_dias
// (migration 178); (2) monta a grade do mês (semanas dom→sáb) e classifica cada
// dia; (3) monta a conta do rodapé, que bate com o valor final da linha do lote.
//
// Prioridade da classificação: o que o LOTE paga vence (linha do snapshot =
// dia que gera VT, inclusive cobertura sintetizada em folga do relatório);
// depois a marca do relatório; data ausente do relatório = "fora do relatório".

import type { DiaRelatorio } from '@/lib/vt/gestaoEscalasFlit'
import type { LinhaLoteCargaVT, TotalColaboradorLoteCargaVT } from '@/lib/vt/contratosLoteCarga'

/** Um dia guardado em vt_escala_dias.dias. Sem CPF nem nome. */
export interface DiaEscalaVt {
  /** 'T' | 'F' | 'FR' | 'AF' | 'AT' | '' (célula vazia) | texto cru (marca desconhecida). */
  marca: string
  /** Texto cru do Departamento (posto) do relatório. */
  local: string
  /** Horários da célula [T] (ex.: "07:00 - 19:00"), quando houver. */
  horario?: string
}

/** Mapa data 'AAAA-MM-DD' → dia. Data ausente = fora do relatório. */
export type DiasEscalaVt = Record<string, DiaEscalaVt>

/** Escala do relatório em memória (só quem está na tela de quem importou). */
export interface EscalaRelatorioVt {
  competencia: string
  nomeArquivo: string | null
  porColaborador: ReadonlyMap<string, DiasEscalaVt>
}

const SIGLA_DA_MARCA: Record<string, string> = {
  trabalha: 'T',
  folga: 'F',
  ferias: 'FR',
  afastado: 'AF',
  atestado: 'AT',
}

/** Dias do relatório (parser do Flit) → formato de vt_escala_dias. */
export function diasEscalaDoRelatorio(dias: readonly DiaRelatorio[], local: string): DiasEscalaVt {
  const saida: DiasEscalaVt = {}
  for (const d of dias) {
    const sigla = SIGLA_DA_MARCA[d.marca]
    const texto = (d.texto ?? '').trim()
    const marca = sigla ?? texto // vazio: '' ; marca desconhecida: texto cru
    const dia: DiaEscalaVt = { marca, local: local ?? '' }
    if (sigla === 'T') {
      const horario = texto.replace(/^\[T\]/i, '').trim()
      if (horario) dia.horario = horario
    }
    saida[d.data] = dia
  }
  return saida
}

/** Formato de dias válido vindo do banco (defensivo: jsonb pode ter lixo). */
export function lerDiasEscala(valor: unknown): DiasEscalaVt | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const saida: DiasEscalaVt = {}
  for (const [data, dia] of Object.entries(valor as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !dia || typeof dia !== 'object') continue
    const d = dia as Record<string, unknown>
    saida[data] = {
      marca: typeof d.marca === 'string' ? d.marca : '',
      local: typeof d.local === 'string' ? d.local : '',
      ...(typeof d.horario === 'string' && d.horario ? { horario: d.horario } : {}),
    }
  }
  return saida
}

export type TipoDiaEscala =
  | 'trabalho_vt'
  | 'treinamento'
  | 'trabalho_sem_vt'
  | 'folga'
  | 'ferias'
  | 'afastado'
  | 'atestado'
  | 'outro'
  | 'sem_registro'
  | 'fora_relatorio'
  | 'sem_detalhe'

export const ROTULO_TIPO_DIA: Record<TipoDiaEscala, string> = {
  trabalho_vt: 'Trabalho (gera VT)',
  treinamento: 'Treinamento (gera VT)',
  trabalho_sem_vt: 'Trabalho sem VT neste lote',
  folga: 'Folga',
  ferias: 'Férias',
  afastado: 'Afastado',
  atestado: 'Atestado',
  outro: 'Outra marca',
  sem_registro: 'Sem registro',
  fora_relatorio: 'Fora do relatório',
  sem_detalhe: 'Sem escala detalhada',
}

export interface DiaCalendarioEscala {
  data: string
  dia: number
  tipo: TipoDiaEscala
  /** Nome curto do posto do dia pago (verde/roxo). */
  posto: string | null
  custoDiaCentavos: number | null
  origemDia: LinhaLoteCargaVT['origemDia'] | null
  /** Marca crua do relatório (quando há). */
  marca: string | null
  horario: string | null
  /** Texto completo do dia — tooltip e aria-label. */
  descricao: string
}

export interface CalendarioEscala {
  /** Semanas dom→sáb; null = célula fora do mês. */
  semanas: (DiaCalendarioEscala | null)[][]
  temMarcas: boolean
  /** Tipos presentes (para a legenda mostrar só o que aparece). */
  tiposPresentes: TipoDiaEscala[]
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

function dataBR(data: string): string {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function centavosBR(c: number): string {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function classificarPorMarca(marca: string): TipoDiaEscala {
  switch (marca.toUpperCase()) {
    case 'T': return 'trabalho_sem_vt'
    case 'F': return 'folga'
    case 'FR': return 'ferias'
    case 'AF': return 'afastado'
    case 'AT': return 'atestado'
    case '': return 'sem_registro'
    default: return 'outro'
  }
}

export interface MontarCalendarioEntrada {
  competencia: string // 'AAAA-MM'
  /** Linhas do snapshot do lote DESTA pessoa. */
  linhasPagas: readonly Pick<LinhaLoteCargaVT, 'data' | 'departamentoId' | 'origemDia' | 'custoDiaCentavos'>[]
  /** Marcas do relatório (null = escala detalhada indisponível). */
  marcas: DiasEscalaVt | null
  nomePosto: (departamentoId: string) => string
}

export function montarCalendarioEscala({ competencia, linhasPagas, marcas, nomePosto }: MontarCalendarioEntrada): CalendarioEscala {
  const [ano, mes] = competencia.split('-').map(Number)
  const total = diasNoMes(ano, mes)
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  const pagas = new Map<string, MontarCalendarioEntrada['linhasPagas'][number]>()
  for (const l of linhasPagas) if (!pagas.has(l.data)) pagas.set(l.data, l)

  const celulas: (DiaCalendarioEscala | null)[] = Array.from({ length: primeiroDiaSemana }, () => null)
  const tipos = new Set<TipoDiaEscala>()
  for (let dia = 1; dia <= total; dia++) {
    const data = `${competencia}-${String(dia).padStart(2, '0')}`
    const paga = pagas.get(data)
    const marcaDia = marcas ? marcas[data] : undefined
    let tipo: TipoDiaEscala
    if (paga) tipo = paga.origemDia === 'treinamento' ? 'treinamento' : 'trabalho_vt'
    else if (!marcas) tipo = 'sem_detalhe'
    else if (!marcaDia) tipo = 'fora_relatorio'
    else tipo = classificarPorMarca(marcaDia.marca)
    tipos.add(tipo)

    const posto = paga ? nomePosto(paga.departamentoId) : null
    const semana = DIAS_SEMANA[(primeiroDiaSemana + dia - 1) % 7]
    const partes = [`${dataBR(data)} (${semana})`, ROTULO_TIPO_DIA[tipo]]
    if (tipo === 'outro' && marcaDia) partes.push(`marca "${marcaDia.marca}"`)
    if (posto) partes.push(`posto ${posto}`)
    if (paga?.origemDia === 'cobertura') partes.push('cobertura de férias')
    if (paga) partes.push(paga.custoDiaCentavos == null ? 'sem preço (pendência)' : `${centavosBR(paga.custoDiaCentavos)}/dia`)
    if (marcaDia?.horario) partes.push(marcaDia.horario)
    celulas.push({
      data,
      dia,
      tipo,
      posto,
      custoDiaCentavos: paga ? paga.custoDiaCentavos : null,
      origemDia: paga ? paga.origemDia : null,
      marca: marcaDia ? marcaDia.marca : null,
      horario: marcaDia?.horario ?? null,
      descricao: partes.join(' — '),
    })
  }
  while (celulas.length % 7 !== 0) celulas.push(null)
  const semanas: (DiaCalendarioEscala | null)[][] = []
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7))
  const ordem = Object.keys(ROTULO_TIPO_DIA) as TipoDiaEscala[]
  return { semanas, temMarcas: !!marcas, tiposPresentes: ordem.filter((t) => tipos.has(t)) }
}

export interface GrupoContaEscala {
  departamentoId: string
  posto: string
  dias: number
  custoDiaCentavos: number | null
  subtotalCentavos: number | null
}

export interface ContaEscala {
  grupos: GrupoContaEscala[]
  necessidadeCentavos: number
  ajusteFechamentoCentavos: number
  extraMensalCentavos: number
  valorFinalCentavos: number | null
  excedenteTruncadoCentavos: number
  /** Ex.: "3 dias × R$ 10,00 no posto A + 1 dia × R$ 12,00 no posto B = R$ 42,00". */
  texto: string
}

/** Conta do rodapé — agrupa por posto × custo/dia (o preço pode mudar no mês por vigência). */
export function contaDaEscala(
  linhasPagas: MontarCalendarioEntrada['linhasPagas'],
  total: Pick<TotalColaboradorLoteCargaVT, 'necessidadeCentavos' | 'ajusteCentavos' | 'valorCentavos' | 'excedenteTruncadoCentavos' | 'extraMensalCentavos'>,
  nomePosto: (departamentoId: string) => string,
): ContaEscala {
  const ordenadas = [...linhasPagas].sort((a, b) => a.data.localeCompare(b.data))
  const grupos = new Map<string, GrupoContaEscala>()
  for (const l of ordenadas) {
    const chave = `${l.departamentoId}|${l.custoDiaCentavos ?? 'null'}`
    const g = grupos.get(chave) ?? {
      departamentoId: l.departamentoId,
      posto: nomePosto(l.departamentoId),
      dias: 0,
      custoDiaCentavos: l.custoDiaCentavos,
      subtotalCentavos: l.custoDiaCentavos == null ? null : 0,
    }
    g.dias += 1
    if (g.subtotalCentavos != null && l.custoDiaCentavos != null) g.subtotalCentavos += l.custoDiaCentavos
    grupos.set(chave, g)
  }
  const lista = [...grupos.values()]
  const extra = total.extraMensalCentavos ?? 0
  const ajusteFechamento = total.ajusteCentavos - extra
  const termos = lista.map((g) => {
    const dias = `${g.dias} ${g.dias === 1 ? 'dia' : 'dias'}`
    return g.custoDiaCentavos == null
      ? `${dias} sem preço no posto ${g.posto}`
      : `${dias} × ${centavosBR(g.custoDiaCentavos)} no posto ${g.posto}`
  })
  const texto = termos.length > 0
    ? `${termos.join(' + ')} = ${centavosBR(total.necessidadeCentavos)}`
    : `Nenhum dia de trabalho com VT = ${centavosBR(0)}`
  return {
    grupos: lista,
    necessidadeCentavos: total.necessidadeCentavos,
    ajusteFechamentoCentavos: ajusteFechamento,
    extraMensalCentavos: extra,
    valorFinalCentavos: total.valorCentavos,
    excedenteTruncadoCentavos: total.excedenteTruncadoCentavos ?? 0,
    texto,
  }
}
