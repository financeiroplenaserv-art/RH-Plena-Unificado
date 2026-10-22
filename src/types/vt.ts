// Tipos do módulo VT (Vale-Transporte) — Fase 1 (migration 155).
// Escopo da Fase 1: cadastro de optantes/tipo de bilhete, trajetos casa → posto
// e custo do dia por combinação nomeada com valor diário fechado (ida+volta) —
// modelo aprovado pela gestora em 21/10/2026 (docs/PLANO_MODULO_VT.md §2d).

/** Escopo do trajeto: classificação INFORMACIONAL auto-sugerida (não precifica). */
export type EscopoTrajetoVT = 'niteroi_municipal' | 'intermunicipal' | 'municipal_outra'

/** Tipo de bilhete do colaborador (cadastro manual — a API da Alterdata não expõe VT). */
export type TipoCartaoVT = 'bun' | 'bui' | 'comum'

/** Precisão alcançada na geocodificação da origem (casa do colaborador). */
export type PrecisaoOrigemVT = 'exato' | 'bairro'

/** Como o trajeto foi gerado: manual ou confirmado a partir do link do Google Maps. */
export type OrigemTrajetoVT = 'manual' | 'link_confirmado'

/** O trajeto só entra no cálculo depois de confirmado pelo RH. */
export type StatusTrajetoVT = 'sugerido' | 'confirmado'

/** Combinação nomeada com valor diário fechado (ida+volta), com vigência. */
export interface VtCombinacao {
  id: string
  nome: string
  valor_diario_centavos: number
  vigente_desde: string // date ISO AAAA-MM-DD
  ativo: boolean
  created_at?: string
}

export interface VtTrajeto {
  id: string
  colaborador_id: string
  departamento_id: string
  combinacao_id: string
  /** 2ª combinação opcional (o dia pode usar duas — custo = soma). */
  combinacao_2_id: string | null
  escopo: EscopoTrajetoVT
  precisao_origem: PrecisaoOrigemVT
  origem: OrigemTrajetoVT
  status: StatusTrajetoVT
  observacao: string | null
  confirmado_por: string | null
  confirmado_em: string | null
  created_at?: string
  updated_at?: string
}

/** Cache de geocodificação (uso futuro — a Fase 1 não chama o geocoder). */
export interface VtGeocodeCache {
  chave: string // endereço normalizado (LGPD: sem nome/CPF)
  lat: number | null
  lng: number | null
  precisao: string | null
  created_at?: string
}
