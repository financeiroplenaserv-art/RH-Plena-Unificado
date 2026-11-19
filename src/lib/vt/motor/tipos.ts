/**
 * Motor de cálculo de tarifa do VT — tipos.
 * Lógica pura; independente de cotarCatraca.ts (legado). Referências "Regras §N"
 * apontam para docs/VT_REGRAS_TARIFARIAS.md.
 */

export type ModalPerna =
  | 'onibus_municipal_niteroi'
  | 'onibus_municipal_sao_goncalo'
  | 'onibus_municipal_rio'
  | 'onibus_intermunicipal'
  | 'trem'
  | 'metro'
  | 'barca'
  | 'vlt'
  | 'brt'
  | 'van'
  | 'outro'

export interface PernaMotor {
  modal: ModalPerna
  /** Código da linha (ex.: "483M", "35"). */
  linha?: string | null
  /** Seção DETRO (0 = percurso completo). Opcional. */
  secao?: number | string | null
  /** Horário de embarque (validação), ISO 8601 com fuso. */
  embarqueEm?: string | null
  operadora?: string | null
}

export interface ItinerarioMotor {
  ida: readonly PernaMotor[]
  volta: readonly PernaMotor[]
}

export type SituacaoBuRiocard =
  | 'Ativado'
  | 'Suspenso Setrans'
  | 'Não possui BU'
  | 'Desativado'
  | 'Ativação Solicitada'

/**
 * Política da empresa para a integração (decisão da gestora, 19/11/2026 — Regras,
 * seção "Política da empresa: integração presumida"):
 * - presumida (padrão): calcula com BUN/BUI disponíveis, qualquer que seja a
 *   situação na Riocard. Situação diferente de "Ativado" vira só AVISO de regularizar.
 * - tarifa_cheia: exceção por pessoa, decidida pela empresa com motivo
 *   (colaboradores.vt_tarifa_cheia, migration 174): cobra a tarifa integral de
 *   cada condução, sem integração.
 */
export type PoliticaIntegracao = 'presumida' | 'tarifa_cheia'

export interface FatosCartaoMotor {
  /** Situação do BU no arquivo da Riocard (null = sem consulta). */
  situacaoBu: SituacaoBuRiocard | null
  /** Data da consulta (YYYY-MM-DD). */
  consultadoEm?: string | null
  /** Confirmação manual no Portal da empresa (Usuários → Gerenciar Bilhete Único). */
  bunConfirmadoNoPortal?: boolean | null
  /** Política da empresa; ausente = 'presumida'. */
  politicaIntegracao?: PoliticaIntegracao | null
  /** Motivo da exceção "tarifa cheia" (só informativo, entra na explicação). */
  motivoTarifaCheia?: string | null
}

export interface EntradaDiaMotor {
  itinerario: ItinerarioMotor
  cartao: FatosCartaoMotor
  /** Data do serviço (YYYY-MM-DD). */
  dataServico: string
}

export interface EntradaSentidoMotor {
  pernas: readonly PernaMotor[]
  cartao: FatosCartaoMotor
  dataServico: string
  rotulo?: string
  /**
   * Viagens pagas em ônibus municipal de Niterói já feitas antes deste sentido,
   * no mesmo dia (limite de 2 por dia com o valor do BUN). calcularDia informa
   * o que a ida gastou ao calcular a volta. Ausente = 0.
   */
  viagensNiteroiJaPagasNoDia?: number
}

export type StatusMotor = 'confirmado' | 'pendente' | 'indeterminado'

export interface PendenciaMotor {
  codigo: string
  /** Motivo legível em português. */
  mensagem: string
  /** Seção do documento de regras (ex.: "Regras §3"). */
  regra: string
}

/** Aviso informativo — NÃO é pendência e não impede a confirmação do valor. */
export interface AvisoMotor {
  codigo: 'REGULARIZAR_CARTAO'
  /** Texto simples, para repassar ao colaborador. */
  mensagem: string
}

export interface PassoExplicacao {
  regra: string
  texto: string
}

export interface ResultadoSentidoMotor {
  valorCentavos: number | null
  status: StatusMotor
  pendencias: PendenciaMotor[]
  explicacao: PassoExplicacao[]
  /** Viagens pagas em ônibus municipal de Niterói neste sentido (integração conta 1). */
  viagensNiteroiPagas: number
  /** Política aplicada neste cálculo. */
  politicaIntegracao: PoliticaIntegracao
  /** true quando a integração foi presumida e a situação na Riocard não é "Ativado". */
  regularizarCartao: boolean
  avisos: AvisoMotor[]
}

export interface ResultadoDiaMotor {
  valorCentavos: number | null
  status: StatusMotor
  ida: ResultadoSentidoMotor
  volta: ResultadoSentidoMotor
  pendencias: PendenciaMotor[]
  explicacao: PassoExplicacao[]
  politicaIntegracao: PoliticaIntegracao
  regularizarCartao: boolean
  avisos: AvisoMotor[]
}
