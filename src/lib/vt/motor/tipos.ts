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

export interface FatosCartaoMotor {
  /** Situação do BU no arquivo da Riocard (null = sem consulta). */
  situacaoBu: SituacaoBuRiocard | null
  /** Data da consulta (YYYY-MM-DD). */
  consultadoEm?: string | null
  /** Confirmação manual no Portal da empresa (Usuários → Gerenciar Bilhete Único). */
  bunConfirmadoNoPortal?: boolean | null
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
}

export type StatusMotor = 'confirmado' | 'pendente' | 'indeterminado'

export interface PendenciaMotor {
  codigo: string
  /** Motivo legível em português. */
  mensagem: string
  /** Seção do documento de regras (ex.: "Regras §3"). */
  regra: string
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
}

export interface ResultadoDiaMotor {
  valorCentavos: number | null
  status: StatusMotor
  ida: ResultadoSentidoMotor
  volta: ResultadoSentidoMotor
  pendencias: PendenciaMotor[]
  explicacao: PassoExplicacao[]
}
