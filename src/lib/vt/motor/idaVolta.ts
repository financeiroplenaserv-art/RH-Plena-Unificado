import type { AlternativaRotaGoogleVT } from '@/lib/vt/googleRoutes'
import type { CalculoMotorItinerarioVT, HorarioReferenciaVT, PernaItinerarioVT } from '@/lib/vt/contratosTarifarios'
import { calcularDia } from '@/lib/vt/motor/calcularDia'
import { calcularSentido } from '@/lib/vt/motor/calcularSentido'
import { pernasMotorDoItinerario } from '@/lib/vt/motor/adaptadorItinerario'
import { normalizarLinha, opcoesSecaoDetro } from '@/lib/vt/motor/tarifas'
import type { FatosCartaoMotor, ResultadoDiaMotor, ResultadoSentidoMotor } from '@/lib/vt/motor/tipos'

/** Identificador gravado em vt_trajeto_decisoes.cotacao_id quando o preço vem do motor novo. */
export const MOTOR_COTACAO_ID = 'motor_v1'

export interface AlternativaComMotor {
  alternativa: AlternativaRotaGoogleVT
  resultado: ResultadoSentidoMotor
  /** Avisos do adaptador Google → motor (modal "outro", horário sem fuso). */
  avisosMotor: string[]
}

/** Calcula UM sentido de cada alternativa pelo motor. */
export function calcularAlternativaSentido(
  alternativa: AlternativaRotaGoogleVT,
  cartao: FatosCartaoMotor,
  dataServico: string,
): AlternativaComMotor {
  const { pernas, avisos } = pernasMotorDoItinerario(alternativa.itinerario.pernas)
  return {
    alternativa,
    resultado: calcularSentido({ pernas, cartao, dataServico }),
    avisosMotor: avisos,
  }
}

/** Ordena por custo do sentido; indeterminado por último; empate pela ordem do Google. */
export function ordenarPorCusto(lista: readonly AlternativaComMotor[]): AlternativaComMotor[] {
  return [...lista].sort((a, b) =>
    (a.resultado.valorCentavos ?? Number.MAX_SAFE_INTEGER) - (b.resultado.valorCentavos ?? Number.MAX_SAFE_INTEGER) ||
    a.alternativa.numero - b.alternativa.numero,
  )
}

/** Menor valor determinado da lista (null se todos indeterminados). */
export function menorCustoSentido(lista: readonly AlternativaComMotor[]): number | null {
  const valores = lista.map((x) => x.resultado.valorCentavos).filter((v): v is number => v !== null)
  return valores.length ? Math.min(...valores) : null
}

/** Valor do dia (ida + volta escolhidas) pelo motor. A volta nunca é presumida igual à ida. */
export function calcularDiaIdaVolta(
  ida: AlternativaRotaGoogleVT,
  volta: AlternativaRotaGoogleVT,
  cartao: FatosCartaoMotor,
  dataServico: string,
): ResultadoDiaMotor {
  return calcularDia({
    itinerario: {
      ida: pernasMotorDoItinerario(ida.itinerario.pernas).pernas,
      volta: pernasMotorDoItinerario(volta.itinerario.pernas).pernas,
    },
    cartao,
    dataServico,
  })
}

function comSentido(pernas: readonly PernaItinerarioVT[], sentido: 'ida' | 'volta'): PernaItinerarioVT[] {
  return pernas.map((perna, indice) => ({ ...perna, sentido, sequencia: indice + 1 }))
}

function somaOuNull(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b
}

/**
 * Junta ida e volta numa única evidência (vt_itinerarios guarda UMA alternativa por
 * linha). As pernas levam `sentido`, e o resultado do motor vai em `calculoMotor` —
 * tudo dentro do JSON da evidência e, portanto, do hash. Sem migration.
 */
export function combinarIdaVolta(
  ida: AlternativaRotaGoogleVT,
  volta: AlternativaRotaGoogleVT,
  resultado: ResultadoDiaMotor,
  cartao: FatosCartaoMotor,
  dataServico: string,
  horarioReferencia?: HorarioReferenciaVT,
): AlternativaRotaGoogleVT {
  const secoesDetro: NonNullable<CalculoMotorItinerarioVT['secoesDetro']> = []
  for (const [sentido, alt] of [['ida', ida], ['volta', volta]] as const) {
    for (const perna of alt.itinerario.pernas) {
      if (perna.secaoDetro === undefined) continue
      const opcao = opcoesSecaoDetro(perna.linha).find((o) => o.secao === perna.secaoDetro)
      secoesDetro.push({
        sentido,
        linha: normalizarLinha(perna.linha),
        secao: perna.secaoDetro,
        rotulo: perna.secaoDetroRotulo ?? opcao?.rotulo ?? `seção ${perna.secaoDetro}`,
        valorCentavos: opcao?.valorCentavos ?? 0,
      })
    }
  }
  const calculoMotor: CalculoMotorItinerarioVT = {
    versao: MOTOR_COTACAO_ID,
    dataServico,
    status: resultado.status,
    valorDiaCentavos: resultado.valorCentavos,
    idaCentavos: resultado.ida.valorCentavos,
    voltaCentavos: resultado.volta.valorCentavos,
    alternativaIdaId: ida.id,
    alternativaVoltaId: volta.id,
    cartao: {
      situacaoBu: cartao.situacaoBu,
      consultadoEm: cartao.consultadoEm ?? null,
      politicaIntegracao: resultado.politicaIntegracao,
      ...(resultado.politicaIntegracao === 'tarifa_cheia' ? { motivoTarifaCheia: cartao.motivoTarifaCheia ?? null } : {}),
    },
    regularizarCartao: resultado.regularizarCartao,
    pendencias: resultado.pendencias.map((p) => p.mensagem),
    ...(secoesDetro.length ? { secoesDetro } : {}),
    ...(horarioReferencia ? { horarioReferencia } : {}),
  }
  const ajustes = [...(ida.itinerario.ajustesManuais ?? []), ...(volta.itinerario.ajustesManuais ?? [])]
  return {
    id: `ida:${ida.id}|volta:${volta.id}`,
    numero: ida.numero,
    distanciaMetros: somaOuNull(ida.distanciaMetros, volta.distanciaMetros),
    duracaoSegundos: somaOuNull(ida.duracaoSegundos, volta.duracaoSegundos),
    itinerario: {
      pernas: [...comSentido(ida.itinerario.pernas, 'ida'), ...comSentido(volta.itinerario.pernas, 'volta')],
      provedor: ida.itinerario.provedor,
      consultadoEm: ida.itinerario.consultadoEm,
      precisao: ida.itinerario.precisao,
      evidenciaHash: null,
      ...(ajustes.length ? { ajustesManuais: ajustes } : {}),
      calculoMotor,
    },
    avisos: [...ida.avisos.map((a) => `Ida: ${a}`), ...volta.avisos.map((a) => `Volta: ${a}`)],
  }
}
