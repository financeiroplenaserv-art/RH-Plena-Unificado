import { describe, it, expect } from 'vitest'
import { calcularSituacaoFerista } from './statusFerista'

const HOJE = '2026-09-28'

function alocacao(parcial: Partial<{ id: string; solicitacao_id: string; data_inicio: string; data_fim: string; status: 'sugerida' | 'confirmada' | 'cancelada' }>) {
  return {
    id: 'a1',
    solicitacao_id: 's1',
    data_inicio: '2026-09-20',
    data_fim: '2026-10-19',
    status: 'confirmada' as const,
    ...parcial,
  }
}

function ferias(parcial: Partial<{ id: string; data_inicio: string; data_fim: string; tipo: 'gozo' | 'agendado' | 'previsto'; status: 'pendente' | 'aprovada' | 'em_andamento' | 'concluida' | 'cancelada' }>) {
  return {
    id: 'f1',
    data_inicio: '2026-09-15',
    data_fim: '2026-10-14',
    tipo: 'gozo' as const,
    status: 'em_andamento' as const,
    ...parcial,
  }
}

describe('calcularSituacaoFerista', () => {
  it('alocado quando há alocação confirmada cobrindo hoje', () => {
    const situacao = calcularSituacaoFerista({ alocacoes: [alocacao({})], ferias: [], hoje: HOJE })
    expect(situacao.status).toBe('alocado')
    expect(situacao.alocacaoAtual?.solicitacao_id).toBe('s1')
    expect(situacao.disponivelEm).toBe('2026-10-19')
  })

  it('de férias quando há gozo próprio cobrindo hoje', () => {
    const situacao = calcularSituacaoFerista({ alocacoes: [], ferias: [ferias({})], hoje: HOJE })
    expect(situacao.status).toBe('de_ferias')
    expect(situacao.disponivelEm).toBe('2026-10-14')
  })

  it('férias próprias têm precedência sobre alocação (inconsistência de dados)', () => {
    const situacao = calcularSituacaoFerista({ alocacoes: [alocacao({})], ferias: [ferias({})], hoje: HOJE })
    expect(situacao.status).toBe('de_ferias')
  })

  it('alocação futura não aloca agora, mas vira próximo compromisso', () => {
    const situacao = calcularSituacaoFerista({
      alocacoes: [alocacao({ data_inicio: '2026-11-02', data_fim: '2026-12-01' })],
      ferias: [],
      hoje: HOJE,
    })
    expect(situacao.status).toBe('disponivel')
    expect(situacao.disponivelEm).toBeNull()
    expect(situacao.proximoCompromisso).toEqual({ inicio: '2026-11-02', fim: '2026-12-01' })
  })

  it('férias futuras próprias também viram próximo compromisso', () => {
    const situacao = calcularSituacaoFerista({
      alocacoes: [],
      ferias: [ferias({ tipo: 'agendado', status: 'aprovada', data_inicio: '2026-12-01', data_fim: '2026-12-30' })],
      hoje: HOJE,
    })
    expect(situacao.status).toBe('disponivel')
    expect(situacao.proximoCompromisso).toEqual({ inicio: '2026-12-01', fim: '2026-12-30' })
  })

  it('ignora alocação sugerida/cancelada e férias cancelada/prevista', () => {
    const situacao = calcularSituacaoFerista({
      alocacoes: [alocacao({ status: 'sugerida' }), alocacao({ id: 'a2', status: 'cancelada' })],
      ferias: [ferias({ status: 'cancelada' }), ferias({ id: 'f2', tipo: 'previsto', status: 'pendente' })],
      hoje: HOJE,
    })
    expect(situacao.status).toBe('disponivel')
    expect(situacao.alocacaoAtual).toBeNull()
  })

  it('com várias alocações correntes, disponível no fim mais tarde', () => {
    const situacao = calcularSituacaoFerista({
      alocacoes: [
        alocacao({ data_fim: '2026-10-05' }),
        alocacao({ id: 'a2', solicitacao_id: 's2', data_inicio: '2026-09-25', data_fim: '2026-10-25' }),
      ],
      ferias: [],
      hoje: HOJE,
    })
    expect(situacao.status).toBe('alocado')
    expect(situacao.disponivelEm).toBe('2026-10-25')
  })

  it('disponível sem nenhum compromisso', () => {
    const situacao = calcularSituacaoFerista({ alocacoes: [], ferias: [], hoje: HOJE })
    expect(situacao).toEqual({ status: 'disponivel', disponivelEm: null, alocacaoAtual: null, proximoCompromisso: null })
  })
})
