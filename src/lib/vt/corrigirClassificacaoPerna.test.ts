import { describe, expect, it } from 'vitest'
import { adaptarRotasGoogle } from '@/lib/vt/googleRoutes'
import {
  corrigirClassificacaoPerna,
  pernaAceitaCorrecao,
  tipoLinhaDaPerna,
  tiposCorrigidosPorLinha,
} from '@/lib/vt/corrigirClassificacaoPerna'
import { calcularAlternativaSentido } from '@/lib/vt/motor/idaVolta'

const CARTAO = { situacaoBu: 'Ativado' as const, consultadoEm: '2026-10-28', bunConfirmadoNoPortal: null }
const MUNICIPIOS = { municipioOrigem: 'São Gonçalo', municipioDestino: 'Niterói' }

function passo(linha: string, agencia: string, partida: string, chegada: string, tipo = 'BUS') {
  return {
    travelMode: 'TRANSIT',
    transitDetails: {
      stopDetails: {
        departureStop: { name: 'A' },
        arrivalStop: { name: 'B' },
        departureTime: partida,
        arrivalTime: chegada,
      },
      transitLine: { nameShort: linha, vehicle: { type: tipo }, agencies: [{ name: agencia }] },
    },
  }
}

function alternativa(...passos: ReturnType<typeof passo>[]) {
  return adaptarRotasGoogle(
    { routes: [{ legs: [{ steps: passos }] }] },
    { consultadoEm: '2026-11-28T10:00:00Z', precisao: 'exata', sentido: 'ida', ...MUNICIPIOS },
  )[0]
}

const P39 = passo('39', 'Prefeitura de Niterói', '2026-11-30T09:00:00Z', '2026-11-30T09:20:00Z')

describe('corrigirClassificacaoPerna', () => {
  it('o Google rotula a 39 como Niterói; trocar para gratuito muda o valor e registra o ajuste', () => {
    const original = alternativa(P39)
    expect(tipoLinhaDaPerna(original.itinerario.pernas[0])).toBe('niteroi')
    const antes = calcularAlternativaSentido(original, CARTAO, '2026-11-30').resultado.valorCentavos

    const corrigida = corrigirClassificacaoPerna(original, 1, 'gratuito', MUNICIPIOS)
    const perna = corrigida.itinerario.pernas[0]
    expect(perna).toMatchObject({ sistemaTarifario: 'gratuito', escopo: 'municipal', municipioOrigem: 'Itaboraí' })
    expect(calcularAlternativaSentido(corrigida, CARTAO, '2026-11-30').resultado.valorCentavos).toBe(0)
    expect(antes).toBeGreaterThan(0)

    expect(corrigida.itinerario.ajustesManuais).toEqual([
      expect.objectContaining({
        tipo: 'correcao_classificacao_perna',
        sentido: 'ida',
        sequencia: 1,
        linha: '39',
        original: expect.objectContaining({ sistemaTarifario: 'riocard', municipioOrigem: 'Niterói' }),
        escolhida: expect.objectContaining({ sistemaTarifario: 'gratuito', tipoLinha: 'gratuito' }),
      }),
    ])
    expect(tipoLinhaDaPerna(perna)).toBe('gratuito')
  })

  it('corrigir de novo mantém a classificação original do Google e voltar ao original remove o ajuste', () => {
    const original = alternativa(P39)
    const duas = corrigirClassificacaoPerna(corrigirClassificacaoPerna(original, 1, 'gratuito', MUNICIPIOS), 1, 'rio', MUNICIPIOS)
    expect(duas.itinerario.ajustesManuais).toHaveLength(1)
    expect(duas.itinerario.ajustesManuais?.[0]).toMatchObject({
      original: { sistemaTarifario: 'riocard', municipioOrigem: 'Niterói' },
      escolhida: { tipoLinha: 'rio', sistemaTarifario: 'jae' },
    })
    const volta = corrigirClassificacaoPerna(duas, 1, 'niteroi', MUNICIPIOS)
    expect(volta.itinerario.ajustesManuais).toEqual([])
    expect(volta.itinerario.pernas[0].sistemaTarifario).toBe('riocard')
  })

  it('DETRO: linha fora da tabela fica sem tarifa (nunca preço presumido); linha da tabela usa a tabela', () => {
    const fora = corrigirClassificacaoPerna(alternativa(P39), 1, 'detro', MUNICIPIOS)
    expect(fora.itinerario.pernas[0]).toMatchObject({ sistemaTarifario: 'detro', escopo: 'intermunicipal' })
    const r = calcularAlternativaSentido(fora, CARTAO, '2026-11-30').resultado
    expect(r.valorCentavos).toBeNull()
    expect(r.status).not.toBe('confirmado')

    const p532 = passo('532M', 'Prefeitura de Niterói', '2026-11-30T09:00:00Z', '2026-11-30T09:30:00Z')
    const dentro = alternativa(p532)
    expect(tipoLinhaDaPerna(dentro.itinerario.pernas[0])).toBe('detro')
    expect(calcularAlternativaSentido(dentro, CARTAO, '2026-11-30').resultado.valorCentavos).toBeGreaterThan(0)
  })

  it('só ônibus aceita correção; metrô/trem não', () => {
    const metro = alternativa(passo('1', 'MetrôRio', '2026-11-30T09:00:00Z', '2026-11-30T09:20:00Z', 'SUBWAY'))
    expect(pernaAceitaCorrecao(metro.itinerario.pernas[0])).toBe(false)
    expect(() => corrigirClassificacaoPerna(metro, 1, 'niteroi', MUNICIPIOS)).toThrow()
  })

  it('tiposCorrigidosPorLinha lista o que foi corrigido, por linha normalizada', () => {
    const corrigida = corrigirClassificacaoPerna(alternativa(P39), 1, 'gratuito', MUNICIPIOS)
    expect(tiposCorrigidosPorLinha(corrigida)).toEqual({ '39': 'gratuito' })
    expect(tiposCorrigidosPorLinha(alternativa(P39))).toEqual({})
  })
})
