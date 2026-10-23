// Lógica pura do módulo VT — Fase 2b, fechamento/reconciliação (decisão da
// gestora, 23/10/2026): depois do ponto fechado, cada dia PLANEJADO da carga
// (vt_cargas.detalhe com as datas por posto) é conferido no espelho de ponto
// real: faltou (qualquer motivo) → o dia é descontado na carga do mês
// seguinte (ajuste_centavos). O fechamento do mês CIVIL usa os espelhos que
// o cobrem (ponto fecha 20→19; cada período pode vir em vários pedaços). Dia
// sem linha no espelho = "não conferido": NUNCA desconta sem evidência.
//
// CRÉDITO (decisão da gestora, 23/10/2026 — "nem a mais, nem a menos"): dia
// que o espelho classifica como TRABALHADO e que não estava planejado em
// nenhum posto da carga (ex.: troca de plantão — folga na escala, trabalhou
// no ponto) é creditado na carga seguinte. Posto do crédito = o posto com
// MAIS dias planejados na carga do mês (empate → o primeiro do detalhe), ao
// custo/dia desse posto. Sem nenhum dia planejado não há posto de referência:
// o dia NÃO é creditado por palpite — fica como "trabalhou fora da carga, sem
// posto" para o RH conferir. Cada data é avaliada uma vez só (nunca credita
// o mesmo dia duas vezes).

import type { ClassificacaoDia, EspelhoColaborador } from '@/lib/ocorrencias/importacaoPonto'
import type { VtCargaDetalhe } from '@/types/vt'

/** Competência anterior ('2026-11' → '2026-10') — onde mora o fechamento que ajusta esta carga. */
export function competenciaAnterior(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const m = mes === 1 ? 12 : mes - 1
  const a = mes === 1 ? ano - 1 : ano
  return `${a}-${String(m).padStart(2, '0')}`
}

/** Mapa data → dia do espelho de ponto de UM colaborador. */
export type DiasEspelho = Map<string, { classificacao: ClassificacaoDia; categoria: string | null }>

/**
 * Extrai os dias do espelho que caem na competência (mês civil). O fechamento
 * do mês civil usa dois espelhos (ponto 20→19): o hook mescla os dois mapas.
 */
export function diasDoEspelho(espelho: EspelhoColaborador, competencia: string): DiasEspelho {
  const mapa: DiasEspelho = new Map()
  for (const d of espelho.dias) {
    if (!d.data.startsWith(competencia)) continue
    mapa.set(d.data, { classificacao: d.classificacao, categoria: d.categoria })
  }
  return mapa
}

export type ResultadoDiaFechamento = {
  data: string // 'AAAA-MM-DD'
  departamento_id: string
  posto: string
  custo_dia_centavos: number
  /**
   * 'trabalhou' | 'descontado' | 'nao_conferido' (dias planejados);
   * 'creditado' (trabalhou fora da carga, posto de referência);
   * 'fora_sem_posto' (trabalhou fora da carga, sem posto — conferir; nunca credita).
   */
  resultado: 'trabalhou' | 'descontado' | 'nao_conferido' | 'creditado' | 'fora_sem_posto'
  /** Texto do ponto para o motivo ("Falta", "Atestado", "sem linha no espelho"...). */
  evidencia: string
}

export interface FechamentoPosto {
  departamento_id: string
  posto: string
  custo_dia_centavos: number
  planejados: string[]
  trabalhados: string[]
  descontados: string[]
  /** Dias trabalhados no ponto fora da carga, creditados neste posto (o de referência). */
  creditados: string[]
}

export interface ResultadoFechamento {
  detalhe: FechamentoPosto[]
  diasDetalhe: ResultadoDiaFechamento[]
  diasPlanejados: number
  diasTrabalhados: number
  diasDescontados: number
  diasNaoConferidos: number
  /** Soma do custo/dia dos dias descontados (positivo; entra negativo na carga seguinte). */
  descontoCentavos: number
  /** Dias trabalhados no ponto que não estavam na carga, creditados no posto de referência. */
  diasCreditados: number
  /** Soma do custo/dia dos dias creditados (positivo; entra positivo na carga seguinte). */
  creditoCentavos: number
  /** Datas trabalhadas fora da carga SEM posto de referência — não creditadas, conferir. */
  diasForaSemPosto: string[]
}

/**
 * Posto de referência do crédito: o de MAIS dias planejados no mês (empate →
 * o primeiro na ordem do detalhe). Sem nenhum dia planejado → null (não
 * credita por palpite).
 */
export function postoDeReferencia(detalhe: VtCargaDetalhe[]): VtCargaDetalhe | null {
  let melhor: VtCargaDetalhe | null = null
  for (const p of detalhe) {
    const n = (p.datas ?? []).length
    if (n === 0) continue
    if (!melhor || n > (melhor.datas ?? []).length) melhor = p
  }
  return melhor
}

