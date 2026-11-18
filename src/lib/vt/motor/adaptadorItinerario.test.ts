import { describe, expect, it } from 'vitest'
import { adaptarRotasGoogle, type RespostaGoogleRoutes } from '@/lib/vt/googleRoutes'
import { RESPOSTA_ACACIO, RESPOSTA_ALCEMIR } from '@/lib/vt/googleRoutesFixture'
import {
  fatosCartaoDoCadastro,
  pernaMotorDeItinerario,
  pernasMotorDoItinerario,
  situacaoBuDoCadastro,
} from '@/lib/vt/motor/adaptadorItinerario'
import { calcularAlternativaSentido, calcularDiaIdaVolta, combinarIdaVolta, MOTOR_COTACAO_ID } from '@/lib/vt/motor/idaVolta'
import type { FatosCartaoMotor } from '@/lib/vt/motor/tipos'

const CONTEXTO = {
  consultadoEm: '2026-11-18T12:00:00.000Z',
  precisao: 'exata' as const,
  sentido: 'ida' as const,
  municipioOrigem: 'São Gonçalo',
  municipioDestino: 'Niterói',
}
const DATA = '2026-11-23'
const ATIVADO: FatosCartaoMotor = { situacaoBu: 'Ativado', consultadoEm: '2026-10-28' }
const SUSPENSO: FatosCartaoMotor = { situacaoBu: 'Suspenso Setrans', consultadoEm: '2026-10-28' }

function linhas(resposta: RespostaGoogleRoutes) {
  return adaptarRotasGoogle(resposta, CONTEXTO)
}

function umaPerna(nameShort: string, agencia: string, tipo = 'BUS', partida: string | undefined = '2026-11-23T06:00:00Z') {
  return linhas({
    routes: [{
      legs: [{
        steps: [{
          travelMode: 'TRANSIT',
          transitDetails: {
            stopDetails: { departureTime: partida, arrivalTime: partida },
            transitLine: { nameShort, vehicle: { type: tipo }, agencies: [{ name: agencia }] },
          },
        }],
      }],
    }],
  })[0].itinerario.pernas[0]
}

