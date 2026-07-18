import { describe, expect, it } from 'vitest'
import { encontrarDepartamentoFuzzy, nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from './departamentos'

const departamentos: DepartamentoFuzzy[] = [
  { id: '1', nome: 'CBO PORTARIA', nome_curto: 'CBO', empresa_id: 'emp1' },
  { id: '2', nome: 'CENTRO DE OPERACOES E INTELIGENCIA', nome_curto: 'CBO Centro', empresa_id: 'emp1' },
  { id: '3', nome: 'PORTARIA ALIANCA', nome_curto: 'ALIANCA', empresa_id: 'emp2' },
  { id: '4', nome: 'LIMPEZA CORPORATIVA', nome_curto: 'LIMPEZA', empresa_id: 'emp1' },
  { id: '5', nome: 'RECEPCAO SEDE', nome_curto: 'RECEPCAO', empresa_id: 'emp1' },
]

describe('encontrarDepartamentoFuzzy', () => {
  it('encontra por ID quando informado', () => {
    const resultado = encontrarDepartamentoFuzzy(departamentos, '2', 'QUALQUER NOME')
    expect(resultado?.id).toBe('2')
  })

  it('encontra por nome exato normalizado', () => {
    const resultado = encontrarDepartamentoFuzzy(departamentos, null, 'cbo portaria')
    expect(resultado?.id).toBe('1')
  })

  it('encontra por nome exato ignorando acentos', () => {
    const resultado = encontrarDepartamentoFuzzy(departamentos, null, 'RECEPÇÃO SÊDE')
    expect(resultado?.id).toBe('5')
  })

  it('encontra por nome_curto exato', () => {
    const resultado = encontrarDepartamentoFuzzy(departamentos, null, 'ALIANCA')
    expect(resultado?.id).toBe('3')
  })

  it('encontra por tokens quando a ordem é diferente', () => {
    const resultado = encontrarDepartamentoFuzzy(departamentos, null, 'PORTARIA CBO')
    expect(resultado?.id).toBe('1')
  })

  it('encontra por substring', () => {
    const resultado = encontrarDepartamentoFuzzy(departamentos, null, 'CENTRO DE OPERACOES')
    expect(resultado?.id).toBe('2')
  })

  it('encontra por similaridade quando há pequena variação', () => {
    const resultado = encontrarDepartamentoFuzzy(departamentos, null, 'CENTRO DE OPERACOES E INTELIGENTE')
    expect(resultado?.id).toBe('2')
  })

  it('retorna null quando não há match suficiente', () => {
    const resultado = encontrarDepartamentoFuzzy(departamentos, null, 'DEPARTAMENTO INEXISTENTE')
    expect(resultado).toBeNull()
  })

  it('filtra por empresa quando informada', () => {
    // Sem empresa, encontra PORTARIA ALIANCA
    expect(encontrarDepartamentoFuzzy(departamentos, null, 'PORTARIA ALIANCA')?.id).toBe('3')
    // Com empresa emp1, não encontra PORTARIA ALIANCA (é de emp2)
    expect(encontrarDepartamentoFuzzy(departamentos, null, 'PORTARIA ALIANCA', 'emp1')).toBeNull()
  })

  it('encontra por tokens na mesma empresa', () => {
    expect(encontrarDepartamentoFuzzy(departamentos, null, 'PORTARIA CBO', 'emp1')?.id).toBe('1')
  })
})

describe('nomeCurtoDepartamentoFuzzy', () => {
  it('retorna nome_curto quando encontra por ID', () => {
    expect(nomeCurtoDepartamentoFuzzy(departamentos, '1', null)).toBe('CBO')
  })

  it('retorna nome_curto quando encontra por nome textual fuzzy', () => {
    expect(nomeCurtoDepartamentoFuzzy(departamentos, null, 'PORTARIA CBO')).toBe('CBO')
  })

  it('retorna nome completo quando não há nome_curto', () => {
    const semCurto: DepartamentoFuzzy[] = [{ id: '9', nome: 'DEPARTAMENTO SEM NOME CURTO', nome_curto: null }]
    expect(nomeCurtoDepartamentoFuzzy(semCurto, '9', null)).toBe('DEPARTAMENTO SEM NOME CURTO')
  })

  it('retorna o nome textual quando não encontra departamento', () => {
    expect(nomeCurtoDepartamentoFuzzy(departamentos, null, 'TEXTO DESCONHECIDO')).toBe('TEXTO DESCONHECIDO')
  })

  it('retorna traço quando não há nada', () => {
    expect(nomeCurtoDepartamentoFuzzy([], null, null)).toBe('—')
  })
})
