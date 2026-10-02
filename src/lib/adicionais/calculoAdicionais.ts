import type { ContratoAdicional, StatusDiaAdicional } from '@/types/adicionais'
import { parseDataLocal } from '@/lib/utils'

export function diaIntrajornada(contrato: ContratoAdicional | undefined | null, dataStr: string): boolean {
  if (!contrato || !contrato.adicionais?.intrajornada) return false
  if (!contrato.dias_intrajornada || contrato.dias_intrajornada.length === 0) return false

  const diaSemana = new Date(dataStr + 'T00:00:00').getDay()
  return contrato.dias_intrajornada.includes(diaSemana)
}

/** Previsão da escala (fallback): o vínculo trabalha nesse dia pelo regime? */
export function escaladoParaTrabalhar(regime: string | undefined, dataInicioVinculo: string | undefined, data: string): boolean {
  if (regime === '5x2') {
    const dia = new Date(data + 'T00:00:00').getDay()
    return dia >= 1 && dia <= 5
  }
  if (regime === 'personalizado') return true
  if (!dataInicioVinculo) return true
  const inicio = new Date(dataInicioVinculo + 'T00:00:00')
  const atual = new Date(data + 'T00:00:00')
  const diffDias = Math.round((atual.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
  // Módulo sempre positivo (02/10/2026): datas ANTES do início do vínculo
  // dão diff negativo, e `-1 % 7` = -1 (< 6) fazia todo dia anterior virar
  // "trabalhou" no 6x1.
  if (regime === '6x1') return moduloPositivo(diffDias, 7) < 6
  // 12x36 (padrão): dia sim, dia não
  return moduloPositivo(diffDias, 2) === 0
}

/** Resto da divisão sempre em [0, n) — também para dividendo negativo. */
export function moduloPositivo(valor: number, n: number): number {
  return ((valor % n) + n) % n
}

/** Status previsto pela escala (fallback quando não há lançamento no dia). */
export function statusPrevistoPelaEscala(regime: string | undefined, dataInicioVinculo: string | undefined, data: string): 'trabalhou' | 'folga' {
  return escaladoParaTrabalhar(regime, dataInicioVinculo, data) ? 'trabalhou' : 'folga'
}

/** Dias YYYY-MM-DD de `inicio` a `fim`, inclusive (datas locais, nunca UTC). */
export function gerarDiasDoPeriodo(inicio: string, fim: string): string[] {
  const dias: string[] = []
  const [ai, mi, di] = inicio.split('-').map(Number)
  const atual = new Date(ai, mi - 1, di)
  const [af, mf, df] = fim.split('-').map(Number)
  const dataFim = new Date(af, mf - 1, df)
  while (atual <= dataFim) {
    dias.push(`${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}-${String(atual.getDate()).padStart(2, '0')}`)
    atual.setDate(atual.getDate() + 1)
  }
  return dias
}

// ============================================================
// Proporcional ao vínculo — decisão da gestão, 02/10/2026
// ------------------------------------------------------------
// Vínculo que começa ou termina no meio do período (20→19) só conta os dias
// dentro de [data_inicio, data_fim]. Caso real: Carlos Alexandre (6x1,
// periculosidade), vínculo 03/09→19/09 no período 20/08→19/09: recebia 30
// e 25 trabalhados (dias antes da admissão inferidos pela escala); passa a
// 17 e 11. Só vale a data do VÍNCULO (não a data de admissão do cadastro).
// ============================================================

/** A data (YYYY-MM-DD) está dentro do vínculo? `data_fim` nulo = em aberto. */
export function dentroDoVinculo(
  data: string,
  vinculo: { data_inicio?: string | null; data_fim?: string | null }
): boolean {
  if (vinculo.data_inicio && data < vinculo.data_inicio) return false
  if (vinculo.data_fim && data > vinculo.data_fim) return false
  return true
}

/**
 * Dias do vínculo dentro do período, inclusive: de max(início do vínculo,
 * início do período) a min(fim do vínculo ?? fim do período, fim do período).
 * Zero quando não há sobreposição.
 */
export function diasDoVinculoNoPeriodo(
  inicioVinculo: string | null | undefined,
  fimVinculo: string | null | undefined,
  inicioPeriodo: string,
  fimPeriodo: string
): number {
  const de = inicioVinculo && inicioVinculo > inicioPeriodo ? inicioVinculo : inicioPeriodo
  const ate = fimVinculo && fimVinculo < fimPeriodo ? fimVinculo : fimPeriodo
  if (de > ate) return 0
  const utc = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number)
    return Date.UTC(a, m - 1, d)
  }
  return Math.round((utc(ate) - utc(de)) / 86400000) + 1
}

/** Teto do adicional mensal (dias). */
export const TETO_DIAS_ADICIONAL = 30

