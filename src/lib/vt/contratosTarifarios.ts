export type ModalTransporteVT = 'onibus' | 'micro_onibus' | 'brt' | 'vlt' | 'van' | 'trem' | 'metro' | 'barca'

export type CategoriaServicoVT = 'urbano_convencional' | 'executivo' | 'seletivo' | 'rodoviario' | 'desconhecida'

export type SistemaTarifarioVT = 'riocard' | 'bun' | 'bui' | 'jae' | 'buc' | 'detro' | 'supervia' | 'metrorio' | 'aquaviario' | 'desconhecido'

export interface PontoValidacaoVT {
  local: string
  dataHoraPrevista: string | null
}

export interface PernaItinerarioVT {
  sequencia: number
  linha: string | null
  variante: string | null
  operadora: string | null
  modal: ModalTransporteVT
  categoriaServico: CategoriaServicoVT
  sistemaTarifario: SistemaTarifarioVT
  escopo: 'municipal' | 'intermunicipal' | 'desconhecido'
  municipioOrigem: string
  municipioDestino: string
  sentido: 'ida' | 'volta'
  embarque: PontoValidacaoVT
  desembarque: PontoValidacaoVT
  tarifaCentavos: number | null
  tarifaVigenteDesde: string | null
}

export interface AjusteManualItinerarioVT {
  tipo: 'remocao_perna'
  perna: PernaItinerarioVT
}

export interface ItinerarioVT {
  pernas: PernaItinerarioVT[]
  provedor: 'google_routes' | 'manual' | 'importado' | 'outro'
  consultadoEm: string
  precisao: 'exata' | 'parcial' | 'bairro' | 'manual'
  evidenciaHash: string | null
  ajustesManuais?: AjusteManualItinerarioVT[]
}

export interface FonteOficialVT {
  titulo: string
  url: string
  publicadoEm: string | null
  consultadoEm: string
}

export interface RegraOficialVT {
  id: string
  tipo: 'tarifa' | 'integracao' | 'elegibilidade'
  produto: 'BUN' | 'BUI' | 'BUC' | 'JAE' | 'COMUM' | 'MODAL'
  vigenteDesde: string
  vigenteAte: string | null
  fonte: FonteOficialVT
  parametros: Readonly<Record<string, string | number | boolean | null>>
}

export interface FatosCartaoVT {
  personalizacao: 'usuario' | 'empresa' | 'ao_portador' | 'desconhecida'
  vinculadoCpf: boolean | null
  bui: 'ativo' | 'suspenso' | 'nao_possui' | 'nao_consultado'
  bun: 'ativo' | 'nao_possui' | 'nao_consultado'
  jae: 'disponivel' | 'indisponivel' | 'nao_informado'
  situacaoConsultadaEm: string | null
}

export interface PendenciaCotacaoVT {
  codigo: string
  mensagem: string
  pernaSequencia: number | null
}

export interface CobrancaPernaVT {
  sequencia: number
  tarifaIntegralCentavos: number | null
  cobradoEstimadoCentavos: number | null
  integracaoAplicadaId: string | null
  motivo: string
}

export interface IntegracaoCotadaVT {
  regraId: string
  pernas: number[]
  aceita: boolean
  motivo: string
}

export interface AlternativaCotacaoVT {
  id: string
  descricao: string
  status: 'confirmavel' | 'parcial' | 'indeterminado'
  totalEstimadoCentavos: number | null
  cartoesNecessarios: RequisitoFinanciamentoVT['cartao'][]
  motivo: string
}

export interface CotacaoCatraca {
  status: 'confirmavel' | 'parcial' | 'indeterminado'
  alternativaEscolhidaId: string | null
  alternativas: AlternativaCotacaoVT[]
  totalEstimadoCentavos: number | null
  pernas: CobrancaPernaVT[]
  integracoes: IntegracaoCotadaVT[]
  regraIds: string[]
  pendencias: PendenciaCotacaoVT[]
}

export type CotarCatraca = (
  itinerario: ItinerarioVT,
  cartao: FatosCartaoVT,
  regras: readonly RegraOficialVT[],
  dataServico: string,
) => CotacaoCatraca

export interface PacoteBeneficioVT {
  id: string
  nome: string
  ativo: boolean
}

export interface ComponentePacoteVT {
  id: string
  pacoteId: string
  descricao: string
  ordem: number
}

export interface VersaoPrecoPacoteVT {
  id: string
  pacoteId: string
  valorDiarioCentavos: number
  vigenteDesde: string
  vigenteAte: string | null
  bilheteLegadoId?: string | null
}

export interface RequisitoFinanciamentoVT {
  pacoteId: string
  cartao: 'riocard_bui' | 'riocard_bun' | 'jae' | 'comum' | 'outro'
  obrigatorio: boolean
}

export interface DecisaoTrajetoVT {
  id: string
  trajetoLegadoId: string | null
  colaboradorId: string
  departamentoId: string
  revisao: number
  cotacaoId: string | null
  custoDiarioCentavos?: number | null
  status: 'sugerida' | 'confirmada' | 'indeterminada'
  confirmadaPor: string | null
  confirmadaEm: string | null
  vigenteDesde: string | null
  vigenteAte: string | null
  origem?: 'manual' | 'legado'
  referenciasLegadasNaoResolvidas: string[]
}

export interface ComponenteDecisaoTrajetoVT {
  id: string
  decisaoTrajetoId: string
  pacoteId: string
  ordem: number
}

export interface AjusteBeneficioVT {
  id: string
  decisaoTrajetoId: string
  valorDiarioCentavos: number
  motivo: string
  autorId: string | null
  vigenteDesde: string | null
  vigenteAte: string | null
  origem?: 'manual' | 'legado'
}
