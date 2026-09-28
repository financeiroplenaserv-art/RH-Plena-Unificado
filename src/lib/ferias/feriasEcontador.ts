import type { FeriasSolicitacao, StatusSolicitacaoFerias } from '@/types/ferias'

// ============================================================
// Férias em andamento vindas do e-Contador (Alterdata)
// ------------------------------------------------------------
// O GET /funcionarios devolve afastamentodescricao ('Férias'),
// afastamento (início) e retorno (fim). A regra de decisão
// (dedup/status/datas) vive AQUI — a Edge Function sync-econtador
// espelha esta lógica em Deno (não importa src/); ao alterar,
// sincronizar os dois lados.
// NUNCA tocar registros origem 'manual'/'flit': o dedup só casa
// origem='econtador' — férias lançadas pelo RH não são sobrescritas.
// ============================================================

/** Sem retorno na API: fim = início + 29 dias (30 dias de gozo, padrão CLT). */
const DIAS_GOZO_PADRAO = 29

export const OBS_ECONTADOR = 'Importado do e-Contador (férias em andamento)'
export const OBS_ECONTADOR_FIM_ESTIMADO = 'Importado do e-Contador (férias em andamento) — fim estimado: confirmar com o DP'

export interface PeriodoFeriasEcontador {
  data_inicio: string // YYYY-MM-DD
  data_fim: string // YYYY-MM-DD
  /** true quando a API não informou o retorno — fim estimado (início + 29) */
  fimEstimado: boolean
}

function dataDe(iso: string | null | undefined): string | null {
  if (!iso) return null
  return iso.split('T')[0]
}

function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia + dias)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/**
 * Extrai o período de férias do funcionário do e-Contador.
 * null quando não está de férias ou quando falta a data de início.
 * Sem retorno: fim estimado = início + 29 dias (observacao avisa o DP).
 */
export function extrairPeriodoFeriasEcontador(entrada: {
  afastamentodescricao: string | null
  afastamento: string | null
  retorno: string | null
}): PeriodoFeriasEcontador | null {
  if (entrada.afastamentodescricao !== 'Férias') return null
  const inicio = dataDe(entrada.afastamento)
  if (!inicio) return null
  const retorno = dataDe(entrada.retorno)
  if (retorno) return { data_inicio: inicio, data_fim: retorno, fimEstimado: false }
  return { data_inicio: inicio, data_fim: somarDias(inicio, DIAS_GOZO_PADRAO), fimEstimado: true }
}

/** Status do workflow derivado das datas vs hoje (gozo importado). */
export function statusFeriasPorData(inicio: string, fim: string, hoje: string): StatusSolicitacaoFerias {
  if (fim < hoje) return 'concluida'
  if (inicio <= hoje) return 'em_andamento'
  return 'aprovada'
}

export interface DadosSincronizacaoFerias {
  data_inicio: string
  data_fim: string
  status: StatusSolicitacaoFerias
  observacao: string
}

export type DecisaoSincronizacaoFerias =
  | { acao: 'inserir'; dados: DadosSincronizacaoFerias }
  | { acao: 'atualizar'; dados: DadosSincronizacaoFerias }
  | { acao: 'ignorar' }

/**
 * Dedup por (colaborador, origem='econtador', data_inicio): sem registro →
 * inserir; com registro e fim/status diferentes → atualizar; igual → ignorar.
 */
export function decidirSincronizacaoFerias(
  periodo: PeriodoFeriasEcontador,
  existente: Pick<FeriasSolicitacao, 'id' | 'data_fim' | 'status'> | null,
  hoje: string
): DecisaoSincronizacaoFerias {
  const dados: DadosSincronizacaoFerias = {
    data_inicio: periodo.data_inicio,
    data_fim: periodo.data_fim,
    status: statusFeriasPorData(periodo.data_inicio, periodo.data_fim, hoje),
    observacao: periodo.fimEstimado ? OBS_ECONTADOR_FIM_ESTIMADO : OBS_ECONTADOR,
  }
  if (!existente) return { acao: 'inserir', dados }
  if (existente.data_fim !== dados.data_fim || existente.status !== dados.status) {
    return { acao: 'atualizar', dados }
  }
  return { acao: 'ignorar' }
}