describe('adaptador Google → motor', () => {
  it('Acacio: 39A é ônibus municipal de Niterói, com horário de embarque com fuso', () => {
    const [alt] = linhas(RESPOSTA_ACACIO)
    const { pernas, avisos } = pernasMotorDoItinerario(alt.itinerario.pernas)
    expect(pernas).toEqual([{
      modal: 'onibus_municipal_niteroi',
      linha: '39A',
      secao: null,
      embarqueEm: '2026-11-23T06:57:24Z',
      operadora: 'Prefeitura de Niterói',
    }])
    expect(avisos).toEqual([])
    expect(calcularAlternativaSentido(alt, ATIVADO, DATA).resultado).toMatchObject({ valorCentavos: 560, status: 'confirmado' })
  })

  it('Alcemir: 536R é intermunicipal (DETRO) e 35 é municipal de Niterói', () => {
    const alt = linhas(RESPOSTA_ALCEMIR)[0]
    const { pernas } = pernasMotorDoItinerario(alt.itinerario.pernas)
    expect(pernas.map((p) => [p.linha, p.modal])).toEqual([
      ['536R', 'onibus_intermunicipal'],
      ['35', 'onibus_municipal_niteroi'],
    ])
    const r = calcularAlternativaSentido(alt, ATIVADO, DATA).resultado
    // BUI não cobre municipal de Niterói: 9,10 + 5,60 cobrados à parte.
    expect(r.valorCentavos).toBe(1470)
  })

  it('Alcemir 62 + 39A: BU Ativado integra pelo BUN (R$ 5,60); Suspenso cobra integral (R$ 11,20) com pendência', () => {
    const alt = linhas(RESPOSTA_ALCEMIR).find((a) => a.itinerario.pernas.map((p) => p.linha).join('+') === '62+39A')!
    expect(pernasMotorDoItinerario(alt.itinerario.pernas).pernas.every((p) => p.modal === 'onibus_municipal_niteroi')).toBe(true)

    const ativado = calcularAlternativaSentido(alt, ATIVADO, DATA).resultado
    expect(ativado).toMatchObject({ valorCentavos: 560, status: 'confirmado' })

    const suspenso = calcularAlternativaSentido(alt, SUSPENSO, DATA).resultado
    expect(suspenso.valorCentavos).toBe(1120)
    expect(suspenso.status).toBe('pendente')
    expect(suspenso.pendencias.map((p) => p.codigo)).toContain('BUN_PROVAVEL_NAO_COMPROVADO')
  })

  it('422M e 570D da "Prefeitura de Niterói" viram intermunicipal DETRO', () => {
    for (const linha of ['422M', '570D']) {
      expect(pernaMotorDeItinerario(umaPerna(linha, 'Prefeitura de Niterói')).perna.modal).toBe('onibus_intermunicipal')
    }
  })

  it('municipal de São Gonçalo e do Rio, trem, metrô, barca e VLT', () => {
    expect(pernaMotorDeItinerario(umaPerna('20', 'Semove - São Gonçalo')).perna.modal).toBe('onibus_municipal_sao_goncalo')
    expect(pernaMotorDeItinerario(umaPerna('474', 'Prefeitura do Rio de Janeiro')).perna.modal).toBe('onibus_municipal_rio')
    expect(pernaMotorDeItinerario(umaPerna('Deodoro', 'SuperVia', 'HEAVY_RAIL')).perna.modal).toBe('trem')
    expect(pernaMotorDeItinerario(umaPerna('Linha 1', 'MetrôRio', 'SUBWAY')).perna.modal).toBe('metro')
    expect(pernaMotorDeItinerario(umaPerna('Arariboia', 'CCR Barcas', 'FERRY')).perna.modal).toBe('barca')
    expect(pernaMotorDeItinerario(umaPerna('VLT 1', 'VLT Carioca', 'LIGHT_RAIL')).perna.modal).toBe('vlt')
  })

  it('na dúvida vira "outro" (motor devolve indeterminado): operadora desconhecida, micro-ônibus, veículo desconhecido', () => {
    const desconhecida = pernaMotorDeItinerario(umaPerna('999', 'Viação Qualquer'))
    expect(desconhecida.perna.modal).toBe('outro')
    expect(desconhecida.aviso).toMatch(/sem classificação tarifária/)
    expect(pernaMotorDeItinerario(umaPerna('39A', 'Prefeitura de Niterói', 'MINIBUS')).perna.modal).toBe('outro')
    expect(pernaMotorDeItinerario(umaPerna('39A', 'Prefeitura de Niterói', 'CABLE_CAR')).perna.modal).toBe('outro')

    const alt = linhas({
      routes: [{ legs: [{ steps: [{ travelMode: 'TRANSIT', transitDetails: { transitLine: { nameShort: '999', vehicle: { type: 'BUS' }, agencies: [{ name: 'Viação Qualquer' }] } } }] }] }],
    })[0]
    expect(calcularAlternativaSentido(alt, ATIVADO, DATA).resultado.status).toBe('indeterminado')
  })

  it('horário sem fuso é descartado (nunca lido no fuso da máquina)', () => {
    const adaptada = pernaMotorDeItinerario(umaPerna('39A', 'Prefeitura de Niterói', 'BUS', '2026-11-23T06:00:00'))
    expect(adaptada.perna.embarqueEm).toBeNull()
    expect(adaptada.aviso).toMatch(/sem fuso/)
    expect(pernaMotorDeItinerario(umaPerna('39A', 'Prefeitura de Niterói', 'BUS', '2026-11-23T06:00:00-03:00')).perna.embarqueEm)
      .toBe('2026-11-23T06:00:00-03:00')
  })

  it('fatos do cartão vêm do cadastro; texto desconhecido = sem consulta', () => {
    expect(situacaoBuDoCadastro(' ativado ')).toBe('Ativado')
    expect(situacaoBuDoCadastro('Suspenso Setrans')).toBe('Suspenso Setrans')
    expect(situacaoBuDoCadastro('qualquer coisa')).toBeNull()
    expect(situacaoBuDoCadastro(null)).toBeNull()
    expect(fatosCartaoDoCadastro('Não possui BU', '2026-10-28')).toEqual({
      situacaoBu: 'Não possui BU',
      consultadoEm: '2026-10-28',
      bunConfirmadoNoPortal: null,
    })
  })
})

describe('ida e volta pelo motor', () => {
  const alt62 = () => linhas(RESPOSTA_ALCEMIR).find((a) => a.itinerario.pernas.map((p) => p.linha).join('+') === '62+39A')!
  const voltaAlternativa = () => adaptarRotasGoogle(RESPOSTA_ACACIO, { ...CONTEXTO, sentido: 'volta' })[0]

  it('valor do dia = ida + volta escolhidas (volta diferente da ida)', () => {
    const dia = calcularDiaIdaVolta(alt62(), voltaAlternativa(), ATIVADO, DATA)
    expect(dia.ida.valorCentavos).toBe(560)
    expect(dia.volta.valorCentavos).toBe(560)
    expect(dia).toMatchObject({ valorCentavos: 1120, status: 'confirmado' })
  })

  it('evidência combinada guarda as pernas com sentido e o cálculo do motor', () => {
    const ida = alt62()
    const volta = voltaAlternativa()
    const dia = calcularDiaIdaVolta(ida, volta, ATIVADO, DATA)
    const combinada = combinarIdaVolta(ida, volta, dia, ATIVADO, DATA)

    expect(combinada.id).toBe(`ida:${ida.id}|volta:${volta.id}`)
    expect(combinada.itinerario.pernas.map((p) => [p.sentido, p.sequencia, p.linha])).toEqual([
      ['ida', 1, '62'],
      ['ida', 2, '39A'],
      ['volta', 1, '39A'],
    ])
    expect(combinada.itinerario.calculoMotor).toMatchObject({
      versao: MOTOR_COTACAO_ID,
      valorDiaCentavos: 1120,
      idaCentavos: 560,
      voltaCentavos: 560,
      status: 'confirmado',
      cartao: { situacaoBu: 'Ativado', consultadoEm: '2026-10-28' },
    })
    expect(combinada.distanciaMetros).toBe((ida.distanciaMetros ?? 0) + (volta.distanciaMetros ?? 0))
  })
})
