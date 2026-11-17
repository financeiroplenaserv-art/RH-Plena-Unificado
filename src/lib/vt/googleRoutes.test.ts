import { describe, expect, it } from 'vitest'
import { adaptarRotasGoogle, removerPernaAlternativa } from './googleRoutes'
import { RESPOSTA_ACACIO, RESPOSTA_ALCEMIR } from './googleRoutesFixture'
import { cotarCatraca } from './cotarCatraca'
import { REGRAS_OFICIAIS_VT } from './regrasOficiais'
import type { FatosCartaoVT } from './contratosTarifarios'

const CONTEXTO = {
  consultadoEm: '2026-11-16T12:00:00Z',
  precisao: 'exata' as const,
  sentido: 'ida' as const,
  municipioOrigem: 'Niterói',
  municipioDestino: 'Niterói',
}

const CARTAO_ATIVO: FatosCartaoVT = {
  personalizacao: 'usuario',
  vinculadoCpf: true,
  bui: 'ativo',
  bun: 'ativo',
  jae: 'disponivel',
  situacaoConsultadaEm: '2026-10-28',
}

describe('adaptarRotasGoogle', () => {
  it('preserva a alternativa direta do Acacio e calcula 2 × R$ 5,60 por dia', () => {
    const alternativas = adaptarRotasGoogle(RESPOSTA_ACACIO, CONTEXTO)
    expect(alternativas).toHaveLength(2)
    expect(alternativas[0]).toMatchObject({ id: 'google-1', distanciaMetros: 20064, duracaoSegundos: 3326 })
    expect(alternativas[0].itinerario.pernas).toHaveLength(1)
    expect(alternativas[0].itinerario.pernas[0]).toMatchObject({
      linha: '39A',
      operadora: 'Prefeitura de Niterói',
      escopo: 'municipal',
      sistemaTarifario: 'riocard',
      municipioOrigem: 'Niterói',
      municipioDestino: 'Niterói',
      embarque: { dataHoraPrevista: '2026-11-23T06:57:24Z' },
      tarifaCentavos: null,
    })

    const cotacao = cotarCatraca(alternativas[0].itinerario, CARTAO_ATIVO, REGRAS_OFICIAIS_VT, '2026-11-23')
    expect(cotacao.status).toBe('confirmavel')
    expect(cotacao.totalEstimadoCentavos).toBe(560)
    expect(cotacao.totalEstimadoCentavos! * 2).toBe(1120)
  })

  it('alternativa com 1910D não recebe valor por falta de tarifa conhecida', () => {
    const alternativa = adaptarRotasGoogle(RESPOSTA_ACACIO, CONTEXTO)[1]
    const cotacao = cotarCatraca(alternativa.itinerario, CARTAO_ATIVO, REGRAS_OFICIAIS_VT, '2026-11-23')

    expect(cotacao.status).toBe('indeterminado')
    expect(cotacao.totalEstimadoCentavos).toBeNull()
    expect(cotacao.pendencias.some((pendencia) => pendencia.codigo === 'TARIFA_DESCONHECIDA')).toBe(true)
    expect(cotacao.integracoes.some((integracao) => integracao.regraId.includes('excecao'))).toBe(true)
  })

  it('Alcemir com BU suspenso paga 536R + 35 pela tarifa integral, sem desconto', () => {
    const alternativa = adaptarRotasGoogle(RESPOSTA_ALCEMIR, {
      ...CONTEXTO,
      municipioOrigem: 'São Gonçalo',
    })
    const cotacao = cotarCatraca(alternativa[0].itinerario, {
      ...CARTAO_ATIVO,
      bui: 'suspenso',
      bun: 'nao_consultado',
    }, REGRAS_OFICIAIS_VT, '2026-11-23')

    expect(cotacao.status).toBe('confirmavel')
    expect(cotacao.totalEstimadoCentavos).toBe(1470)
    expect(cotacao.totalEstimadoCentavos! * 2).toBe(2940)
  })

  it('alternativas via Centro usam as tarifas oficiais da DETRO', () => {
    const alternativas = adaptarRotasGoogle(RESPOSTA_ALCEMIR, CONTEXTO)
    const totais = alternativas.slice(2).map((alternativa) =>
      cotarCatraca(alternativa.itinerario, CARTAO_ATIVO, REGRAS_OFICIAIS_VT, '2026-11-23').totalEstimadoCentavos,
    )

    expect(totais).toEqual([1270, 560, 1985, 1985])
  })

  it('três conduções ficam explicitamente fora da confirmação automática', () => {
    const alternativa = adaptarRotasGoogle(RESPOSTA_ALCEMIR, CONTEXTO)[1]
    const cotacao = cotarCatraca(alternativa.itinerario, CARTAO_ATIVO, REGRAS_OFICIAIS_VT, '2026-11-23')

    expect(cotacao.status).toBe('indeterminado')
    expect(cotacao.pendencias.some((pendencia) => pendencia.codigo === 'SEQUENCIA_COM_MAIS_DE_DUAS_PERNAS')).toBe(true)
  })

  it('operadora desconhecida vira pendência e não preço presumido', () => {
    const alternativas = adaptarRotasGoogle({
      routes: [{
        legs: [{
          steps: [{
            travelMode: 'TRANSIT',
            transitDetails: {
              transitLine: { nameShort: 'X', vehicle: { type: 'BUS' }, agencies: [{ name: 'Desconhecida' }] },
            },
          }],
        }],
      }],
    }, CONTEXTO)

    expect(alternativas[0].avisos.join(' ')).toContain('operadora sem classificação tarifária')
    expect(alternativas[0].itinerario.pernas[0].sistemaTarifario).toBe('desconhecido')
  })
})


