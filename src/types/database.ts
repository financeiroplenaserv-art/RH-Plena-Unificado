import type { HistoricoImportacao } from '@/types/econtador'
import type {
  ContratoAdicional,
  VinculoAdicional,
  DiaCalendarioAdicional,
} from '@/types/adicionais'
import type { Extra, CategoriaExtra, ReciboExtra } from '@/types/extras'

export type NivelAcesso = 'admin' | 'rh' | 'gestor' | 'visualizador'
export type StatusColaborador = 'Ativo' | 'Inativo' | 'Afastado'
export type StatusOcorrencia = 'Pendente' | 'Ativa' | 'Resolvida' | 'Cancelada'

export interface Empresa {
  id: string
  nome: string
  cnpj: string | null
  codigo_alterdata: string | null
  created_at?: string
}

export interface Departamento {
  id: string
  nome: string
  nome_curto: string | null
  contato_portaria: string | null
  empresa_id: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  nome_contato: string | null
  telefone_contato: string | null
  email_contato: string | null
  nome_contato_2: string | null
  telefone_contato_2: string | null
  email_contato_2: string | null
  status: 'Ativo' | 'Inativo'
  created_at?: string
}

export interface Colaborador {
  id: string
  matricula: string
  nome_completo: string
  cpf: string | null
  rg: string | null
  ctps: string | null
  pis_pasep: string | null
  data_admissao: string | null
  data_demissao: string | null
  data_nascimento: string | null
  cargo: string | null
  departamento: string | null
  departamento_id: string | null
  email: string | null
  telefone: string | null
  celular: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  endereco: string | null
  status: StatusColaborador
  tipo_contrato: string | null
  empresa_id: string | null
  afastamento_motivo: string | null
  afastamento_data_inicio: string | null
  afastamento_data_fim: string | null
  dados_completos: Record<string, unknown>
  foto_url?: string | null
  tamanho_camisa?: string | null
  tamanho_calca?: string | null
  tamanho_calcado?: string | null
  created_at?: string
  updated_at?: string
}

export interface Perfil {
  id: string
  email: string | null
  nome: string | null
  nivel_acesso: NivelAcesso
  empresa_id: string | null
  created_at?: string
}

export interface Configuracao {
  chave: string
  valor: string
  descricao: string | null
  created_at?: string
  updated_at?: string
}

export interface Ocorrencia {
  id: string
  colaborador_id: string
  empresa_id: string | null
  colaborador_nome: string | null
  tipo_ocorrencia: string
  macro_grupo: string
  titulo: string | null
  data_ocorrencia: string
  descricao: string
  status: StatusOcorrencia
  tipo_penalidade: string | null
  base_legal: string | null
  gravidade: string | null
  data_hora_ocorrido: string | null
  local_ocorrido: string | null
  defesa_funcionario: string | null
  medida_corretiva: string | null
  prazo_acompanhamento: string | null
  testemunha_1_nome: string | null
  testemunha_1_cargo: string | null
  testemunha_2_nome: string | null
  testemunha_2_cargo: string | null
  usuario_id: string | null
  created_at?: string
  updated_at?: string

  // Relações populadas em selects
  colaborador?: Colaborador | null
  total_anexos?: number
  aprovacao_atual?: OcorrenciaAprovacao | null
  defesas?: OcorrenciaDefesa[]
}

export interface OcorrenciaAnexo {
  id: string
  ocorrencia_id: string
  nome_arquivo: string
  tipo_arquivo: string
  tamanho_bytes: number
  descricao: string | null
  caminho_storage: string
  url_publica: string | null
  usuario_id: string | null
  created_at?: string
}

export interface OcorrenciaTestemunha {
  id: string
  ocorrencia_id: string
  nome: string
  cargo: string | null
  departamento: string | null
  cpf: string | null
  usuario_id: string | null
  created_at?: string
}

export interface OcorrenciaAprovacao {
  id: string
  ocorrencia_id: string
  aprovador_id: string | null
  nivel: number
  status: 'pendente' | 'aprovado' | 'rejeitado'
  observacao: string | null
  created_at?: string
  updated_at?: string
}

export interface OcorrenciaDefesa {
  id: string
  ocorrencia_id: string
  texto: string
  data_defesa: string
  usuario_id: string | null
  created_at?: string
}

export interface Alerta {
  id: string
  tipo: string
  titulo: string
  descricao: string
  severidade: 'critica' | 'alta' | 'media' | 'baixa'
  status: 'ativo' | 'lido' | 'arquivado'
  data_vencimento: string | null
  colaborador_id: string | null
  empresa_id: string | null
  dados_json: Record<string, unknown>
  created_at?: string
  updated_at?: string

