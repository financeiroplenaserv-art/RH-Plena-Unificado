import { describe, it, expect } from 'vitest'
import {
  STATUS_FILTRO_EXCETO_CANCELADAS,
  condicaoFiltroStatus,
} from './filtroStatus'

describe('condicaoFiltroStatus', () => {
  it('sem filtro não gera condição', () => {
    expect(condicaoFiltroStatus(undefined)).toBeNull()
  })

  it('sentinela "exceto canceladas" vira neq Cancelada (padrão da listagem)', () => {
    expect(condicaoFiltroStatus(STATUS_FILTRO_EXCETO_CANCELADAS)).toEqual({
      operador: 'neq',
      valor: 'Cancelada',
    })
  })

  it('status explícito vira eq (inclusive "Cancelada", para ver só canceladas)', () => {
    expect(condicaoFiltroStatus('Pendente')).toEqual({ operador: 'eq', valor: 'Pendente' })
    expect(condicaoFiltroStatus('Cancelada')).toEqual({ operador: 'eq', valor: 'Cancelada' })
  })
})
