import type { Colaborador } from '@/types/database'

// ============================================================
// Tipos do módulo Férias completo (migração 112)
// ------------------------------------------------------------
// Espelham as tabelas ferias_funcoes, ferias_solicitacoes,
// ferias_feristas, ferias_alocacoes e ferias_regras. A tabela
// legada ferias_periodos (tipos FeriasPeriodo/FeriasNotificacao
// em database.ts) permanece até a troca das páginas antigas.
// ============================================================

export type TipoFerias = 'gozo' | 'agendado' | 'previsto'
export type StatusSolicitacaoFerias = 'pendente' | 'aprovada' | 'em_andamento' | 'concluida' | 'cancelada'
export type OrigemSolicitacaoFerias = 'flit' | 'manual' | 'econtador'
export type StatusAlocacaoFerias = 'sugerida' | 'confirmada' | 'cancelada'
export type OrigemAlocacaoFerias = 'automatica' | 'manual'

/** Catálogo de funções operacionais: cobertura explícita via cobre_funcoes (RN-02.3). */
export interface FeriasFuncao {
  id: string
  nome: string
  /** Desempate/exibição — NÃO decide elegibilidade (decisão da gestão, 25/09/2026, migration 113) */
  nivel: number
  /** Ids das funções que esta função pode cobrir (além dela mesma, implícito) */
  cobre_funcoes: string[]
  aliases: string[]
  ativo: boolean
  created_at?: string
  updated_at?: string
}

/** Solicitação/período de férias com workflow (substitui ferias_periodos). */
export interface FeriasSolicitacao {
  id: string
  colaborador_id: string
  departamento_id: string | null
  funcao_id: string | null
  data_inicio: string
  data_fim: string
  tipo: TipoFerias
  status: StatusSolicitacaoFerias
  dias_abono: number
  adiantamento_13: boolean
  parcelada: boolean
  origem: OrigemSolicitacaoFerias
  observacao: string | null
  ferista_alocado_id: string | null
  origem_alocacao: OrigemAlocacaoFerias | null
  /** true = período pedido pelo próprio colaborador (registrado pelo RH) — prioridade na aprovação e o plano automático não mexe */
  pedido_colaborador: boolean
  registrado_por: string | null
  aprovado_por: string | null
  data_aprovacao: string | null
  created_at?: string
  updated_at?: string
  colaborador?: Pick<Colaborador, 'id' | 'nome_completo' | 'matricula' | 'departamento' | 'data_admissao' | 'status' | 'cargo' | 'departamento_id'> | null
  /** Nome do ferista alocado (join de ferista_alocado_id → colaboradores) */
  ferista?: Pick<Colaborador, 'id' | 'nome_completo' | 'matricula'> | null
}

/** Carteira de feristas (quem cobre férias — RN-02). */
export interface FeriasFerista {
  id: string
  colaborador_id: string
  funcao_id: string | null
  max_dias_consecutivos: number
  max_coberturas_mes: number
  ativo: boolean
  observacao: string | null
  created_at?: string
  updated_at?: string
  colaborador?: Pick<Colaborador, 'id' | 'nome_completo' | 'matricula' | 'cargo' | 'status' | 'departamento_id'> | null
  /** Função principal do ferista (join de funcao_id → ferias_funcoes) */
  funcao?: Pick<FeriasFuncao, 'id' | 'nome' | 'nivel'> | null
}

/** Cobertura de férias por ferista, sugerida ou manual (RN-10). */
export interface FeriasAlocacao {
  id: string
  solicitacao_id: string
  ferista_id: string
  departamento_id: string | null
  funcao_id: string | null
  data_inicio: string
  data_fim: string
  status: StatusAlocacaoFerias
  origem: OrigemAlocacaoFerias
  score: number | null
  motivo: string | null
  usuario_id: string | null
  created_at?: string
  updated_at?: string
}

/** Teto de ausência simultânea por contrato+função (RN-01). */
export interface FeriasRegra {
  id: string
  departamento_id: string | null
  funcao_id: string | null
  max_simultaneos: number
  created_at?: string
  updated_at?: string
}

/** Alocação com a solicitação (e o colaborador de férias) embutida — usada na ficha do ferista. */
export interface FeriasAlocacaoComSolicitacao extends FeriasAlocacao {
  solicitacao?: (Pick<FeriasSolicitacao, 'id' | 'departamento_id' | 'data_inicio' | 'data_fim' | 'tipo' | 'status'> & {
    colaborador?: Pick<Colaborador, 'id' | 'nome_completo' | 'matricula'> | null
  }) | null
}
