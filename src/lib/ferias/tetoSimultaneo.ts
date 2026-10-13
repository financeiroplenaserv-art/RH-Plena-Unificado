import type { FeriasRegra, FeriasSolicitacao, StatusSolicitacaoFerias } from '@/types/ferias'

// ============================================================
// Teto de ausência simultânea (RN-01)
// ------------------------------------------------------------
// Cada contrato (departamento) + função tolera no máximo
// max_simultaneos colaboradores de férias ao mesmo tempo. A regra
// específica (departamento+função) vale primeiro; sem ela, vale a
// global (NULL, NULL). O aviso é ÂMBAR e NÃO bloqueia — decisão do RH.
// ============================================================

/** Status que ocupam vaga no teto (férias confirmadas, em curso ou não). */
export const STATUS_OCUPAM_TETO: StatusSolicitacaoFerias[] = ['aprovada', 'em_andamento']

/** Sobreposição de intervalos de datas ISO (YYYY-MM-DD), pontas inclusas. */
export function periodosSeSobrepoem(aInicio: string, aFim: string, bInicio: string, bFim: string): boolean {
  return aInicio <= bFim && aFim >= bInicio
}

/** Regra aplicável ao par contrato+função: a exata, senão a global (NULL, NULL). */
export function resolverRegraTeto(
  regras: FeriasRegra[],
  departamentoId: string | null,
  funcaoId: string | null
): FeriasRegra | null {
  const exata = regras.find((r) => r.departamento_id === departamentoId && r.funcao_id === funcaoId)
  if (exata) return exata
  return regras.find((r) => r.departamento_id === null && r.funcao_id === null) ?? null
}

export interface AvaliacaoTeto {
  /** Teto aplicável (da regra específica ou da global; 1 quando não há regra) */
  maxSimultaneos: number
  /** Solicitações confirmadas que se sobrepõem ao período no mesmo contrato+função */
  conflitos: FeriasSolicitacao[]
  /** true quando o novo período faria o total de simultâneos passar do teto */
  excede: boolean
}

/**
 * Avalia o teto para um novo período: conta as solicitações confirmadas
 * (aprovada/em_andamento) do mesmo contrato+função que se sobrepõem às
 * datas. excede = já há maxSimultaneos (ou mais) ausentes no período.
 */
export function avaliarTetoSimultaneo(params: {
  regras: FeriasRegra[]
  solicitacoes: FeriasSolicitacao[]
  departamentoId: string | null
  funcaoId: string | null
  dataInicio: string
  dataFim: string
  /** Solicitação sendo reprogramada — não conta contra ela mesma */
  ignorarId?: string
}): AvaliacaoTeto {
  const { regras, solicitacoes, departamentoId, funcaoId, dataInicio, dataFim, ignorarId } = params
  const regra = resolverRegraTeto(regras, departamentoId, funcaoId)
  const maxSimultaneos = regra?.max_simultaneos ?? 1

  const conflitos = solicitacoes.filter(
    (s) =>
      s.id !== ignorarId &&
      STATUS_OCUPAM_TETO.includes(s.status) &&
      s.departamento_id === departamentoId &&
      s.funcao_id === funcaoId &&
      periodosSeSobrepoem(s.data_inicio, s.data_fim, dataInicio, dataFim)
  )

  return { maxSimultaneos, conflitos, excede: conflitos.length >= maxSimultaneos }
}