/**
 * Base de dias do titular no período: vínculo que cobre o período INTEIRO
 * vale 30 (como sempre — inclusive em período de 28 ou 31 dias); vínculo
 * parcial vale os dias dentro do período (o teto de 30 é aplicado em
 * adicionalTitular30).
 */
export function diasBaseAdicional(
  inicioVinculo: string | null | undefined,
  fimVinculo: string | null | undefined,
  inicioPeriodo: string,
  fimPeriodo: string
): number {
  const cobreInicio = !inicioVinculo || inicioVinculo <= inicioPeriodo
  const cobreFim = !fimVinculo || fimVinculo >= fimPeriodo
  if (cobreInicio && cobreFim) return TETO_DIAS_ADICIONAL
  return diasDoVinculoNoPeriodo(inicioVinculo, fimVinculo, inicioPeriodo, fimPeriodo)
}

/**
 * O dia exige substituto? (alerta "precisa de substituto" no calendário)
 * Falta e folga com substituição sempre exigem. Férias/afastado só exigem em
 * dia de ESCALA — na folga do 12×36 dentro das férias ninguém trabalha, e o
 * par já transfere pelo dia de escala coberto (caso Alcemir, 28/08/2026:
 * férias com substituto nos dias de escala ainda alertavam nas folgas).
 */
export function diaExigeSubstituto(
  status: StatusDiaAdicional,
  regime: string | undefined,
  dataInicioVinculo: string | undefined,
  data: string
): boolean {
  if (status === 'ferias' || status === 'afastado') {
    return escaladoParaTrabalhar(regime, dataInicioVinculo, data)
  }
  return status === 'falta' || status === 'folga_substituicao'
}

/**
 * Adicional de feriado (regra da gestão, 31/07/2026): conta APENAS os
 * feriados cadastrados em que o vínculo estava PREVISTO para trabalhar pela
 * escala. Quem trabalha no feriado sem estar escalado (substituto, cobertura
 * extra) NÃO recebe; e só vale para contratos com o flag `adicionais.feriado`.
 */
export function contarDiasFeriadoEscalado(
  regime: string | undefined,
  dataInicioVinculo: string | undefined,
  diasDoPeriodo: string[],
  datasFeriados: Set<string>
): number {
  let total = 0
  for (const data of diasDoPeriodo) {
    if (datasFeriados.has(data) && escaladoParaTrabalhar(regime, dataInicioVinculo, data)) total++
  }
  return total
}

// ============================================================
// Insalubridade e periculosidade — regra da gestão, 01/08/2026
// ------------------------------------------------------------
// TITULAR (qualquer escala):
//   - Trabalhou tudo → 30 dias.
//   - Faltou → 30 − faltas.
//   - Saiu de férias (ou afastado) com substituto cobrindo → os dias
//     cobertos saem da conta dele e vão para o substituto:
//     30 − faltas − dias transferidos. No 12×36 isso equivale a
//     "trabalhados + folgas" da parte ativa; nas demais escalas, aos dias
//     corridos da parte dele no mês.
//   Férias/afastado SEM substituto registrado não transferem dias
//   (o titular mantém 30 − faltas).
//   Vínculo parcial no período (02/10/2026): o 30 vira
//   min(30, dias do vínculo no período).
//
// SUBSTITUTO (linha criada só por cobertura, sem vínculo próprio):
//   - Insalubridade: todos os dias cobertos — faltas/folgas de
//     substituição E o bloco de férias/afastado (a "outra parte do mês").
//   - Periculosidade: APENAS os dias de férias/afastado cobertos;
//     cobertura de falta NÃO gera periculosidade.
//   - Cada dia coberto conta UMA vez (02/10/2026). Na implementação, a
//     folga com substituição entra junto com férias/afastado nos dias
//     transferidos (por isso também gera periculosidade ao substituto).
// ============================================================

/**
 * Adicional mensal do titular: min(30, dias do vínculo no período) − faltas −
 * dias transferidos ao substituto. `diasBase` padrão = 30 (vínculo cheio);
 * período de 31 ou 28 dias com vínculo cheio continua 30 (teto).
 */
export function adicionalTitular30(faltas: number, diasTransferidos = 0, diasBase: number = TETO_DIAS_ADICIONAL): number {
  return Math.max(0, Math.min(TETO_DIAS_ADICIONAL, diasBase) - faltas - diasTransferidos)
}

/**
 * Insalubridade do substituto: todos os dias cobertos, cada um UMA vez
 * (02/10/2026) — dias transferidos (férias/afastado/folga com substituição)
 * + faltas cobertas. Não passe a folga com substituição nos dois argumentos.
 */
export function insalubridadeSubstituto(diasTransferidos: number, diasFaltaCobertos: number): number {
  return diasTransferidos + diasFaltaCobertos
}

