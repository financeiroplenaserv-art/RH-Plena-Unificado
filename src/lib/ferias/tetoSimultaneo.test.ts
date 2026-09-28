import { describe, it, expect } from 'vitest'
import {
  periodosSeSobrepoem,
  resolverRegraTeto,
  avaliarTetoSimultaneo,
} from './tetoSimultaneo'
import type { FeriasRegra, FeriasSolicitacao } from '@/types/ferias'

function regra(parcial: Partial<FeriasRegra>): FeriasRegra {
  return { id: 'r', departamento_id: null, funcao_id: null, max_simultaneos: 1, ...parcial }
}

function solicitacao(parcial: Partial<FeriasSolicitacao>): FeriasSolicitacao {
  return {
    id: 's1',
    colaborador_id: 'c1',
    departamento_id: 'dep1',
    funcao_id: 'f1',
    data_inicio: '2026-08-01',
    data_fim: '2026-08-30',
    tipo: 'agendado',
    status: 'aprovada',
    dias_abono: 0,
    adiantamento_13: false,
    parcelada: false,
    origem: 'manual',
    observacao: null,
    ferista_alocado_id: null,
    origem_alocacao: null,
    pedido_colaborador: false,
    registrado_por: null,
    aprovado_por: null,
    data_aprovacao: null,
    ...parcial,
  }
}

describe('periodosSeSobrepoem', () => {
  it('detecta sobreposição parcial e total', () => {
    expect(periodosSeSobrepoem('2026-08-01', '2026-08-30', '2026-08-15', '2026-09-14')).toBe(true)
    expect(periodosSeSobrepoem('2026-08-01', '2026-08-30', '2026-08-01', '2026-08-30')).toBe(true)
  })

  it('pontas encostadas contam como sobreposição', () => {
    expect(periodosSeSobrepoem('2026-08-01', '2026-08-30', '2026-08-30', '2026-09-28')).toBe(true)
  })

  it('intervalos disjuntos não se sobrepõem', () => {
    expect(periodosSeSobrepoem('2026-08-01', '2026-08-30', '2026-09-01', '2026-09-30')).toBe(false)
    expect(periodosSeSobrepoem('2026-09-01', '2026-09-30', '2026-08-01', '2026-08-30')).toBe(false)
  })
})

describe('resolverRegraTeto', () => {
  const global = regra({ id: 'r-global', max_simultaneos: 1 })
  const especifica = regra({ id: 'r-dep', departamento_id: 'dep1', funcao_id: 'f1', max_simultaneos: 2 })

  it('prefere a regra exata do contrato+função', () => {
    expect(resolverRegraTeto([global, especifica], 'dep1', 'f1')?.id).toBe('r-dep')
  })

  it('cai na global (NULL, NULL) quando não há específica', () => {
    expect(resolverRegraTeto([global, especifica], 'dep2', 'f1')?.id).toBe('r-global')
    expect(resolverRegraTeto([global, especifica], 'dep1', 'f2')?.id).toBe('r-global')
  })

  it('retorna null quando nem a global existe', () => {
    expect(resolverRegraTeto([especifica], 'dep2', 'f2')).toBeNull()
  })
})

describe('avaliarTetoSimultaneo', () => {
  const regras = [regra({ id: 'r-global', max_simultaneos: 1 })]
  const base = { regras, departamentoId: 'dep1', funcaoId: 'f1', dataInicio: '2026-08-10', dataFim: '2026-09-08' }

  it('sem conflitos: não excede', () => {
    const resultado = avaliarTetoSimultaneo({ ...base, solicitacoes: [] })
    expect(resultado.excede).toBe(false)
    expect(resultado.conflitos).toHaveLength(0)
    expect(resultado.maxSimultaneos).toBe(1)
  })

  it('um confirmado sobreposto no mesmo contrato+função estoura o teto 1', () => {
    const resultado = avaliarTetoSimultaneo({ ...base, solicitacoes: [solicitacao({})] })
    expect(resultado.excede).toBe(true)
    expect(resultado.conflitos).toHaveLength(1)
  })

  it('ignora pendente, concluída e cancelada (não ocupam vaga)', () => {
    const resultado = avaliarTetoSimultaneo({
      ...base,
      solicitacoes: [
        solicitacao({ id: 's-pend', status: 'pendente' }),
        solicitacao({ id: 's-conc', status: 'concluida' }),
        solicitacao({ id: 's-canc', status: 'cancelada' }),
      ],
    })
    expect(resultado.excede).toBe(false)
  })

  it('em_andamento ocupa vaga', () => {
    const resultado = avaliarTetoSimultaneo({ ...base, solicitacoes: [solicitacao({ status: 'em_andamento' })] })
    expect(resultado.excede).toBe(true)
  })

  it('ignora outro contrato ou outra função', () => {
    const resultado = avaliarTetoSimultaneo({
      ...base,
      solicitacoes: [
        solicitacao({ id: 's-dep', departamento_id: 'dep2' }),
        solicitacao({ id: 's-fun', funcao_id: 'f2' }),
      ],
    })
    expect(resultado.excede).toBe(false)
  })

  it('ignora períodos que não se sobrepõem', () => {
    const resultado = avaliarTetoSimultaneo({
      ...base,
      solicitacoes: [solicitacao({ data_inicio: '2026-10-01', data_fim: '2026-10-30' })],
    })
    expect(resultado.excede).toBe(false)
  })

  it('não conta a própria solicitação sendo reprogramada (ignorarId)', () => {
    const resultado = avaliarTetoSimultaneo({ ...base, ignorarId: 's1', solicitacoes: [solicitacao({})] })
    expect(resultado.excede).toBe(false)
  })

  it('respeita teto maior da regra específica', () => {
    const regrasTeto2 = [regra({ id: 'r-dep', departamento_id: 'dep1', funcao_id: 'f1', max_simultaneos: 2 })]
    const resultado = avaliarTetoSimultaneo({
      ...base,
      regras: regrasTeto2,
      solicitacoes: [solicitacao({})],
    })
    expect(resultado.maxSimultaneos).toBe(2)
    expect(resultado.excede).toBe(false)
  })
})
