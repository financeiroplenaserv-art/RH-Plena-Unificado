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
        Row: Empresa
        Insert: Partial<Empresa>
        Update: Partial<Empresa>
      }
      departamentos: {
        Row: Departamento
        Insert: Partial<Departamento>
        Update: Partial<Departamento>
      }
      colaboradores: {
        Row: Colaborador
        Insert: Partial<Colaborador>
        Update: Partial<Colaborador>
      }
      perfis: {
        Row: Perfil
        Insert: Partial<Perfil>
        Update: Partial<Perfil>
      }
      configuracoes: {
        Row: Configuracao
        Insert: Partial<Configuracao>
        Update: Partial<Configuracao>
      }
      ocorrencias: {
        Row: Ocorrencia
        Insert: Partial<Ocorrencia>
        Update: Partial<Ocorrencia>
      }
      ocorrencia_anexos: {
        Row: OcorrenciaAnexo
        Insert: Partial<OcorrenciaAnexo>
        Update: Partial<OcorrenciaAnexo>
      }
      ocorrencia_testemunhas: {
        Row: OcorrenciaTestemunha
        Insert: Partial<OcorrenciaTestemunha>
        Update: Partial<OcorrenciaTestemunha>
      }
      ocorrencia_aprovacoes: {
        Row: OcorrenciaAprovacao
        Insert: Partial<OcorrenciaAprovacao>
        Update: Partial<OcorrenciaAprovacao>
      }
      ocorrencia_defesas: {
        Row: OcorrenciaDefesa
        Insert: Partial<OcorrenciaDefesa>
        Update: Partial<OcorrenciaDefesa>
      }
      alertas: {
        Row: Alerta
        Insert: Partial<Alerta>
        Update: Partial<Alerta>
      }
      modelos_ocorrencia: {
        Row: ModeloOcorrencia
        Insert: Partial<ModeloOcorrencia>
        Update: Partial<ModeloOcorrencia>
      }
      auditoria: {
        Row: AuditoriaLog
        Insert: Partial<AuditoriaLog>
        Update: Partial<AuditoriaLog>
      }
      log_auditoria: {
        Row: AuditoriaLog
        Insert: Partial<AuditoriaLog>
        Update: Partial<AuditoriaLog>
      }
      projetos_vr: {
        Row: ProjetoVR
        Insert: Partial<ProjetoVR>
        Update: Partial<ProjetoVR>
      }
      resultados_vr: {
        Row: ResultadoVR
        Insert: Partial<ResultadoVR>
        Update: Partial<ResultadoVR>
      }
      fornecedores: {
        Row: Fornecedor
        Insert: Partial<Fornecedor>
        Update: Partial<Fornecedor>
      }
      itens: {
        Row: ItemCEU
        Insert: Partial<ItemCEU>
        Update: Partial<ItemCEU>
      }
      entregas: {
        Row: EntregaCEU
        Insert: Partial<EntregaCEU>
        Update: Partial<EntregaCEU>
      }
    }
  }
}
