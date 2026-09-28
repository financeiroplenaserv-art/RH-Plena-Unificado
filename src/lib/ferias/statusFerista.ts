import { hojeBrasil } from '@/lib/utils'
import type { FeriasAlocacao, FeriasSolicitacao } from '@/types/ferias'

// ============================================================
// Situação atual de um ferista (RN-02/RN-05)
// ------------------------------------------------------------
// Alocado  = alocação CONFIRMADA cobrindo hoje
// De férias = férias próprias (gozo/agendado, não cancelada) cobrindo
//             hoje — tem precedência: de férias ele não cobre ninguém
// Disponível = nenhum dos dois
// ============================================================

export type StatusFerista = 'alocado' | 'de_ferias' | 'disponivel'

export interface SituacaoFerista {
  status: StatusFerista
  /** Último dia do compromisso corrente (cobertura ou férias); null quando disponível agora */
  disponivelEm: string | null
  /** Alocação confirmada que cobre hoje (para mostrar onde está cobrindo) */
  alocacaoAtual: Pick<FeriasAlocacao, 'id' | 'solicitacao_id' | 'data_inicio' | 'data_fim'> | null
  /** Compromisso futuro mais próximo (alocação confirmada ou férias próprias) */
  proximoCompromisso: { inicio: string; fim: string } | null
}

type AlocacaoEntrada = Pick<FeriasAlocacao, 'id' | 'solicitacao_id' | 'data_inicio' | 'data_fim' | 'status'>
type FeriasEntrada = Pick<FeriasSolicitacao, 'id' | 'data_inicio' | 'data_fim' | 'tipo' | 'status'>

export function calcularSituacaoFerista(params: {
  alocacoes: AlocacaoEntrada[]
  ferias: FeriasEntrada[]
  /** YYYY-MM-DD; padrão = hoje (Brasília) */
  hoje?: string
}): SituacaoFerista {
  const hoje = params.hoje ?? hojeBrasil()
  const cobre = (c: { data_inicio: string; data_fim: string }) => c.data_inicio <= hoje && hoje <= c.data_fim

  const alocacoesConfirmadas = params.alocacoes.filter((a) => a.status === 'confirmada')
  const feriasProprias = params.ferias.filter(
    (s) => (s.tipo === 'gozo' || s.tipo === 'agendado') && s.status !== 'cancelada'
  )

  // Compromisso futuro mais próximo (alocação futura não muda o status atual)
  const futuro = [...alocacoesConfirmadas, ...feriasProprias]
    .filter((c) => c.data_inicio > hoje)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0]
  const proximoCompromisso = futuro ? { inicio: futuro.data_inicio, fim: futuro.data_fim } : null

  const feriasAtuais = feriasProprias.filter(cobre)
  if (feriasAtuais.length > 0) {
    const fim = feriasAtuais.map((f) => f.data_fim).sort()[feriasAtuais.length - 1]
    return { status: 'de_ferias', disponivelEm: fim, alocacaoAtual: null, proximoCompromisso }
  }

  const alocadasAtuais = alocacoesConfirmadas.filter(cobre)
  if (alocadasAtuais.length > 0) {
    const fimMaisTarde = [...alocadasAtuais].sort((a, b) => b.data_fim.localeCompare(a.data_fim))[0].data_fim
    const atual = [...alocadasAtuais].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0]
    return {
      status: 'alocado',
      disponivelEm: fimMaisTarde,
      alocacaoAtual: {
        id: atual.id,
        solicitacao_id: atual.solicitacao_id,
        data_inicio: atual.data_inicio,
        data_fim: atual.data_fim,
      },
      proximoCompromisso,
    }
  }

  return { status: 'disponivel', disponivelEm: null, alocacaoAtual: null, proximoCompromisso }
}