  // Relações
  colaborador?: Colaborador | null
}

export interface ModeloOcorrencia {
  id: string
  nome: string
  tipo: string
  texto_padrao: string
  macro_grupo: string | null
  created_at?: string
  updated_at?: string
}

export interface AuditoriaLog {
  id: string
  tabela: string
  registro_id: string
  acao: 'INSERT' | 'UPDATE' | 'DELETE' | 'CANCEL'
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  usuario_id: string | null
  created_at?: string
}

// Tipos para views/estatísticas
export interface RankingColaborador {
  id: string
  nome_completo: string
  matricula: string
  cargo: string | null
  departamento: string | null
  advertencias: number
  suspensoes: number
  faltas: number
  total_ocorrencias: number
}

export interface EstatisticaDepartamento {
  departamento: string
  total_colaboradores: number
  total_ocorrencias: number
  ocorrencias_pendentes: number
}

export interface OcorrenciaPorMes {
  mes: string
  mes_label: string
  ativas: number
  pendentes: number
  resolvidas: number
  total: number
}

export interface ProjetoVR {
  id: string
  nome: string
  data_corte: string
  data_efetivacao: string
  configuracao_json: Record<string, unknown>
  usuario_id: string
  created_at?: string
}

export interface ResultadoVR {
  id: string
  projeto_id: string
  colaborador_id: string | null
  nome: string | null
  cpf: string | null
  matricula: string | null
  dias_elegiveis: number
  dias_pdf: number
  dias_escala: number
  dias_abatimento: number
  valor_bruto: number
  extra: number
  detalhes_json: Record<string, unknown> | string[]
  created_at?: string
  updated_at?: string
}

export interface Fornecedor {
  id: string
  nome: string
  cnpj: string | null
  telefone: string | null
  email: string | null
  created_at?: string
}

export interface ItemCEU {
  id: string
  nome: string
  tipo: string
  ca: string | null
  validade: string | null
  subgrupo: string | null
  valor?: number | null
  fornecedor_id: string | null
  estoque?: number | null
  estoque_minimo?: number | null
  prazo_uso_dias?: number | null
  created_at?: string

  // Relações
  fornecedor?: Fornecedor | null
}

export interface EntregaCEU {
  id: string
  colaborador_id: string
  item_id: string
  data_entrega: string
  data_devolucao: string | null
  quantidade: number
  observacao: string | null
  usuario_id: string
  snapshot_item: Record<string, unknown>
  recibo_emitido?: boolean
  created_at?: string

  // Relações
  colaborador?: Colaborador | null
  item?: ItemCEU | null
}

