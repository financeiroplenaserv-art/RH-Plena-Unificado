import { hojeBrasil, parseDataLocal } from '@/lib/utils'

// Datas do módulo Materiais. Tudo em 'AAAA-MM-DD' (colunas `date`); "hoje" vem
// de hojeBrasil() (horário de Brasília), nunca do relógio do aparelho.

/** 1º dia do mês da data (competência do pedido). */
export function competenciaDe(data: string): string {
  return data.slice(0, 7) + '-01'
}

/** Soma meses à data, limitando o dia ao último do mês de destino. */
export function adicionarMeses(data: string, meses: number): string {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  const total = a * 12 + (m - 1) + meses
  const ano = Math.floor(total / 12)
  const mes = (total % 12) + 1
  const ultimo = new Date(ano, mes, 0).getDate()
  const dia = Math.min(d, ultimo)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Últimos `n` meses FECHADOS (exclui o mês corrente), do mais antigo para o
 * mais recente, como competências (1º dia do mês).
 */
export function mesesFechados(hoje: string, n: number): string[] {
  const atual = competenciaDe(hoje)
  const lista: string[] = []
  for (let i = n; i >= 1; i--) lista.push(adicionarMeses(atual, -i))
  return lista
}

/** Dias corridos de `de` até `ate` (negativo se `ate` é anterior). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((parseDataLocal(ate).getTime() - parseDataLocal(de).getTime()) / 86400000)
}

export type NivelAvisoPrazo = 'normal' | 'ambar' | 'vermelho'

export interface JanelaPedido {
  competencia: string
  dia: number
  diaLimite: number
  diaAviso: number
  /** Último dia do prazo (dia limite do mês corrente). */
  prazo: string
  /** Hoje está entre o dia 1 e o dia limite. */
  dentroDoPrazo: boolean
  /** Link aberto fora do prazo por reabertura do escritório. */
  reaberta: boolean
  /** O link aceita envio hoje (dentro do prazo ou reaberto). */
  aberta: boolean
  /** Dias até o prazo (0 no último dia; negativo depois). */
  diasParaPrazo: number
  /** normal até o dia de aviso; âmbar do dia de aviso ao limite; vermelho depois. */
  nivelAviso: NivelAvisoPrazo
}

/**
 * Janela do pedido mensal (dia 1 ao dia 15 por padrão; aviso a partir do dia
 * configurável em materiais_config). `reabertoAte` é a data até a qual o
 * escritório liberou o link (mat_reaberturas).
 */
export function janelaPedido(
  opts: { hoje?: string; diaLimite?: number; diaAviso?: number; reabertoAte?: string | null } = {}
): JanelaPedido {
  const hoje = opts.hoje ?? hojeBrasil()
  const diaLimite = opts.diaLimite ?? 15
  const diaAviso = opts.diaAviso ?? 10
  const competencia = competenciaDe(hoje)
  const dia = parseDataLocal(hoje).getDate()
  const prazo = `${competencia.slice(0, 8)}${String(diaLimite).padStart(2, '0')}`
  const dentroDoPrazo = dia <= diaLimite
  const reaberta = !dentroDoPrazo && !!opts.reabertoAte && opts.reabertoAte >= hoje
  const nivelAviso: NivelAvisoPrazo = dia > diaLimite ? 'vermelho' : dia >= diaAviso ? 'ambar' : 'normal'
  return {
    competencia,
    dia,
    diaLimite,
    diaAviso,
    prazo,
    dentroDoPrazo,
    reaberta,
    aberta: dentroDoPrazo || reaberta,
    diasParaPrazo: diaLimite - dia,
    nivelAviso,
  }
}
