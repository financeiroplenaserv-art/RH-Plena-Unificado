/**
 * Tipos do domínio Vale Refeição (VR).
 * Prefixo VR evita conflito com os tipos mestres da plataforma (ex: Colaborador).
 */

export interface VRColaborador {
  cpf: string
  nome: string
  cargo: string
  matricula?: string
}

export interface VRRegistroPonto {
  data: string // formato: dd/mm/yy
  horasTrabalhadas: string // hh:mm
  tipo: 'trabalhado' | 'folga' | 'falta' | 'ferias' | 'suspensao' | 'outro'
}

export interface VRColaboradorPonto {
  colaborador: VRColaborador
  registros: VRRegistroPonto[]
}

export interface VREscalaDia {
  data: string // dd/mm/yyyy
  tipo: 'T' | 'F' | 'FR' | 'AF' | 'AT' | ''
  minutosTrabalhados: number
}

export interface VRColaboradorEscala {
  colaborador: VRColaborador
  dias: VREscalaDia[]
}

export interface VRDadosEmpresa {
  razaoSocial?: string
  tipoLogradouro?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
  nomeInterlocutor?: string
  nomeImpressaoCartao?: string
  codLocalEntrega?: string
  nomeLocalEntrega?: string
}

export interface VRConfiguracao {
  valorVR: number
  descontoPercentual: number
  dataCorte: string // YYYY-MM-DD
  dataEfetivacao: string // YYYY-MM-DD
  cnpjCliente: string
  produto: string
  empresaAlterdata: '00032' | '00035'
  dadosEmpresa: VRDadosEmpresa
}

export type VRMatchTipo = 'cpf' | 'nome_exato' | 'nome_palavras' | 'nome_similar' | 'base_cpf' | 'nenhum'

export interface VRResultadoCalculo {
  cpf: string
  nome: string
  matricula?: string
  diasElegiveis: number
  diasPdf: number
  diasEscala: number
  diasAbatimento: number
  valorBruto: number
  extra?: number
  matchTipo?: VRMatchTipo
  detalhes: string[]
}
