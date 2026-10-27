import { describe, expect, it } from 'vitest'
import { custoDiaTrajetoCentavos, escopoSugerido, paresDaEscala, avisoBilheteIncompativel } from '@/lib/vt/trajetos'
import type { VtBilhete, VtTrajeto } from '@/types/vt'

const BU_NITEROI: VtBilhete = {
  id: 'b2',
  nome: 'BU NITERÓI',
  valor_diario_centavos: 1120,
  vigente_desde: '2026-10-21',
  ativo: true,
}

const TREM: VtBilhete = {
  id: 'b5',
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
    bilhete_id: BU_NITEROI.id,
    bilhete_2_id: null,
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
  it('trajeto com 1 bilhete vale o valor diário dele', () => {
    expect(custoDiaTrajetoCentavos(trajeto({}), [BU_NITEROI, TREM], '2026-10-21')).toBe(1120)
  })

  it('trajeto com 2 bilhetes soma os valores diários', () => {
    expect(custoDiaTrajetoCentavos(trajeto({ bilhete_2_id: TREM.id }), [BU_NITEROI, TREM], '2026-10-21')).toBe(2700)
  })

  it('null quando o bilhete não está vigente na data', () => {
    expect(custoDiaTrajetoCentavos(trajeto({}), [BU_NITEROI], '2026-10-20')).toBeNull()
    const inativo: VtBilhete = { ...BU_NITEROI, ativo: false }
    expect(custoDiaTrajetoCentavos(trajeto({}), [inativo], '2026-10-21')).toBeNull()
  })

  it('usa a vigência mais recente do bilhete (mesmo nome, valor novo)', () => {
    const antiga: VtBilhete = { ...BU_NITEROI, id: 'b2a', valor_diario_centavos: 900, vigente_desde: '2026-01-01' }
    expect(custoDiaTrajetoCentavos(trajeto({ bilhete_id: 'b2a' }), [antiga], '2026-06-01')).toBe(900)
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

describe('avisoBilheteIncompativel', () => {
  it('mora e trabalha em Niterói com bilhete intermunicipal: avisa (regra de 24/10/2026)', () => {
    expect(
      avisoBilheteIncompativel('Niterói', 'NITEROI', ['BILHETE ÚNICO INTERMUNICIPAL'])
    ).toContain('BU Niterói')
    // mesmo com o BUI só no 2º bilhete
    expect(
      avisoBilheteIncompativel('Niterói', 'Niterói', ['BU NITERÓI', 'BILHETE ÚNICO INTERMUNICIPAL'])
    ).toContain('intermunicipal')
  })

  it('mora e trabalha em Niterói com BU Niterói: sem aviso (valor certo)', () => {
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', ['BU NITERÓI'])).toBeNull()
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', ['BU NITERÓI', 'BU NITERÓI'])).toBeNull()
  })

  it('cidades diferentes com bilhete intermunicipal: sem aviso (correto)', () => {
    expect(
      avisoBilheteIncompativel('São Gonçalo', 'Niterói', ['BILHETE ÚNICO INTERMUNICIPAL'])
    ).toBeNull()
  })

  it('cidades diferentes com bilhete municipal de Niterói: avisa (inverso)', () => {
    expect(avisoBilheteIncompativel('São Gonçalo', 'Niterói', ['BU NITERÓI'])).toContain(
      'cidades diferentes'
    )
  })

  it('bilhete de outra praça (trem, VLT, São Gonçalo...) nunca gera aviso', () => {
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', ['TREM'])).toBeNull()
    expect(avisoBilheteIncompativel('São Gonçalo', 'Niterói', ['PASSAGEM SÃO GONÇALO'])).toBeNull()
    expect(avisoBilheteIncompativel('São Gonçalo', 'São Gonçalo', ['BU NITERÓI'])).toBeNull()
  })

  it('sem cidade dos dois lados ou sem bilhete: sem base para julgar, sem aviso', () => {
    expect(avisoBilheteIncompativel(null, 'Niterói', ['BU NITERÓI'])).toBeNull()
    expect(avisoBilheteIncompativel('Niterói', '', ['BILHETE ÚNICO INTERMUNICIPAL'])).toBeNull()
    expect(avisoBilheteIncompativel('Niterói', 'Niterói', [null, undefined])).toBeNull()
  })
})
