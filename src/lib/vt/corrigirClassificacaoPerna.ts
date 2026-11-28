import type { AlternativaRotaGoogleVT } from '@/lib/vt/googleRoutes'
import type { ClassificacaoPernaVT, PernaItinerarioVT } from '@/lib/vt/contratosTarifarios'
import { classificacaoDoTipoMunicipal } from '@/lib/vt/rotaManual'

/**
 * Correção manual do "tipo da linha" na revisão de rota (28/11/2026). O Google rotula quase
 * toda linha de código curto da região como "Prefeitura de Niterói"; o RH sabe de que sistema
 * a linha é e corrige. O valor é recalculado pelo MESMO motor; nada é presumido: linha DETRO
 * que não está na tabela continua sem tarifa (pendência).
 */

export type TipoLinhaCorrecao = 'niteroi' | 'sao_goncalo' | 'gratuito' | 'rio' | 'detro'

export const OPCOES_TIPO_LINHA: readonly { tipo: TipoLinhaCorrecao; rotulo: string }[] = [
  { tipo: 'niteroi', rotulo: 'Niterói (municipal)' },
  { tipo: 'sao_goncalo', rotulo: 'São Gonçalo (municipal)' },
  { tipo: 'gratuito', rotulo: 'Itaboraí ou Maricá (gratuito)' },
  { tipo: 'rio', rotulo: 'Rio (municipal, Jaé)' },
  { tipo: 'detro', rotulo: 'Intermunicipal (DETRO)' },
]

const TIPO_MUNICIPAL = {
  niteroi: 'onibus_municipal_niteroi',
  sao_goncalo: 'onibus_municipal_sao_goncalo',
  gratuito: 'onibus_municipal_gratuito',
  rio: 'onibus_municipal_rio',
} as const

const ehOnibus = (perna: PernaItinerarioVT) => perna.modal === 'onibus' || perna.modal === 'micro_onibus'

/** Só ônibus tem o seletor; metrô, trem, barca etc. já têm sistema próprio. */
export function pernaAceitaCorrecao(perna: PernaItinerarioVT): boolean {
  return ehOnibus(perna)
}

/** Tipo em que a perna está classificada hoje; null = sem classificação (operadora desconhecida). */
export function tipoLinhaDaPerna(perna: PernaItinerarioVT): TipoLinhaCorrecao | null {
  if (perna.escopo === 'intermunicipal' && perna.sistemaTarifario === 'detro') return 'detro'
  if (perna.escopo !== 'municipal') return null
  if (perna.sistemaTarifario === 'gratuito') return 'gratuito'
  if (perna.sistemaTarifario === 'jae') return 'rio'
  if (perna.sistemaTarifario === 'riocard') {
    if (perna.municipioOrigem === 'Niterói') return 'niteroi'
    if (perna.municipioOrigem === 'São Gonçalo') return 'sao_goncalo'
  }
  return null
}

function classificacaoDe(perna: PernaItinerarioVT): ClassificacaoPernaVT {
  return {
    escopo: perna.escopo,
    sistemaTarifario: perna.sistemaTarifario,
    municipioOrigem: perna.municipioOrigem,
    municipioDestino: perna.municipioDestino,
  }
}

export interface MunicipiosSentido {
  /** Município de onde o sentido parte e para onde chega (a volta já vem trocada). */
  municipioOrigem: string
  municipioDestino: string
}

/**
 * Aplica o tipo escolhido à condução `sequencia`. O ajuste anterior da mesma condução é
 * substituído, mas a classificação ORIGINAL (a do Google) é preservada. Escolher de novo o
 * tipo original apenas remove a correção. Reaproveita os mapeamentos de `rotaManual.ts`.
 */
export function corrigirClassificacaoPerna(
  alternativa: AlternativaRotaGoogleVT,
  sequencia: number,
  tipo: TipoLinhaCorrecao,
  municipios: MunicipiosSentido,
): AlternativaRotaGoogleVT {
  const alvo = alternativa.itinerario.pernas.find((p) => p.sequencia === sequencia)
  if (!alvo) throw new Error('A condução escolhida não existe nesta alternativa.')
  if (!pernaAceitaCorrecao(alvo)) throw new Error('Só ônibus pode ter o tipo da linha corrigido.')

  const ajustes = alternativa.itinerario.ajustesManuais ?? []
  const mesma = (a: (typeof ajustes)[number]) =>
    a.tipo === 'correcao_classificacao_perna' && a.sentido === alvo.sentido && a.sequencia === sequencia
  const anterior = ajustes.find(mesma)
  const original = anterior && anterior.tipo === 'correcao_classificacao_perna' ? anterior.original : classificacaoDe(alvo)

  const nova: ClassificacaoPernaVT = tipo === 'detro'
    ? { escopo: 'intermunicipal', sistemaTarifario: 'detro', municipioOrigem: municipios.municipioOrigem, municipioDestino: municipios.municipioDestino }
    : classificacaoDoTipoMunicipal(TIPO_MUNICIPAL[tipo])

  const pernas = alternativa.itinerario.pernas.map((perna) => {
    if (perna.sequencia !== sequencia) return perna
    // O trecho DETRO só vale para linha DETRO; trocar de sistema descarta a escolha anterior.
    const { secaoDetro: _s, secaoDetroRotulo: _r, ...resto } = perna
    void _s
    void _r
    return { ...resto, ...nova, categoriaServico: 'urbano_convencional' as const }
  })

  const restantes = ajustes.filter((a) => !mesma(a))
  const igualAoOriginal = (Object.keys(nova) as (keyof ClassificacaoPernaVT)[]).every((k) => nova[k] === original[k])
  const ajusteNovo = igualAoOriginal
    ? []
    : [{
        tipo: 'correcao_classificacao_perna' as const,
        sentido: alvo.sentido,
        sequencia,
        linha: alvo.linha,
        original,
        escolhida: { ...nova, tipoLinha: tipo },
      }]
  const rotulo = OPCOES_TIPO_LINHA.find((o) => o.tipo === tipo)?.rotulo ?? tipo
  const aviso = `Condução ${alvo.linha ?? sequencia}: tipo da linha corrigido manualmente para "${rotulo}".`
  const avisos = alternativa.avisos.filter((a) => !a.startsWith(`Condução ${alvo.linha ?? sequencia}: tipo da linha corrigido`))

  return {
    ...alternativa,
    itinerario: {
      ...alternativa.itinerario,
      pernas,
      ajustesManuais: [...restantes, ...ajusteNovo],
    },
    avisos: igualAoOriginal ? avisos : [...avisos, aviso],
  }
}

/** Tipos corrigidos em uma alternativa, por linha normalizada (para a volta espelhada herdar da ida). */
export function tiposCorrigidosPorLinha(alternativa: AlternativaRotaGoogleVT): Record<string, TipoLinhaCorrecao> {
  const mapa: Record<string, TipoLinhaCorrecao> = {}
  for (const ajuste of alternativa.itinerario.ajustesManuais ?? []) {
    if (ajuste.tipo !== 'correcao_classificacao_perna' || !ajuste.linha) continue
    mapa[ajuste.linha.trim().toUpperCase().replace(/\s+/g, '')] = ajuste.escolhida.tipoLinha as TipoLinhaCorrecao
  }
  return mapa
}
