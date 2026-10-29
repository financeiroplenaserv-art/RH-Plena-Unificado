// Tipos do módulo VT (Vale-Transporte) — Fase 1 (migration 155; rename da 156).
// Escopo da Fase 1: cadastro de optantes/tipo de bilhete, trajetos casa → posto
// e custo do dia por bilhete nomeado com valor diário fechado (ida+volta) —
// modelo aprovado pela gestora em 21/10/2026 (docs/PLANO_MODULO_VT.md §2d;
// "combinação" virou "bilhete", termo da operação).

/** Escopo do trajeto: classificação INFORMACIONAL auto-sugerida (não precifica). */
export type EscopoTrajetoVT = 'niteroi_municipal' | 'intermunicipal' | 'municipal_outra'

/** Tipo de bilhete do colaborador (cadastro manual — a API da Alterdata não expõe VT).
 *  'jae' = cartão do RJ (migration 165 — decisão da gestora, 27/10/2026). */
export type TipoCartaoVT = 'bun' | 'bui' | 'jae' | 'comum'

/** Precisão alcançada na geocodificação da origem (casa do colaborador). */
export type PrecisaoOrigemVT = 'exato' | 'bairro'

/** Como o trajeto foi gerado: manual ou confirmado a partir do link do Google Maps. */
export type OrigemTrajetoVT = 'manual' | 'link_confirmado'

/**
 * Tipo da cobertura (migration 160 — decisão da gestora, 22/10/2026):
 * 'ferias' = cobertura de férias (destino da férias, padrão); 'treinamento' =
 * dias de treinamento com VT (ferista antes de cobrir, ou admitido em posto
 * novo) — sintetiza dias de trabalho no posto como a cobertura, mas NÃO é
 * destino de férias. Ausente em leitura antiga = 'ferias'.
 */
export type TipoCoberturaVT = 'ferias' | 'treinamento'

/** O trajeto só entra no cálculo depois de confirmado pelo RH. */
export type StatusTrajetoVT = 'sugerido' | 'confirmado'

/** Bilhete nomeado com valor diário fechado (ida+volta), com vigência. */
export interface VtBilhete {
  id: string
  nome: string
  valor_diario_centavos: number
  vigente_desde: string // date ISO AAAA-MM-DD
  ativo: boolean
  /** Cartão que a pessoa precisa TER para o valor cobrir o trajeto (migration 165; null = não classificado). */
  cartao_necessario: TipoCartaoVT | null
  /** Migration 165: o bilhete depende de integração (2+ conduções numa tarifa só). */
  usa_integracao: boolean
  created_at?: string
}

export interface VtTrajeto {
  id: string
  colaborador_id: string
  departamento_id: string
  bilhete_id: string
  /** 2º bilhete opcional (o dia pode usar dois — custo = soma). */
  bilhete_2_id: string | null
  escopo: EscopoTrajetoVT
  precisao_origem: PrecisaoOrigemVT
  origem: OrigemTrajetoVT
  status: StatusTrajetoVT
  /** Migration 166: valor extra manual por dia (centavos; 0 = sem extra). */
  valor_extra_centavos: number
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

/** Item do detalhe da carga: um posto com dias × custo do dia (foto do cálculo). */
export interface VtCargaDetalhe {
  departamento_id: string
  posto: string
  dias: number
  custo_dia_centavos: number
  subtotal_centavos: number
  /** Quantos desses dias vieram de cobertura de férias (migration 158). */
  dias_cobertura?: number
  /** Quantos desses dias vieram de treinamento (migration 160). */
  dias_treinamento?: number
  /** Valor extra manual por dia já incluído no custo (migration 166; ausente em carga antiga = sem extra). */
  valor_extra_centavos?: number
  /** Datas planejadas neste posto, ordenadas — base do fechamento (Fase 2b; ausente em cargas antigas). */
  datas?: string[]
}

/** Carga mensal de VT de um colaborador (migration 157 — Fase 2a). */
export interface VtCarga {
  id: string
  colaborador_id: string
  competencia: string // 'AAAA-MM'
  detalhe: VtCargaDetalhe[]
  necessidade_centavos: number
  ajuste_centavos: number
  valor_centavos: number
  gerada_por: string | null
  gerada_em?: string
}

/** Fechamento de um colaborador × competência (migration 161 — Fase 2b). */
export interface VtFechamento {
  id: string
  colaborador_id: string
  competencia: string // 'AAAA-MM'
  detalhe: {
    departamento_id: string
    posto: string
    custo_dia_centavos: number
    planejados: string[]
    trabalhados: string[]
    descontados: string[]
    /** Migration 162: dias trabalhados fora da carga creditados neste posto (ausente em fechamento antigo). */
    creditados?: string[]
  }[]
  dias_planejados: number
  dias_trabalhados: number
  dias_descontados: number
  dias_nao_conferidos: number
  /** Positivo; entra NEGATIVO em vt_cargas.ajuste_centavos da competência seguinte. */
  desconto_centavos: number
  /** Migration 162: dias trabalhados no ponto fora da carga, creditados no posto de referência. */
  dias_creditados: number
  /** Migration 162: positivo; entra POSITIVO no ajuste da competência seguinte (ajuste = crédito − desconto). */
  credito_centavos: number
  /** Migration 162: dias trabalhados fora da carga SEM posto de referência — não creditados, conferir. */
  dias_fora_sem_posto: number
  fechado_por: string | null
  created_at?: string
  updated_at?: string
}

/**
 * Cobertura de férias: o FERISTA (colaborador_id) trabalha no posto
 * (departamento_id) no período. O Flit não mostra o destino do ferista, então
 * é registro manual e a carga usa o posto da cobertura com prioridade sobre a
 * escala (migration 158 — decisão da gestora, 21/10/2026). Migration 159
 * (carga dirigida pelas férias): ferias_colaborador_id = de quem são as
 * férias cobertas (NULL = cobertura avulsa); colaborador_id NULL =
 * declaração "sem cobertura" dessas férias. CHECK do banco: pelo menos um dos
 * dois preenchido.
 */
export interface VtCobertura {
  id: string
  /** O ferista (quem cobre). NULL = declaração "sem cobertura". */
  colaborador_id: string | null
  /** De quem são as férias cobertas. NULL = cobertura/treinamento avulso. */
  ferias_colaborador_id?: string | null
  /** Migration 160: 'ferias' (padrão) ou 'treinamento'. Ausente = 'ferias'. */
  tipo?: TipoCoberturaVT
  departamento_id: string
  data_inicio: string // date ISO AAAA-MM-DD
  data_fim: string // date ISO AAAA-MM-DD
  observacao: string | null
  registrado_por: string | null
  created_at?: string
}
