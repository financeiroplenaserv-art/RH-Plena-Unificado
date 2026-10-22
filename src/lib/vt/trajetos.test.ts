import { describe, expect, it } from 'vitest'
import { custoDiaTrajetoCentavos, escopoSugerido, paresDaEscala } from '@/lib/vt/trajetos'
import type { VtCombinacao, VtTrajeto } from '@/types/vt'

const BU_NITEROI: VtCombinacao = {
  id: 'c2',
  nome: 'BU NITERÓI',
  valor_diario_centavos: 1120,
  vigente_desde: '2026-10-21',
  ativo: true,
}

const TREM: VtCombinacao = {
  id: 'c5',
  nome: 'TREM',
  valor_diario_centavos: 1580,
  vigente_desde: '2026-10-21',
  ativo: true,
}

function trajeto(parcial: Partial<VtTrajeto>): VtTrajeto {
  return {
    id: 'tr1',
    colaborador_id: 'c1',
    departamento_id: 'd1',
    combinacao_id: BU_NITEROI.id,
    combinacao_2_id: null,
    escopo: 'niteroi_municipal',
    precisao_origem: 'bairro',
    origem: 'manual',
    status: 'sugerido',
    observacao: null,
    confirmado_por: null,
    confirmado_em: null,
    ...parcial,
  }
}

describe('custoDiaTrajetoCentavos', () => {
  it('trajeto com 1 combinação vale o valor diário dela', () => {
    expect(custoDiaTrajetoCentavos(trajeto({}), [BU_NITEROI, TREM], '2026-10-21')).toBe(1120)
  })

  it('trajeto com 2 combinações soma os valores diários', () => {
    expect(custoDiaTrajetoCentavos(trajeto({ combinacao_2_id: TREM.id }), [BU_NITEROI, TREM], '2026-10-21')).toBe(2700)
  })

  it('null quando a combinação não está vigente na data', () => {
    expect(custoDiaTrajetoCentavos(trajeto({}), [BU_NITEROI], '2026-10-20')).toBeNull()
    const inativa: VtCombinacao = { ...BU_NITEROI, ativo: false }
    expect(custoDiaTrajetoCentavos(trajeto({}), [inativa], '2026-10-21')).toBeNull()
  })

  it('usa a vigência mais recente da combinação (mesmo nome, valor novo)', () => {
    const antiga: VtCombinacao = { ...BU_NITEROI, id: 'c2a', valor_diario_centavos: 900, vigente_desde: '2026-01-01' }
    expect(custoDiaTrajetoCentavos(trajeto({ combinacao_id: 'c2a' }), [antiga], '2026-06-01')).toBe(900)
  })
})

describe('paresDaEscala', () => {
  it('deduplica colaborador × departamento e ignora departamento null', () => {
    const pares = paresDaEscala([
      { colaborador_id: 'c1', departamento_id: 'd1' },
      { colaborador_id: 'c1', departamento_id: 'd1' },
      { colaborador_id: 'c1', departamento_id: 'd2' },
      { colaborador_id: 'c2', departamento_id: 'd1' },
      { colaborador_id: 'c3', departamento_id: null },
    ])
    expect(pares).toEqual([
      { colaborador_id: 'c1', departamento_id: 'd1' },
      { colaborador_id: 'c1', departamento_id: 'd2' },
      { colaborador_id: 'c2', departamento_id: 'd1' },
    ])
  })

  it('lista vazia retorna vazio', () => {
    expect(paresDaEscala([])).toEqual([])
  })
})

describe('escopoSugerido', () => {
  it('Niterói × Niterói é municipal Niterói, ignorando acento e caixa', () => {
    expect(escopoSugerido('Niterói', 'NITEROI')).toBe('niteroi_municipal')
    expect(escopoSugerido('NITEROI', 'Niterói')).toBe('niteroi_municipal')
    expect(escopoSugerido(' niterói ', 'Niterói')).toBe('niteroi_municipal')
  })

  it('mesma cidade fora de Niterói é municipal de outra cidade', () => {
    expect(escopoSugerido('Macaé', 'MACAE')).toBe('municipal_outra')
    expect(escopoSugerido('São Gonçalo', 'São Gonçalo')).toBe('municipal_outra')
  })

  it('cidades diferentes são intermunicipal', () => {
    expect(escopoSugerido('São Gonçalo', 'Niterói')).toBe('intermunicipal')
    expect(escopoSugerido('Niterói', 'Maricá')).toBe('intermunicipal')
  })

  it('cidade vazia não é "igual": cai em intermunicipal', () => {
    expect(escopoSugerido(null, null)).toBe('intermunicipal')
    expect(escopoSugerido('', 'Niterói')).toBe('intermunicipal')
  })
})
