import type { ContratoAdicional } from '@/types/adicionais'

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
  const diffDias = Math.floor((atual.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
  if (regime === '6x1') return diffDias % 7 < 6
  // 12x36 (padrão): dia sim, dia não
  return diffDias % 2 === 0
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
//
// SUBSTITUTO (linha criada só por cobertura, sem vínculo próprio):
//   - Insalubridade: todos os dias cobertos — faltas/folgas de
//     substituição E o bloco de férias/afastado (a "outra parte do mês").
//   - Periculosidade: APENAS os dias de férias/afastado cobertos;
//     cobertura de falta NÃO gera periculosidade.
// ============================================================

/** Adicional mensal do titular: 30 − faltas − dias transferidos ao substituto. */
export function adicionalTitular30(faltas: number, diasTransferidos = 0): number {
  return Math.max(0, 30 - faltas - diasTransferidos)
}

/** Insalubridade do substituto: todos os dias cobertos (férias/afastado + falta/folga). */
export function insalubridadeSubstituto(diasFeriasAfastado: number, diasFaltaFolga: number): number {
  return diasFeriasAfastado + diasFaltaFolga
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
 * Conta colaboradores únicos por contrato no período. O mesmo colaborador não
 * pode ser contado duas vezes só porque aparece em mais de um vínculo do mesmo
 * contrato em períodos diferentes. A contagem deve refletir o momento atual da
 * tela/relatório e não o histórico acumulado de todos os períodos.
 */
export function contarVinculosUnicosPorContrato(
  vinculos: Array<{ contrato_id: string; colaborador_id: string }>
): Map<string, number> {
  const mapa = new Map<string, Set<string>>()

  for (const vinculo of vinculos) {
    if (!vinculo.contrato_id || !vinculo.colaborador_id) continue
    const set = mapa.get(vinculo.contrato_id) ?? new Set<string>()
    set.add(vinculo.colaborador_id)
    mapa.set(vinculo.contrato_id, set)
  }

  return new Map(Array.from(mapa.entries()).map(([contratoId, ids]) => [contratoId, ids.size]))
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

