import { describe, expect, it } from 'vitest'
import type { ItinerarioVT, PernaItinerarioVT } from '@/lib/vt/contratosTarifarios'
import { linhasOrcadasDoItinerario } from '@/lib/vt/linhasOrcadas'

function perna(linha: string | null, sentido: 'ida' | 'volta', sequencia: number): PernaItinerarioVT {
  return {
    sequencia,
    linha,
    variante: null,
    operadora: null,
    modal: linha ? 'onibus' : 'trem',
    categoriaServico: 'convencional',
    sistemaTarifario: 'municipal_niteroi',
    escopo: 'municipal',
    municipioOrigem: 'Niterói',
    municipioDestino: 'Niterói',
    sentido,
    embarque: { local: 'A', dataHoraPrevista: null },
    desembarque: { local: 'B', dataHoraPrevista: null },
    tarifaCentavos: null,
    tarifaVigenteDesde: null,
  } as unknown as PernaItinerarioVT
}

function itinerario(pernas: PernaItinerarioVT[], valorDia?: number): ItinerarioVT {
  return {
    pernas,
    provedor: 'google_routes',
    consultadoEm: '2026-11-19T10:00:00Z',
    precisao: 'exata',
    evidenciaHash: null,
    ...(valorDia === undefined
      ? {}
      : {
          calculoMotor: {
            versao: 'motor_v1',
            dataServico: '2026-11-19',
            status: 'confirmado',
            valorDiaCentavos: valorDia,
            idaCentavos: valorDia / 2,
            voltaCentavos: valorDia / 2,
            alternativaIdaId: 'a',
            alternativaVoltaId: 'b',
            cartao: { situacaoBu: 'Ativado', consultadoEm: null },
            pendencias: [],
          },
        }),
  } as unknown as ItinerarioVT
}

describe('linhasOrcadasDoItinerario', () => {
  it('ida e volta diferentes: mostra as duas, com o valor do dia do motor', () => {
    const r = linhasOrcadasDoItinerario(
      itinerario([perna('62', 'ida', 1), perna('39A', 'ida', 2), perna('39A', 'volta', 1), perna('62', 'volta', 2)], 890),
    )
    expect(r?.texto).toBe('Ida: 62 → 39A · Volta: 39A → 62')
    expect(r?.valorDiaCentavos).toBe(890)
  })

  it('ida e volta iguais: "Ida e volta"', () => {
    const r = linhasOrcadasDoItinerario(itinerario([perna('404m', 'ida', 1), perna('404M', 'volta', 1)]))
    expect(r?.texto).toBe('Ida e volta: 404M')
    expect(r?.valorDiaCentavos).toBeNull()
  })

  it('evidência antiga sem volta: "Volta: não registrada"', () => {
    const r = linhasOrcadasDoItinerario(itinerario([perna('422M', 'ida', 1)]))
    expect(r?.texto).toBe('Ida: 422M · Volta: não registrada')
  })

  it('sem número de linha usa o modal; sem pernas devolve null', () => {
    expect(linhasOrcadasDoItinerario(itinerario([perna(null, 'ida', 1)]))?.ida).toEqual(['trem'])
    expect(linhasOrcadasDoItinerario(itinerario([]))).toBeNull()
  })
})
