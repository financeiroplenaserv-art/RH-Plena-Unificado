import { describe, expect, it } from 'vitest'
import { calcularDia, calcularSentido } from '@/lib/vt/motor'
import type { FatosCartaoMotor, ModalPerna, PernaMotor } from '@/lib/vt/motor'
import { opcoesSecaoDetro } from '@/lib/vt/motor/tarifas'
import { adaptarRotasGoogle, municipioGratuitoDaOperadora } from '@/lib/vt/googleRoutes'
import { pernaMotorDeItinerario } from '@/lib/vt/motor/adaptadorItinerario'

const DATA = '2026-11-17'
const ATIVO: FatosCartaoMotor = { situacaoBu: 'Ativado', consultadoEm: '2026-10-28' }

function perna(modal: ModalPerna, linha: string | null, min = 0, secao?: number): PernaMotor {
  const total = 6 * 60 + min
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return { modal, linha, embarqueEm: `2026-11-17T${hh}:${mm}:00-03:00`, secao: secao ?? null }
}

describe('tarifa DETRO por seção (Parecer VT 21/11/2026, §3.5)', () => {
  it('linha com percurso inteiro e seções: oferece as opções e nunca escolhe sozinha', () => {
    const opcoes = opcoesSecaoDetro('416M')
    expect(opcoes.map((o) => [o.secao, o.valorCentavos])).toEqual([[0, 1510], [1, 710], [2, 710]])
    const r = calcularSentido({ pernas: [perna('onibus_intermunicipal', '416M')], cartao: ATIVO, dataServico: DATA })
    expect(r.valorCentavos).toBeNull()
    expect(r.status).toBe('indeterminado')
    expect(r.pendencias[0]).toMatchObject({ codigo: 'DETRO_SECAO_ESCOLHER', linha: '416M' })
    expect(r.pendencias[0].opcoesSecao).toHaveLength(3)
  })

  it('416M Alcântara - Niterói (seção 2) = R$ 7,10 por sentido; percurso inteiro = R$ 15,10', () => {
    const secao = calcularDia({
      itinerario: { ida: [perna('onibus_intermunicipal', '416M', 0, 2)], volta: [perna('onibus_intermunicipal', '416M', 0, 2)] },
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(secao.ida.valorCentavos).toBe(710)
    expect(secao.valorCentavos).toBe(1420)
    expect(secao.status).toBe('confirmado')
    const inteiro = calcularSentido({ pernas: [perna('onibus_intermunicipal', '416M', 0, 0)], cartao: ATIVO, dataServico: DATA })
    expect(inteiro.valorCentavos).toBe(1510)
  })

  it('linha de valor único não gera opções nem pendência de seção', () => {
    expect(opcoesSecaoDetro('484M')).toEqual([])
    const r = calcularSentido({ pernas: [perna('onibus_intermunicipal', '484M')], cartao: ATIVO, dataServico: DATA })
    expect(r.pendencias.some((p) => p.codigo === 'DETRO_SECAO_ESCOLHER')).toBe(false)
  })

  it('outras linhas citadas na Portaria: 414M e 413M têm seção própria', () => {
    expect(opcoesSecaoDetro('414M').find((o) => o.secao === 1)?.valorCentavos).toBe(710)
    expect(opcoesSecaoDetro('413M').find((o) => o.secao === 1)?.valorCentavos).toBe(910)
  })

  it('número de seção inexistente continua pendência (não chuta)', () => {
    const r = calcularSentido({ pernas: [perna('onibus_intermunicipal', '416M', 0, 9)], cartao: ATIVO, dataServico: DATA })
    expect(r.valorCentavos).toBeNull()
    expect(r.pendencias[0].codigo).toBe('DETRO_SECAO_NAO_ENCONTRADA')
  })
})

describe('ônibus municipal gratuito (Itaboraí/Maricá)', () => {
  it('perna gratuita custa R$ 0 e dia só com gratuito fecha em R$ 0 confirmado', () => {
    const r = calcularDia({
      itinerario: { ida: [perna('onibus_municipal_gratuito', '100')], volta: [perna('onibus_municipal_gratuito', '100')] },
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.valorCentavos).toBe(0)
    expect(r.status).toBe('confirmado')
  })

  it('gratuito + DETRO: cobra só o DETRO (e a seção escolhida), sem integração', () => {
    const r = calcularSentido({
      pernas: [perna('onibus_municipal_gratuito', '100'), perna('onibus_intermunicipal', '416M', 20, 2)],
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.valorCentavos).toBe(710)
    expect(r.status).toBe('confirmado')
    expect(r.explicacao.some((p) => p.texto.includes('gratuito'))).toBe(true)
  })

  it('gratuito + DETRO acima do BUI segue com a pendência "BUI direto" já existente', () => {
    const r = calcularSentido({
      pernas: [perna('onibus_municipal_gratuito', '100'), perna('onibus_intermunicipal', '416M', 20, 0)],
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.valorCentavos).toBe(1510)
    expect(r.pendencias.map((p) => p.codigo)).toContain('BUI_DIRETO_PENDENTE')
  })

  it('operadora conhecida vira gratuita; desconhecida NÃO é presumida gratuita', () => {
    expect(municipioGratuitoDaOperadora('Prefeitura de Itaboraí')).toBe('Itaboraí')
    expect(municipioGratuitoDaOperadora('Empresa Pública de Transportes')).toBe('Maricá')
    expect(municipioGratuitoDaOperadora('Viação Qualquer de Itaboraí')).toBeNull()

    const resposta = (operadora: string) => ({
      routes: [{
        legs: [{
          steps: [{
            travelMode: 'TRANSIT',
            transitDetails: {
              stopDetails: { departureStop: { name: 'A' }, arrivalStop: { name: 'B' }, departureTime: '2026-11-23T09:00:00Z', arrivalTime: '2026-11-23T09:30:00Z' },
              transitLine: { nameShort: '100', vehicle: { type: 'BUS' }, agencies: [{ name: operadora }] },
            },
          }],
        }],
      }],
    })
    const contexto = { consultadoEm: '2026-11-21T00:00:00Z', precisao: 'exata' as const, sentido: 'ida' as const, municipioOrigem: 'Itaboraí', municipioDestino: 'Itaboraí' }
    const gratis = adaptarRotasGoogle(resposta('Prefeitura de Itaboraí'), contexto)[0].itinerario.pernas[0]
    expect(pernaMotorDeItinerario(gratis).perna.modal).toBe('onibus_municipal_gratuito')
    const incerta = adaptarRotasGoogle(resposta('Transporte Local de Itaboraí'), contexto)[0].itinerario.pernas[0]
    const motor = pernaMotorDeItinerario(incerta).perna
    expect(motor.modal).toBe('outro')
    const r = calcularSentido({ pernas: [motor], cartao: ATIVO, dataServico: DATA })
    expect(r.valorCentavos).toBeNull()
  })

  it('código da linha na tabela DETRO vence a operadora informada pelo Google', () => {
    const resposta = {
      routes: [{
        legs: [{
          steps: [{
            travelMode: 'TRANSIT',
            transitDetails: {
              stopDetails: { departureStop: { name: 'A' }, arrivalStop: { name: 'B' }, departureTime: '2026-11-23T09:00:00Z', arrivalTime: '2026-11-23T09:30:00Z' },
              transitLine: { nameShort: '416M', vehicle: { type: 'BUS' }, agencies: [{ name: 'Prefeitura de Niterói' }] },
            },
          }],
        }],
      }],
    }
    const p = adaptarRotasGoogle(resposta, { consultadoEm: 'x', precisao: 'exata', sentido: 'ida', municipioOrigem: 'Niterói', municipioDestino: 'Niterói' })[0].itinerario.pernas[0]
    expect(p.escopo).toBe('intermunicipal')
    expect(p.sistemaTarifario).toBe('detro')
  })
})

describe('linhas AC de Maricá (2144R/4144R)', () => {
  it('BUI não é presumido: pendência visível, valor cheio R$ 27,75', () => {
    const r = calcularSentido({ pernas: [perna('onibus_intermunicipal', '2144R')], cartao: ATIVO, dataServico: DATA })
    expect(r.valorCentavos).toBe(2775)
    expect(r.status).toBe('pendente')
    expect(r.pendencias.map((p) => p.codigo)).toContain('BUI_LINHA_AC_NAO_CONFIRMADA')
  })

  it('combinada com outro ônibus intermunicipal não integra pelo BUI', () => {
    const r = calcularSentido({
      pernas: [perna('onibus_intermunicipal', '4144R'), perna('onibus_intermunicipal', '542R', 20)],
      cartao: ATIVO,
      dataServico: DATA,
    })
    expect(r.valorCentavos).toBe(2775 + 710)
    expect(r.pendencias.map((p) => p.codigo)).toContain('BUI_LINHA_AC_NAO_CONFIRMADA')
  })
})
