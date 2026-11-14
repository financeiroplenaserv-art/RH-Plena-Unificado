import { describe, expect, it } from 'vitest'
import { adaptarDecisoesTrajetoLegado, adaptarPacotesLegados, compararPacoteLegadoComCotacao } from '@/lib/vt/adaptadoresLegados'
import { cotarCatraca } from '@/lib/vt/cotarCatraca'
import { REGRAS_OFICIAIS_VT } from '@/lib/vt/regrasOficiais'
import type { VtBilhete, VtTrajeto } from '@/types/vt'
import type { FatosCartaoVT, PernaItinerarioVT } from '@/lib/vt/contratosTarifarios'

function bilhete(parcial: Partial<VtBilhete>): VtBilhete {
  return {
    id: 'preco-1',
    nome: 'BU NITERÓI',
    valor_diario_centavos: 1120,
    vigente_desde: '2026-10-21',
    ativo: true,
    cartao_necessario: 'bun',
    usa_integracao: true,
    ...parcial,
  }
}

describe('adaptarPacotesLegados', () => {
  it('separa identidade estável do pacote das versões de preço e fecha vigências', () => {
    const adaptado = adaptarPacotesLegados([
      bilhete({ id: 'v1', valor_diario_centavos: 1000, vigente_desde: '2026-01-01', ativo: false }),
      bilhete({ id: 'v2', valor_diario_centavos: 1120, vigente_desde: '2026-10-21' }),
    ])

    expect(adaptado.pacotes).toHaveLength(1)
    expect(adaptado.versoes.map((versao) => versao.pacoteId)).toEqual(['legado_bu_niteroi', 'legado_bu_niteroi'])
    expect(adaptado.versoes[0].vigenteAte).toBe('2026-10-20')
    expect(adaptado.versoes[1].vigenteAte).toBeNull()
    expect(adaptado.pacoteIdPorBilheteId.get('v1')).toBe('legado_bu_niteroi')
    expect(adaptado.requisitos[0].cartao).toBe('riocard_bun')
  })

  it('adapta os dois pacotes do trajeto sem inventar vigência desconhecida', () => {
    const adaptado = adaptarPacotesLegados([
      bilhete({ id: 'b1' }),
      bilhete({ id: 'b2', nome: 'TREM', cartao_necessario: 'comum', usa_integracao: false }),
    ])
    const trajeto: VtTrajeto = {
      id: 'tr1',
      colaborador_id: 'c1',
      departamento_id: 'd1',
      bilhete_id: 'b1',
      bilhete_2_id: 'b2',
      escopo: 'niteroi_municipal',
      precisao_origem: 'bairro',
      origem: 'manual',
      status: 'confirmado',
      valor_extra_centavos: 0,
      observacao: null,
      confirmado_por: 'u1',
      confirmado_em: '2026-11-01T10:00:00Z',
    }
    const decisoes = adaptarDecisoesTrajetoLegado(trajeto, adaptado.pacoteIdPorBilheteId, 'cotacao-1')

    expect(decisoes).toHaveLength(2)
    expect(decisoes[0].cotacaoId).toBe('cotacao-1')
    expect(decisoes[0].vigenteDesde).toBeNull()
    expect(decisoes.every((decisao) => decisao.status === 'confirmada')).toBe(true)
  })
})

describe('compararPacoteLegadoComCotacao', () => {
  const cartao: FatosCartaoVT = {
    personalizacao: 'usuario', vinculadoCpf: true, bui: 'ativo', bun: 'ativo', jae: 'disponivel', situacaoConsultadaEm: '2026-11-14',
  }
  const perna100D: PernaItinerarioVT = {
    sequencia: 1,
    linha: '100D',
    variante: null,
    operadora: 'Detro',
    modal: 'onibus',
    categoriaServico: 'urbano_convencional',
    sistemaTarifario: 'detro',
    escopo: 'intermunicipal',
    municipioOrigem: 'Niterói',
    municipioDestino: 'Rio de Janeiro',
    sentido: 'ida',
    embarque: { local: 'A', dataHoraPrevista: '2026-11-16T09:00:00Z' },
    desembarque: { local: 'B', dataHoraPrevista: '2026-11-16T10:00:00Z' },
    tarifaCentavos: null,
    tarifaVigenteDesde: '2026-02-15',
  }

  it('compara ida e volta e sinaliza separadamente a pendência patronal do BUI direto', () => {
    const cotacao = cotarCatraca(
      { pernas: [perna100D], provedor: 'manual', consultadoEm: '2026-11-14', precisao: 'manual', evidenciaHash: 'x' },
      cartao,
      REGRAS_OFICIAIS_VT,
      '2026-11-16',
    )
    const comparacao = compararPacoteLegadoComCotacao(1420, cotacao)

    expect(comparacao.status).toBe('divergente')
    expect(comparacao.valorCotadoDiaCentavos).toBe(1880)
    expect(comparacao.diferencaCentavos).toBe(460)
    expect(comparacao.basePatronalPendente).toBe(true)
  })
})