/** Periculosidade do substituto: somente os dias de férias/afastado cobertos. */
export function periculosidadeSubstituto(diasFeriasAfastado: number): number {
  return diasFeriasAfastado
}

/**
 * A substituição gera adicional para o substituto? Não quando marcada como
 * "sem adicional" (controle interno — decisão da gestão, 27/08/2026): o
 * substituto cobre o posto (ex.: pago via extra por fora), mas não recebe o
 * adicional nem aparece no relatório. O dia continua saindo da conta do
 * titular — os dias se perdem para ambos.
 */
export function substituicaoGeraAdicional(dia: {
  substituto_colaborador_id?: string | null
  substituto_sem_adicional?: boolean | null
}): boolean {
  return !!dia.substituto_colaborador_id && !dia.substituto_sem_adicional
}

/**
 * Limites do período de apuração de adicionais (dia 20 de um mês ao dia 19 do
 * seguinte). `mes` é o mês em que o período COMEÇA (1–12). Datas no formato
 * YYYY-MM-DD, construídas como data local (nunca UTC).
 */
export function limitesPeriodoAdicional(ano: number, mes: number): { inicio: string; fim: string } {
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { inicio: fmt(new Date(ano, mes - 1, 20)), fim: fmt(new Date(ano, mes, 19)) }
}

/**
 * Período (ano/mês de início, para `limitesPeriodoAdicional`) que contém a
 * data informada. Usa getters LOCAIS — combinar com `agoraBrasil()`, cujos
 * componentes locais refletem o horário de Brasília.
 */
export function periodoAdicionalDaData(data: Date): { ano: number; mes: number } {
  if (data.getDate() >= 20) return { ano: data.getFullYear(), mes: data.getMonth() + 1 }
  const anterior = new Date(data.getFullYear(), data.getMonth() - 1, 1)
  return { ano: anterior.getFullYear(), mes: anterior.getMonth() + 1 }
}

/**
 * Conta colaboradores únicos por contrato. O mesmo colaborador não pode ser
 * contado duas vezes só porque aparece em mais de um vínculo do mesmo
 * contrato em períodos diferentes.
 * Com `periodoInicio`/`periodoFim` (YYYY-MM-DD), só entram vínculos que se
 * sobrepõem ao período (inicio <= periodoFim && fim >= periodoInicio) — sem o
 * filtro, a contagem acumula o histórico de todos os períodos e induz ao erro
 * (ex.: contrato com 2 vagas mostrando 3/2 por causa de vínculo encerrado).
 */
export function contarVinculosUnicosPorContrato(
  vinculos: Array<{ contrato_id: string; colaborador_id: string; data_inicio?: string | null; data_fim?: string | null }>,
  periodoInicio?: string,
  periodoFim?: string
): Map<string, number> {
  const mapa = new Map<string, Set<string>>()

  for (const vinculo of vinculos) {
    if (!vinculo.contrato_id || !vinculo.colaborador_id) continue
    if (periodoInicio && periodoFim) {
      const inicio = vinculo.data_inicio || '1900-01-01'
      const fim = vinculo.data_fim || '9999-12-31'
      if (inicio > periodoFim || fim < periodoInicio) continue
    }
    const set = mapa.get(vinculo.contrato_id) ?? new Set<string>()
    set.add(vinculo.colaborador_id)
    mapa.set(vinculo.contrato_id, set)
  }

  return new Map(Array.from(mapa.entries()).map(([contratoId, ids]) => [contratoId, ids.size]))
}

/**
 * Máximo de colaboradores SIMULTÂNEOS por contrato em qualquer dia do período
 * (decisão da gestão, 02/10/2026). Base dos alertas "incompleto"/"excedente"
 * da tela Contratos: troca em sequência no mesmo posto (ex.: um sai 02/09, o
 * outro entra 03/09, contrato de 1 vaga) é 1 ao mesmo tempo — antes contava
 * 2 pessoas distintas e acusava "2/1 excedente". O mesmo colaborador com dois
 * vínculos sobrepostos no mesmo dia conta uma vez. Contrato sem vínculo no
 * período não aparece no mapa.
 */
export function contarMaxSimultaneosPorContrato(
  vinculos: Array<{ contrato_id: string; colaborador_id: string; data_inicio?: string | null; data_fim?: string | null }>,
  periodoInicio: string,
  periodoFim: string
): Map<string, number> {
  const porContrato = new Map<string, typeof vinculos>()
  for (const v of vinculos) {
    if (!v.contrato_id || !v.colaborador_id) continue
    const inicio = v.data_inicio || '1900-01-01'
    const fim = v.data_fim || '9999-12-31'
    if (inicio > periodoFim || fim < periodoInicio) continue
    const lista = porContrato.get(v.contrato_id) ?? []
    lista.push(v)
    porContrato.set(v.contrato_id, lista)
  }
  const dias = gerarDiasDoPeriodo(periodoInicio, periodoFim)
  const resultado = new Map<string, number>()
  porContrato.forEach((lista, contratoId) => {
    let maximo = 0
    for (const data of dias) {
      const presentes = new Set<string>()
      for (const v of lista) {
        if (dentroDoVinculo(data, v)) presentes.add(v.colaborador_id)
      }
      if (presentes.size > maximo) maximo = presentes.size
    }
    resultado.set(contratoId, maximo)
  })
  return resultado
}

