export type AdicionalTipo = 'insalubridade' | 'noturno' | 'periculosidade' | 'feriado' | 'intrajornada'

export interface AdicionaisConfig {
  insalubridade: boolean
  noturno: boolean
  periculosidade: boolean
  feriado: boolean
  intrajornada: boolean
}

export interface ContratoAdicional {
  id: string
  nome: string
  departamento_id: string | null
  departamento_nome?: string
  quantidade_colaboradores: number
  adicionais: AdicionaisConfig
  dias_intrajornada: number[] // 0=dom, 1=seg, ..., 6=sab, 7=feriado
  created_at?: string
  updated_at?: string
}

export interface VinculoAdicional {
  id: string
  contrato_id: string
  contrato_nome?: string
  colaborador_id: string
  colaborador_nome?: string
  colaborador_matricula?: string
  adicionais?: AdicionalTipo[]
  data_inicio: string
  data_fim: string
  created_at?: string
}

export type StatusDiaAdicional = 'trabalhou' | 'falta' | 'ferias' | 'afastado' | 'folga' | 'folga_substituicao'

export interface DiaCalendarioAdicional {
  id?: string
  vinculo_id: string
  data: string
  status: StatusDiaAdicional
  intrajornada: boolean
  substituto_colaborador_id?: string | null
  substituto_colaborador_nome?: string | null
  created_at?: string
  updated_at?: string
}

export interface RelatorioAdicionalLinha {
  colaborador_id: string
  colaborador_nome: string
  contrato_id: string
  contrato_nome: string
  departamento: string
  adicional: string
  dia?: string
  status?: string
  observacao?: string
  dias_trabalhados: number
  dias_intrajornada: number
}