/**
 * Confere a carga de um colaborador contra o espelho de ponto.
 * Desconta quando o espelho prova que o dia planejado não foi trabalhado
 * (falta, atestado, folga/feriado/férias no ponto, afastado, suspensão...).
 * Dia sem linha ou com texto não reconhecido = não conferido (nunca desconta
 * sem evidência — aparece na tela para o RH decidir).
 */
export function conciliarCarga(detalhe: VtCargaDetalhe[], espelho: DiasEspelho): ResultadoFechamento {
  const detalhePostos: FechamentoPosto[] = []
  const diasDetalhe: ResultadoDiaFechamento[] = []
  let trabalhados = 0
  let descontados = 0
  let naoConferidos = 0
  let descontoCentavos = 0

  for (const p of detalhe) {
    const fech: FechamentoPosto = {
      departamento_id: p.departamento_id,
      posto: p.posto,
      custo_dia_centavos: p.custo_dia_centavos,
      planejados: [...(p.datas ?? [])],
      trabalhados: [],
      descontados: [],
      creditados: [],
    }
    for (const data of fech.planejados) {
      const dia = espelho.get(data)
      const base = {
        data,
        departamento_id: p.departamento_id,
        posto: p.posto,
        custo_dia_centavos: p.custo_dia_centavos,
      }
      if (!dia) {
        naoConferidos++
        diasDetalhe.push({ ...base, resultado: 'nao_conferido', evidencia: 'sem linha no espelho' })
        continue
      }
      if (dia.classificacao === 'trabalhado') {
        trabalhados++
        fech.trabalhados.push(data)
        diasDetalhe.push({ ...base, resultado: 'trabalhou', evidencia: 'ponto registrado' })
        continue
      }
      // 'outro' sem categoria = texto não reconhecido pelo parser — não é prova.
      const prova = dia.classificacao !== 'outro' || dia.categoria !== null
      if (!prova) {
        naoConferidos++
        diasDetalhe.push({ ...base, resultado: 'nao_conferido', evidencia: 'texto não reconhecido no espelho' })
        continue
      }
      descontados++
      descontoCentavos += p.custo_dia_centavos
      fech.descontados.push(data)
      diasDetalhe.push({ ...base, resultado: 'descontado', evidencia: dia.categoria ?? 'não trabalhado' })
    }
    detalhePostos.push(fech)
  }

  // Crédito: dias trabalhados no ponto que não estavam planejados em nenhum
  // posto. O Map do espelho tem uma entrada por data → cada dia uma vez só.
  const planejadas = new Set(detalhe.flatMap((p) => p.datas ?? []))
  const referencia = postoDeReferencia(detalhe)
  const fechReferencia = referencia
    ? detalhePostos.find((f) => f.departamento_id === referencia.departamento_id && f.posto === referencia.posto) ?? null
    : null
  let creditados = 0
  let creditoCentavos = 0
  const foraSemPosto: string[] = []
  const datasEspelho = [...espelho.keys()].sort()
  for (const data of datasEspelho) {
    if (planejadas.has(data)) continue
    if (espelho.get(data)?.classificacao !== 'trabalhado') continue
    if (!referencia || !fechReferencia) {
      foraSemPosto.push(data)
      diasDetalhe.push({
        data,
        departamento_id: '',
        posto: '—',
        custo_dia_centavos: 0,
        resultado: 'fora_sem_posto',
        evidencia: 'trabalhou fora da carga — sem posto, conferir',
      })
      continue
    }
    creditados++
    creditoCentavos += referencia.custo_dia_centavos
    fechReferencia.creditados.push(data)
    diasDetalhe.push({
      data,
      departamento_id: referencia.departamento_id,
      posto: referencia.posto,
      custo_dia_centavos: referencia.custo_dia_centavos,
      resultado: 'creditado',
      evidencia: 'ponto registrado fora da carga (ex.: troca de plantão)',
    })
  }

  return {
    detalhe: detalhePostos,
    diasDetalhe,
    diasPlanejados: trabalhados + descontados + naoConferidos,
    diasTrabalhados: trabalhados,
    diasDescontados: descontados,
    diasNaoConferidos: naoConferidos,
    descontoCentavos,
    diasCreditados: creditados,
    creditoCentavos,
    diasForaSemPosto: foraSemPosto,
  }
}

/**
 * Ajuste da carga seguinte a partir do fechamento: crédito − desconto (pode
 * ser positivo). Fechamento antigo sem crédito (coluna ausente) = 0.
 */
export function ajusteDoFechamento(f: { desconto_centavos?: number | null; credito_centavos?: number | null }): {
  ajuste: number
  desconto: number
  credito: number
} {
  const desconto = f.desconto_centavos ?? 0
  const credito = f.credito_centavos ?? 0
  return { ajuste: credito - desconto, desconto, credito }
}