/** Dia anterior (YYYY-MM-DD), em data local — nunca UTC. */
export function diaAnterior(iso: string): string {
  const d = parseDataLocal(iso)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type VinculoDoPosto = { id: string; colaborador_id: string; data_inicio?: string | null; data_fim?: string | null }

/**
 * Novo vínculo no posto: quem precisaria ser encerrado? (decisão da gestão,
 * 02/10/2026). Em D = data_inicio do novo vínculo, conta as pessoas distintas
 * ativas no contrato (mesma lógica de "simultâneos" da tela Contratos) mais a
 * nova. Se passar das vagas — ou, sem vagas definidas (0/nulo), se já houver
 * alguém ativo em D — devolve os vínculos que PODEM ser encerrados em D−1:
 * ativos em D (sem data_fim ou data_fim ≥ D) e com data_inicio < D (encerrar
 * em D−1 nunca deixa data_fim < data_inicio). A tela sempre pergunta; nunca
 * encerra sozinha. Lista vazia = nada a oferecer.
 */
export function vinculosQueConflitam<T extends VinculoDoPosto>(
  novo: { colaborador_id: string; data_inicio: string },
  vinculosDoContrato: T[],
  vagas: number | null | undefined
): T[] {
  const D = novo.data_inicio
  const ativosEmD = vinculosDoContrato.filter(v => dentroDoVinculo(D, v))
  const pessoas = new Set(ativosEmD.map(v => v.colaborador_id))
  pessoas.add(novo.colaborador_id)
  const excede = vagas && vagas > 0
    ? pessoas.size > vagas
    : ativosEmD.some(v => v.colaborador_id !== novo.colaborador_id)
  if (!excede) return []
  return ativosEmD.filter(v =>
    v.colaborador_id !== novo.colaborador_id && !!v.data_inicio && v.data_inicio < D
  )
}

/**
 * Dias de férias/afastado transferidos do titular para o substituto
 * (regra da gestão, 01/08/2026; ajuste fino em 03/08/2026):
 * - Demais escalas: cada dia com substituto registrado transfere (a "outra
 *   parte do mês" em dias corridos).
 * - 12×36: o adicional é pago em trabalhado + folga, e o par do 12×36 é
 *   (dia de escala, folga seguinte). Se o substituto trabalhou QUALQUER dia
 *   do par, o par inteiro transfere: dia de escala coberto transfere também
 *   a folga seguinte; folga coberta transfere também o dia de escala
 *   anterior (cada um, apenas se estiver no bloco de férias/afastado).
 *   O ritmo do substituto pode não coincidir com a escala do titular
 *   (caso Mariana/Marcelo, 03/08/2026: Marcelo trabalhou os dias ímpares do
 *   bloco + 04 e 07/07 — os 9 dias tocam os 9 pares → 18 transferidos →
 *   titular 12, substituto 18).
 * A entrada `dias` deve conter TODOS os dias de férias/afastado do vínculo
 * no período (com e sem substituto) — o dia pareado só transfere se
 * também estiver no bloco.
 */
export function contarDiasTransferidos(
  regime: string | undefined,
  dataInicioVinculo: string | undefined,
  dias: { data: string; comSubstituto: boolean }[]
): number {
  const datasNoBloco = new Set(dias.map(d => d.data))
  const transferidos = new Set<string>()
  const somar = (iso: string, n: number): string => {
    const d = new Date(iso + 'T00:00:00')
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  for (const dia of dias) {
    if (!dia.comSubstituto) continue
    transferidos.add(dia.data)
    // Par 12×36 (12x36 é o regime padrão quando indefinido)
    if (regime !== '12x36' && regime !== undefined) continue
    if (escaladoParaTrabalhar('12x36', dataInicioVinculo, dia.data)) {
      // Dia de escala coberto → transfere também a folga seguinte
      const prox = somar(dia.data, 1)
      if (datasNoBloco.has(prox)) transferidos.add(prox)
    } else {
      // Folga coberta → transfere também o dia de escala anterior do par
      const ant = somar(dia.data, -1)
      if (datasNoBloco.has(ant) && escaladoParaTrabalhar('12x36', dataInicioVinculo, ant)) {
        transferidos.add(ant)
      }
    }
  }
  return transferidos.size
}

