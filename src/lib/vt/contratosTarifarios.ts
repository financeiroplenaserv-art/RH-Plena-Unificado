export type ModalTransporteVT = 'onibus' | 'micro_onibus' | 'brt' | 'vlt' | 'van' | 'trem' | 'metro' | 'barca'

export type CategoriaServicoVT = 'urbano_convencional' | 'executivo' | 'seletivo' | 'rodoviario' | 'desconhecida'

export type SistemaTarifarioVT = 'riocard' | 'bun' | 'bui' | 'jae' | 'buc' | 'detro' | 'supervia' | 'metrorio' | 'aquaviario' | 'gratuito' | 'desconhecido'

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
  /**
   * Trecho (seção) DETRO escolhido pelo RH quando a linha tem mais de um valor
   * (Portaria 1.960/2026). Opcional: ausente em evidências antigas e quando a linha
   * tem valor único. Entra no JSON — e no hash — da evidência.
   */
  secaoDetro?: number
  /** Nome do trecho escolhido (ex.: "Alcântara - Niterói"), só para leitura da evidência. */
  secaoDetroRotulo?: string
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
  /** Resultado do motor novo (src/lib/vt/motor) gravado junto com a evidência de ida + volta. */
  calculoMotor?: CalculoMotorItinerarioVT
  /** Rota informada à mão pelo RH (25/11/2026): quem informou, por quê e que os horários são presumidos. */
  rotaManual?: RotaManualItinerarioVT
}

export interface RotaManualItinerarioVT {
  /** Motivo obrigatório (ex.: "confirmado com a colaboradora"). */
  motivo: string
  /** Usuário (perfis.id) que informou a rota. */
  autorId: string
  informadaEm: string
  /** Sem consulta ao Google não há horário real: os embarques são presumidos dentro da janela de integração. */
  horariosPresumidos: boolean
}

export interface CalculoMotorItinerarioVT {
  versao: 'motor_v1'
  dataServico: string
  status: 'confirmado' | 'pendente' | 'indeterminado'
  valorDiaCentavos: number | null
  idaCentavos: number | null
  voltaCentavos: number | null
  alternativaIdaId: string
  alternativaVoltaId: string
  cartao: {
    situacaoBu: string | null
    consultadoEm: string | null
    /** Política da empresa usada no cálculo (19/11/2026). Ausente em evidências antigas = cálculo anterior à política. */
    politicaIntegracao?: 'presumida' | 'tarifa_cheia'
    motivoTarifaCheia?: string | null
  }
  /** Trechos DETRO escolhidos nas pernas deste cálculo (ausente = nenhuma linha exigiu escolha). */
  secoesDetro?: { sentido: 'ida' | 'volta'; linha: string; secao: number; rotulo: string; valorCentavos: number }[]
  /** Aviso de regularizar o cartão no momento do cálculo (ausente em evidências antigas). */
  regularizarCartao?: boolean
  pendencias: string[]
  /** Horário usado para consultar as rotas (ausente em evidências antigas). */
  horarioReferencia?: HorarioReferenciaVT
  /**
   * Endereço de casa (texto de textoOrigemCasa) usado na consulta (21/11/2026). Permite a fila
   * "Rotas a confirmar" avisar quando o cadastro mudar de endereço. Ausente em evidências antigas.
   */
  enderecoCasa?: string
}

export interface HorarioReferenciaVT {
  origem: 'turno_escala' | 'manual'
  /** HH:MM — a ida chega até esta hora. */
  entrada: string
  /** HH:MM — a volta sai nesta hora (no dia seguinte quando noturno). */
  saida: string
  /** Texto do turno na escala ("07:00 às 15:20") ou o horário manual. */
  texto: string
  noturno?: boolean
  /** Como a ida foi consultada: chegar até (turno), saída com margem (function antiga) ou saída informada. */
  modoIda?: 'chegada' | 'saida_com_margem' | 'saida'
  /** Folga de chegada na ida, em minutos (21/11/2026: 10). Ausente em evidências antigas. */
  folgaMinutos?: number
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
