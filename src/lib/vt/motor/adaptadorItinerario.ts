import type { PernaItinerarioVT } from '@/lib/vt/contratosTarifarios'
import type { FatosCartaoMotor, ModalPerna, PernaMotor, SituacaoBuRiocard } from '@/lib/vt/motor/tipos'

/**
 * Adaptador: perna do itinerário (Google Routes já adaptado por googleRoutes.ts)
 * → PernaMotor. Na dúvida o modal vira "outro" (o motor devolve indeterminado):
 * nunca chuta tarifa. A classificação municipal × intermunicipal vem de
 * googleRoutes.ts (inclui a correção "3 dígitos + letra da operadora Niterói =
 * intermunicipal DETRO").
 */

export interface PernaMotorAdaptada {
  perna: PernaMotor
  /** Motivo de a perna ter virado "outro" ou perdido o horário (null = nada a observar). */
  aviso: string | null
}

/** ISO 8601 com fuso explícito (Z ou ±hh:mm). Sem fuso o horário seria lido no fuso da máquina. */
const ISO_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

function horarioComFuso(valor: string | null): string | null {
  if (!valor) return null
  const texto = valor.trim()
  if (!ISO_COM_FUSO.test(texto) || Number.isNaN(Date.parse(texto))) return null
  return texto
}

function modalOnibus(perna: PernaItinerarioVT): ModalPerna | null {
  if (perna.categoriaServico === 'desconhecida') return null
  if (perna.escopo === 'intermunicipal' && perna.sistemaTarifario === 'detro') return 'onibus_intermunicipal'
  if (perna.escopo !== 'municipal') return null
  if (perna.sistemaTarifario === 'riocard' && perna.municipioOrigem === 'Niterói' && perna.municipioDestino === 'Niterói') {
    return 'onibus_municipal_niteroi'
  }
  if (perna.sistemaTarifario === 'riocard' && perna.municipioOrigem === 'São Gonçalo' && perna.municipioDestino === 'São Gonçalo') {
    return 'onibus_municipal_sao_goncalo'
  }
  if (perna.sistemaTarifario === 'jae' && perna.municipioOrigem === 'Rio de Janeiro' && perna.municipioDestino === 'Rio de Janeiro') {
    return 'onibus_municipal_rio'
  }
  return null
}

function modalDaPerna(perna: PernaItinerarioVT): { modal: ModalPerna; aviso: string | null } {
  const nome = `Condução ${perna.sequencia}${perna.linha ? ` (${perna.linha})` : ''}`
  switch (perna.modal) {
    case 'onibus': {
      const modal = modalOnibus(perna)
      if (modal) return { modal, aviso: null }
      return {
        modal: 'outro',
        aviso: `${nome}: ônibus sem classificação tarifária segura (operadora ${perna.operadora ?? 'não informada'}) — tratado como "outro modal".`,
      }
    }
    case 'micro_onibus':
      return { modal: 'outro', aviso: `${nome}: micro-ônibus sem tarifa classificada — tratado como "outro modal".` }
    case 'trem': return { modal: 'trem', aviso: null }
    case 'metro': return { modal: 'metro', aviso: null }
    case 'barca': return { modal: 'barca', aviso: null }
    case 'vlt': return { modal: 'vlt', aviso: null }
    case 'brt': return { modal: 'brt', aviso: null }
    case 'van': return { modal: 'van', aviso: null }
    default: return { modal: 'outro', aviso: `${nome}: modal não reconhecido — tratado como "outro modal".` }
  }
}

export function pernaMotorDeItinerario(perna: PernaItinerarioVT): PernaMotorAdaptada {
  const { modal, aviso } = modalDaPerna(perna)
  const embarqueEm = horarioComFuso(perna.embarque.dataHoraPrevista)
  const avisoHorario = perna.embarque.dataHoraPrevista && !embarqueEm
    ? `Condução ${perna.sequencia}: horário de embarque sem fuso horário — desconsiderado.`
    : null
  return {
    perna: {
      modal,
      linha: perna.linha,
      secao: null,
      embarqueEm,
      operadora: perna.operadora,
    },
    aviso: [aviso, avisoHorario].filter(Boolean).join(' ') || null,
  }
}

export function pernasMotorDoItinerario(pernas: readonly PernaItinerarioVT[]): {
  pernas: PernaMotor[]
  avisos: string[]
} {
  const adaptadas = pernas.map(pernaMotorDeItinerario)
  return {
    pernas: adaptadas.map((a) => a.perna),
    avisos: adaptadas.map((a) => a.aviso).filter((a): a is string => !!a),
  }
}

const SITUACOES_BU: readonly SituacaoBuRiocard[] = [
  'Ativado',
  'Suspenso Setrans',
  'Não possui BU',
  'Desativado',
  'Ativação Solicitada',
]

/** Normaliza o texto cru da Riocard (colaboradores.vt_bu_situacao); texto desconhecido = sem consulta. */
export function situacaoBuDoCadastro(texto: string | null | undefined): SituacaoBuRiocard | null {
  const limpo = (texto ?? '').trim().toLocaleLowerCase('pt-BR')
  if (!limpo) return null
  return SITUACOES_BU.find((s) => s.toLocaleLowerCase('pt-BR') === limpo) ?? null
}

/** Fatos do cartão a partir do cadastro (colaboradores.vt_bu_situacao + vt_bu_consultado_em). */
export function fatosCartaoDoCadastro(
  situacaoBu: string | null | undefined,
  consultadoEm: string | null | undefined,
): FatosCartaoMotor {
  return {
    situacaoBu: situacaoBuDoCadastro(situacaoBu),
    consultadoEm: consultadoEm ?? null,
    bunConfirmadoNoPortal: null,
  }
}
