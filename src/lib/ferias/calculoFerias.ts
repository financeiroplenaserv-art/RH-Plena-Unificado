// ============================================================
// Cálculo da situação de férias (regra CLT simplificada)
// ------------------------------------------------------------
// Período aquisitivo: 12 meses a partir da admissão (e de cada aniversário).
// Período concessivo: 12 meses seguintes ao fim do aquisitivo — é o limite
// legal para o colaborador gozar as férias daquele ciclo.
// Um gozo cobre o aquisitivo cujo fim está dentro dos 12 meses anteriores
// ao fim do gozo. O limite exibido refere-se ao aquisitivo mais antigo
// ainda não coberto.
// ============================================================

/** Dias de antecedência para alertar "A vencer" antes do limite concessivo. */
export const DIAS_ALERTA_VENCIMENTO = 60

export type SituacaoFerias = 'Em gozo' | 'Agendado' | 'Previsto' | 'Vencido' | 'A vencer' | 'Em dia' | 'Sem dados'

export interface PeriodoSimples {
  tipo: 'gozo' | 'agendado' | 'previsto'
  data_inicio: string // YYYY-MM-DD
  data_fim: string // YYYY-MM-DD
}

export interface ResumoFerias {
  situacao: SituacaoFerias
  /** Limite legal (YYYY-MM-DD) para gozar o aquisitivo mais antigo não coberto */
  limiteConcessivo: string | null
  ultimoGozo: { inicio: string; fim: string } | null
  proximoAgendado: { inicio: string; fim: string } | null
  /** Previsão de férias lançada pelo RH (ainda não confirmada no Alterdata) */
  proximaPrevisao: { inicio: string; fim: string } | null
}

function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function paraISO(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function addAnos(data: Date, anos: number): Date {
  return new Date(data.getFullYear() + anos, data.getMonth(), data.getDate())
}

/** Aniversários completos da admissão até a data informada. */
function anosCompletos(admissao: Date, ate: Date): number {
  let anos = ate.getFullYear() - admissao.getFullYear()
  const aniversarioNoAno = new Date(ate.getFullYear(), admissao.getMonth(), admissao.getDate())
  if (ate < aniversarioNoAno) anos -= 1
  return anos
}

/**
 * Limite concessivo (YYYY-MM-DD) do aquisitivo mais antigo ainda não coberto
 * por um gozo. Retorna null quando não é possível calcular.
 */
export function calcularLimiteConcessivo(
  dataAdmissao: string | null,
  ultimoGozoFim: string | null
): string | null {
  if (!dataAdmissao) return null
  const admissao = paraData(dataAdmissao)
  if (isNaN(admissao.getTime())) return null

  // Fim do primeiro período aquisitivo (admissão + 12 meses - 1 dia)
  const fimPrimeiroAquisitivo = new Date(addAnos(admissao, 1).getTime() - 24 * 60 * 60 * 1000)

  if (!ultimoGozoFim) {
    // Nunca gozou: o aquisitivo mais antigo não coberto é o primeiro
    return paraISO(addAnos(fimPrimeiroAquisitivo, 1))
  }

  const fimGozo = paraData(ultimoGozoFim)
  const k = anosCompletos(admissao, fimGozo)

  // Aquisitivo coberto pelo gozo: o maior fim de aquisitivo dentro dos 12
  // meses anteriores ao fim do gozo.
  let coberto: Date | null = null
  if (k >= 1) {
    const candidato = new Date(addAnos(admissao, k).getTime() - 24 * 60 * 60 * 1000)
    const janelaInicio = addAnos(fimGozo, -1)
    if (candidato >= janelaInicio && candidato <= fimGozo) {
      coberto = candidato
    }
  }

  // Sem cobertura identificada: limite do primeiro aquisitivo (já vencido).
  // Com cobertura: limite do aquisitivo seguinte ao coberto.
  const naoCoberto = coberto ? addAnos(coberto, 1) : fimPrimeiroAquisitivo
  return paraISO(addAnos(naoCoberto, 1))
}

/** Consolida a situação de férias de um colaborador para a Visão geral. */
export function resumirFerias(
  dataAdmissao: string | null,
  periodos: PeriodoSimples[],
  hoje: Date = new Date()
): ResumoFerias {
  const hojeISO = paraISO(hoje)

  const gozos = periodos.filter((p) => p.tipo === 'gozo')
  const ultimoGozo = gozos.reduce<PeriodoSimples | null>(
    (maior, p) => (maior === null || p.data_fim > maior.data_fim ? p : maior),
    null
  )
  const agendados = periodos
    .filter((p) => p.tipo === 'agendado' && p.data_fim >= hojeISO)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
  const proximoAgendado = agendados[0] ?? null

  const previsoes = periodos
    .filter((p) => p.tipo === 'previsto' && p.data_fim >= hojeISO)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
  const proximaPrevisao = previsoes[0] ?? null

  const resumoBase = {
    ultimoGozo: ultimoGozo ? { inicio: ultimoGozo.data_inicio, fim: ultimoGozo.data_fim } : null,
    proximoAgendado: proximoAgendado ? { inicio: proximoAgendado.data_inicio, fim: proximoAgendado.data_fim } : null,
    proximaPrevisao: proximaPrevisao ? { inicio: proximaPrevisao.data_inicio, fim: proximaPrevisao.data_fim } : null,
  }

  // Em gozo hoje (vale apenas para período confirmado: gozo ou agendado)
  const emGozo = periodos.some(
    (p) => p.tipo !== 'previsto' && p.data_inicio <= hojeISO && hojeISO <= p.data_fim
  )
  if (emGozo) {
    return {
      ...resumoBase,
      situacao: 'Em gozo',
      limiteConcessivo: calcularLimiteConcessivo(dataAdmissao, ultimoGozo?.data_fim ?? null),
    }
  }

  if (proximoAgendado && proximoAgendado.data_inicio > hojeISO) {
    return {
      ...resumoBase,
      situacao: 'Agendado',
      limiteConcessivo: calcularLimiteConcessivo(dataAdmissao, ultimoGozo?.data_fim ?? null),
    }
  }

  // Previsão do RH (planejamento ainda não confirmado no Alterdata)
  if (proximaPrevisao) {
    return {
      ...resumoBase,
      situacao: 'Previsto',
      limiteConcessivo: calcularLimiteConcessivo(dataAdmissao, ultimoGozo?.data_fim ?? null),
    }
  }

  if (!dataAdmissao) {
    return { ...resumoBase, situacao: 'Sem dados', limiteConcessivo: null }
  }

  const limite = calcularLimiteConcessivo(dataAdmissao, ultimoGozo?.data_fim ?? null)
  if (!limite) {
    return { ...resumoBase, situacao: 'Sem dados', limiteConcessivo: null }
  }

  if (limite < hojeISO) {
    return { ...resumoBase, situacao: 'Vencido', limiteConcessivo: limite }
  }

  const dataAlerta = new Date(hoje.getTime() + DIAS_ALERTA_VENCIMENTO * 24 * 60 * 60 * 1000)
  if (limite <= paraISO(dataAlerta)) {
    return { ...resumoBase, situacao: 'A vencer', limiteConcessivo: limite }
  }

  return { ...resumoBase, situacao: 'Em dia', limiteConcessivo: limite }
}