export type Database = {
  public: {
    Tables: {
      empresas: {
        Row: Empresa & Record<string, unknown>
        Insert: Partial<Empresa> & Record<string, unknown>
        Update: Partial<Empresa> & Record<string, unknown>
        Relationships: []
      }
      departamentos: {
        Row: Departamento & Record<string, unknown>
        Insert: Partial<Departamento> & Record<string, unknown>
        Update: Partial<Departamento> & Record<string, unknown>
        Relationships: []
      }
      colaboradores: {
        Row: Colaborador & Record<string, unknown>
        Insert: Partial<Colaborador> & Record<string, unknown>
        Update: Partial<Colaborador> & Record<string, unknown>
        Relationships: []
      }
      perfis: {
        Row: Perfil & Record<string, unknown>
        Insert: Partial<Perfil> & Record<string, unknown>
        Update: Partial<Perfil> & Record<string, unknown>
        Relationships: []
      }
      configuracoes: {
        Row: Configuracao & Record<string, unknown>
        Insert: Partial<Configuracao> & Record<string, unknown>
        Update: Partial<Configuracao> & Record<string, unknown>
        Relationships: []
      }
      ocorrencias: {
        Row: Ocorrencia & Record<string, unknown>
        Insert: Partial<Ocorrencia> & Record<string, unknown>
        Update: Partial<Ocorrencia> & Record<string, unknown>
        Relationships: []
      }
      ocorrencia_anexos: {
        Row: OcorrenciaAnexo & Record<string, unknown>
        Insert: Partial<OcorrenciaAnexo> & Record<string, unknown>
        Update: Partial<OcorrenciaAnexo> & Record<string, unknown>
        Relationships: []
      }
      ocorrencia_testemunhas: {
        Row: OcorrenciaTestemunha & Record<string, unknown>
        Insert: Partial<OcorrenciaTestemunha> & Record<string, unknown>
        Update: Partial<OcorrenciaTestemunha> & Record<string, unknown>
        Relationships: []
      }
      ocorrencia_aprovacoes: {
        Row: OcorrenciaAprovacao & Record<string, unknown>
        Insert: Partial<OcorrenciaAprovacao> & Record<string, unknown>
        Update: Partial<OcorrenciaAprovacao> & Record<string, unknown>
        Relationships: []
      }
      ocorrencia_defesas: {
        Row: OcorrenciaDefesa & Record<string, unknown>
        Insert: Partial<OcorrenciaDefesa> & Record<string, unknown>
        Update: Partial<OcorrenciaDefesa> & Record<string, unknown>
        Relationships: []
      }
      alertas: {
        Row: Alerta & Record<string, unknown>
        Insert: Partial<Alerta> & Record<string, unknown>
        Update: Partial<Alerta> & Record<string, unknown>
        Relationships: []
      }
      modelos_ocorrencia: {
        Row: ModeloOcorrencia & Record<string, unknown>
        Insert: Partial<ModeloOcorrencia> & Record<string, unknown>
        Update: Partial<ModeloOcorrencia> & Record<string, unknown>
        Relationships: []
      }
      auditoria: {
        Row: AuditoriaLog & Record<string, unknown>
        Insert: Partial<AuditoriaLog> & Record<string, unknown>
        Update: Partial<AuditoriaLog> & Record<string, unknown>
        Relationships: []
      }
      log_auditoria: {
        Row: AuditoriaLog & Record<string, unknown>
        Insert: Partial<AuditoriaLog> & Record<string, unknown>
        Update: Partial<AuditoriaLog> & Record<string, unknown>
        Relationships: []
      }
      projetos_vr: {
        Row: ProjetoVR & Record<string, unknown>
        Insert: Partial<ProjetoVR> & Record<string, unknown>
        Update: Partial<ProjetoVR> & Record<string, unknown>
        Relationships: []
      }
      resultados_vr: {
        Row: ResultadoVR & Record<string, unknown>
        Insert: Partial<ResultadoVR> & Record<string, unknown>
        Update: Partial<ResultadoVR> & Record<string, unknown>
        Relationships: []
      }
      fornecedores: {
        Row: Fornecedor & Record<string, unknown>
        Insert: Partial<Fornecedor> & Record<string, unknown>
        Update: Partial<Fornecedor> & Record<string, unknown>
        Relationships: []
      }
      itens: {
        Row: ItemCEU & Record<string, unknown>
        Insert: Partial<ItemCEU> & Record<string, unknown>
        Update: Partial<ItemCEU> & Record<string, unknown>
        Relationships: []
      }
      entregas: {
        Row: EntregaCEU & Record<string, unknown>
        Insert: Partial<EntregaCEU> & Record<string, unknown>
        Update: Partial<EntregaCEU> & Record<string, unknown>
        Relationships: []
      }
      contratos_adicionais: {
        Row: ContratoAdicional & Record<string, unknown>
        Insert: Partial<ContratoAdicional> & Record<string, unknown>
        Update: Partial<ContratoAdicional> & Record<string, unknown>
        Relationships: []
      }
      vinculos_adicionais: {
        Row: VinculoAdicional & Record<string, unknown>
        Insert: Partial<VinculoAdicional> & Record<string, unknown>
        Update: Partial<VinculoAdicional> & Record<string, unknown>
        Relationships: []
      }
      calendario_adicionais: {
        Row: DiaCalendarioAdicional & Record<string, unknown>
        Insert: Partial<DiaCalendarioAdicional> & Record<string, unknown>
        Update: Partial<DiaCalendarioAdicional> & Record<string, unknown>
        Relationships: []
      }
      historico_importacoes_econtador: {
        Row: HistoricoImportacao & Record<string, unknown>
        Insert: Partial<HistoricoImportacao> & Record<string, unknown>
        Update: Partial<HistoricoImportacao> & Record<string, unknown>
        Relationships: []
      }
      extras: {
        Row: Extra & Record<string, unknown>
        Insert: Partial<Extra> & Record<string, unknown>
        Update: Partial<Extra> & Record<string, unknown>
        Relationships: []
      }
      categorias_extras: {
        Row: CategoriaExtra & Record<string, unknown>
        Insert: Partial<CategoriaExtra> & Record<string, unknown>
        Update: Partial<CategoriaExtra> & Record<string, unknown>
        Relationships: []
      }
      recibos_extras: {
        Row: ReciboExtra & Record<string, unknown>
        Insert: Partial<ReciboExtra> & Record<string, unknown>
        Update: Partial<ReciboExtra> & Record<string, unknown>
        Relationships: []
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Views: {}
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    Functions: {}
  }
}
