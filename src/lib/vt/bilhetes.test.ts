import { describe, expect, it } from 'vitest'
import {
  bilhetesVigentes,
  custoDiaBilhetesCentavos,
  formatarCentavos,
} from '@/lib/vt/bilhetes'
import type { VtBilhete } from '@/types/vt'

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

function bilhete(parcial: Partial<VtBilhete>): VtBilhete {
  return {
    id: 'b0',
    nome: 'CENTRO RJ',
    valor_diario_centavos: 1000,
    vigente_desde: '2026-10-21',
    ativo: true,
    ...parcial,
  }
}

describe('custoDiaBilhetesCentavos', () => {
  it('com 1 bilhete vale o valor diário dele', () => {
    expect(custoDiaBilhetesCentavos(BU_NITEROI, null)).toBe(1120)
  })

  it('com 2 bilhetes soma os valores diários', () => {
    expect(custoDiaBilhetesCentavos(BU_NITEROI, TREM)).toBe(2700)
  })
})

describe('bilhetesVigentes', () => {
  it('duas linhas do mesmo nome: vale o vigente mais recente', () => {
    const antiga = bilhete({ id: 'b0a', valor_diario_centavos: 900, vigente_desde: '2026-01-01' })
    const vigente = bilhete({ id: 'b0b', valor_diario_centavos: 1000, vigente_desde: '2026-10-21' })
    const resultado = bilhetesVigentes([antiga, vigente], '2026-10-21')
    expect(resultado).toEqual([vigente])
  })

  it('bilhete futuro ainda não vale', () => {
    const futuro = bilhete({ id: 'b0f', vigente_desde: '2099-01-01' })
    expect(bilhetesVigentes([futuro], '2026-10-21')).toEqual([])
  })

  it('bilhete inativo é ignorado (mesmo que seja o mais recente)', () => {
    const inativo = bilhete({ id: 'b0i', ativo: false, vigente_desde: '2026-10-21' })
    const vigente = bilhete({ id: 'b0b', vigente_desde: '2026-01-01' })
    expect(bilhetesVigentes([inativo, vigente], '2026-10-21')).toEqual([vigente])
    expect(bilhetesVigentes([inativo], '2026-10-21')).toEqual([])
  })

  it('um por nome; nomes diferentes convivem', () => {
    const resultado = bilhetesVigentes([BU_NITEROI, TREM], '2026-10-21')
    expect(resultado).toHaveLength(2)
  })
})

describe('formatarCentavos', () => {
  // toLocaleString pt-BR usa espaço não-quebrável (U+00A0) depois do "R$".
  it('formata como moeda pt-BR', () => {
    expect(formatarCentavos(560)).toBe('R$ 5,60')
    expect(formatarCentavos(2700)).toBe('R$ 27,00')
    expect(formatarCentavos(0)).toBe('R$ 0,00')
  })
})
