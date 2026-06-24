import type { Colaborador } from './database'

export type StatusExtra = 'Pendente' | 'Pago' | 'Cancelado'

export type TurnoExtra =
  | 'Dia'
  | 'Manhã'
  | 'Tarde'
  | 'Noite'
  | 'Noite anterior'

export type CategoriaOcorrencia =
  | 'Limpeza'
  | 'Portaria'
  | 'Operacional'
  | 'Zelador'
  | 'Jardinagem'
  | 'Medidas disciplinares'
  | 'Outros'

export type MotivoExtra =
  | 'Atestado'
  | 'Falta sem justificativa'
  | 'Folga'
  | 'Férias'
  | 'Extra faturado'
  | 'Reforço estratégico'
  | 'Reforço faturado'
  | 'Limpeza interna'
  | 'Cobertura férias extra faturadas'
  | 'Outros'

export type ComunicacaoTipo = 'WhatsApp' | 'Email' | 'Não se aplica'

export interface CategoriaExtra {
  id: string
  nome: string
  valor_padrao: number
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export interface Extra {
  id: string
  data_ocorrencia: string
  turno: TurnoExtra
  categoria: CategoriaOcorrencia
  posto: string
  departamento_id: string | null
  departamento_nome: string | null
  colaborador_ausente_id: string | null
  colaborador_ausente_nome: string | null
  substituto_id: string | null
  substituto_nome: string | null
  motivo: MotivoExtra
  extra_faturado: boolean
  valor: number
  categoria_valor_id: string | null
  categoria_valor_nome: string | null
  comunicacao_tipo: ComunicacaoTipo | null
  comunicacao_data: string | null
  comunicacao_hora: string | null
  comunicacao_detalhes: string | null
  observacoes: string | null
  status: StatusExtra
  usuario_id: string | null
  empresa_id: string | null
  created_at?: string
  updated_at?: string

  // Relações
  colaborador_ausente?: Colaborador | null
  substituto?: Colaborador | null
}

export interface ExtrasFiltros {
  dataInicio?: string
  dataFim?: string
  colaboradorId?: string
  categoria?: CategoriaOcorrencia
  posto?: string
  status?: StatusExtra
  busca?: string
}
