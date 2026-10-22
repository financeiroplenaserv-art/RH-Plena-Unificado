import { describe, expect, it } from 'vitest'
import {
  combinacoesVigentes,
  custoDiaCombinacoesCentavos,
  formatarCentavos,
} from '@/lib/vt/combinacoes'
import type { VtCombinacao } from '@/types/vt'

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

function combinacao(parcial: Partial<VtCombinacao>): VtCombinacao {
  return {
    id: 'c0',
    nome: 'CENTRO RJ',
    valor_diario_centavos: 1000,
    vigente_desde: '2026-10-21',
    ativo: true,
    ...parcial,
  }
}

describe('custoDiaCombinacoesCentavos', () => {
  it('com 1 combinação vale o valor diário dela', () => {
    expect(custoDiaCombinacoesCentavos(BU_NITEROI, null)).toBe(1120)
  })

  it('com 2 combinações soma os valores diários', () => {
    expect(custoDiaCombinacoesCentavos(BU_NITEROI, TREM)).toBe(2700)
  })
})

describe('combinacoesVigentes', () => {
  it('duas linhas do mesmo nome: vale a vigente mais recente', () => {
    const antiga = combinacao({ id: 'c0a', valor_diario_centavos: 900, vigente_desde: '2026-01-01' })
    const vigente = combinacao({ id: 'c0b', valor_diario_centavos: 1000, vigente_desde: '2026-10-21' })
    const resultado = combinacoesVigentes([antiga, vigente], '2026-10-21')
    expect(resultado).toEqual([vigente])
  })

  it('combinação futura ainda não vale', () => {
    const futura = combinacao({ id: 'c0f', vigente_desde: '2099-01-01' })
    expect(combinacoesVigentes([futura], '2026-10-21')).toEqual([])
  })

  it('combinação inativa é ignorada (mesmo que seja a mais recente)', () => {
    const inativa = combinacao({ id: 'c0i', ativo: false, vigente_desde: '2026-10-21' })
    const vigente = combinacao({ id: 'c0b', vigente_desde: '2026-01-01' })
    expect(combinacoesVigentes([inativa, vigente], '2026-10-21')).toEqual([vigente])
    expect(combinacoesVigentes([inativa], '2026-10-21')).toEqual([])
  })

  it('uma por nome; nomes diferentes convivem', () => {
    const resultado = combinacoesVigentes([BU_NITEROI, TREM], '2026-10-21')
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