describe('62 + 39A e BUN', () => {
  it('com BUN ativo e transferência de 18 minutos, cobra só a primeira perna', () => {
    const alternativa = adaptarRotasGoogle(RESPOSTA_ALCEMIR, CONTEXTO)[3]
    const cotacao = cotarCatraca(alternativa.itinerario, CARTAO_ATIVO, REGRAS_OFICIAIS_VT, '2026-11-23')

    expect(cotacao.status).toBe('confirmavel')
    expect(cotacao.alternativaEscolhidaId).toBe('bun')
    expect(cotacao.totalEstimadoCentavos).toBe(560)
    expect(cotacao.totalEstimadoCentavos! * 2).toBe(1120)
    expect(cotacao.pernas[1].cobradoEstimadoCentavos).toBe(0)
  })

  it('com BUN não confirmado, mantém a tarifa integral e mostra a pendência', () => {
    const alternativa = adaptarRotasGoogle(RESPOSTA_ALCEMIR, CONTEXTO)[3]
    const cotacao = cotarCatraca(alternativa.itinerario, {
      ...CARTAO_ATIVO,
      bui: 'suspenso',
      bun: 'nao_consultado',
    }, REGRAS_OFICIAIS_VT, '2026-11-23')

    expect(cotacao.status).toBe('parcial')
    expect(cotacao.totalEstimadoCentavos).toBe(1120)
    expect(cotacao.pendencias.some((pendencia) => pendencia.codigo === 'BUN_NAO_CONFIRMADO')).toBe(true)
    expect(cotacao.pendencias.some((pendencia) => pendencia.codigo === 'JANELA_BUN_EXCEDIDA')).toBe(false)
  })
})



describe('removerPernaAlternativa', () => {
  it('tira o segundo ônibus, recalcula o preço e preserva a remoção na evidência', () => {
    const original = adaptarRotasGoogle(RESPOSTA_ALCEMIR, CONTEXTO)[3]
    const editada = removerPernaAlternativa(original, 2)

    expect(editada.itinerario.pernas).toHaveLength(1)
    expect(editada.itinerario.pernas[0]).toMatchObject({ sequencia: 1, linha: '62' })
    expect(editada.itinerario.ajustesManuais).toEqual([
      { tipo: 'remocao_perna', perna: expect.objectContaining({ sequencia: 2, linha: '39A' }) },
    ])
    expect(editada.distanciaMetros).toBeNull()
    expect(editada.duracaoSegundos).toBeNull()
    expect(editada.avisos.at(-1)).toContain('retirada manualmente')
    expect(original.itinerario.pernas).toHaveLength(2)
    expect(original.itinerario.ajustesManuais).toBeUndefined()

    const cotacao = cotarCatraca(editada.itinerario, CARTAO_ATIVO, REGRAS_OFICIAIS_VT, '2026-11-23')
    expect(cotacao.totalEstimadoCentavos).toBe(560)
  })

  it('não permite deixar o itinerário sem condução', () => {
    const original = adaptarRotasGoogle(RESPOSTA_ACACIO, CONTEXTO)[0]
    expect(() => removerPernaAlternativa(original, 1)).toThrow('única condução')
  })
})
