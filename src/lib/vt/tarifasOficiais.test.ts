import { describe, expect, it } from 'vitest'
import { cotarCatraca } from '@/lib/vt/cotarCatraca'
import { tarifaLinhaDetro } from '@/lib/vt/tarifasOficiais'
import { REGRA_DETRO_2026, REGRAS_OFICIAIS_VT } from '@/lib/vt/regrasOficiais'
import type { FatosCartaoVT, PernaItinerarioVT } from '@/lib/vt/contratosTarifarios'

const CARTAO_DESCONHECIDO: FatosCartaoVT = {
  personalizacao: 'desconhecida',
  vinculadoCpf: null,
  bui: 'nao_consultado',
  bun: 'nao_consultado',
  jae: 'nao_informado',
  situacaoConsultadaEm: null,
}

function perna(linha: string, sequencia = 1): PernaItinerarioVT {
  return {
    sequencia,
    linha,
    variante: null,
    operadora: 'Semove - Intermunicipal',
    modal: 'onibus',
    categoriaServico: 'urbano_convencional',
    sistemaTarifario: 'detro',
    escopo: 'intermunicipal',
    municipioOrigem: 'Niterói',
    municipioDestino: 'São Gonçalo',
    sentido: 'ida',
    embarque: { local: 'A', dataHoraPrevista: '2026-11-17T09:00:00Z' },
    desembarque: { local: 'B', dataHoraPrevista: '2026-11-17T09:30:00Z' },
    tarifaCentavos: null,
    tarifaVigenteDesde: null,
  }
}

function cotar(pernas: PernaItinerarioVT[], dataServico = '2026-11-17') {
  return cotarCatraca({
    pernas,
    provedor: 'manual',
    consultadoEm: '2026-11-17T12:00:00Z',
    precisao: 'manual',
    evidenciaHash: null,
  }, CARTAO_DESCONHECIDO, REGRAS_OFICIAIS_VT, dataServico)
}

describe('catálogo oficial de tarifas', () => {
  it('mantém linha, valor, vigência e fonte na mesma regra', () => {
    expect(tarifaLinhaDetro('416M')).toBe(1510)
    expect(tarifaLinhaDetro('414M')).toBe(1510)
    expect(tarifaLinhaDetro('5721D')).toBe(1170)
    expect(tarifaLinhaDetro('587M')).toBe(710)
    expect(tarifaLinhaDetro('721D')).toBe(1425)
    expect(tarifaLinhaDetro('linha sem prova')).toBeNull()

    const regra = REGRAS_OFICIAIS_VT.find((item) => item.id === REGRA_DETRO_2026)
    expect(regra).toMatchObject({
      vigenteDesde: '2026-02-15',
      fonte: {
        titulo: 'Portaria DETRO/PRES 1.960/2026',
        url: expect.stringContaining('Portaria-DETRO-Reajuste-2026.pdf'),
      },
    })
  })

  it('416M fica mais em conta que 5721D + 62 pela tarifa integral', () => {
    const direta = cotar([perna('416M')])
    const combinada = cotar([
      perna('5721D'),
      {
        ...perna('62', 2),
        operadora: 'Prefeitura de Niterói',
        sistemaTarifario: 'riocard',
        escopo: 'municipal',
        municipioOrigem: 'Niterói',
        municipioDestino: 'Niterói',
      },
    ])

    expect(direta.totalEstimadoCentavos).toBe(1510)
    expect(combinada.totalEstimadoCentavos).toBe(1730)
    expect(direta.totalEstimadoCentavos! * 2).toBe(3020)
    expect(combinada.totalEstimadoCentavos! * 2).toBe(3460)
    expect(direta.totalEstimadoCentavos!).toBeLessThan(combinada.totalEstimadoCentavos!)
  })

  it('não aplica a tarifa nova antes da vigência', () => {
    expect(cotar([perna('416M')], '2026-02-14').totalEstimadoCentavos).toBeNull()
    expect(cotar([perna('416M')], '2026-02-15').totalEstimadoCentavos).toBe(1510)
  })
})
