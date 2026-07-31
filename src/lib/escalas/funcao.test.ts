import { describe, it, expect } from 'vitest'
import { abreviarFuncao } from './funcao'

describe('abreviarFuncao', () => {
  it('abrevia Auxiliar de Serviços Gerais como ASG (com acento, parênteses e caixa variados)', () => {
    expect(abreviarFuncao('AUXILIAR DE SERV GERAIS (LIMPEZA)')).toBe('ASG')
    expect(abreviarFuncao('Auxiliar de Serviços Gerais')).toBe('ASG')
  })

  it('abrevia Encarregado Junior como Enc. Jr', () => {
    expect(abreviarFuncao('ENCARREGADO JUNIOR')).toBe('Enc. Jr')
  })

  it('abrevia cargos reais do cadastro', () => {
    expect(abreviarFuncao('PORTEIRO (a)')).toBe('Port.')
    expect(abreviarFuncao('ENCARREGADO PLENO')).toBe('Enc. Pl')
    expect(abreviarFuncao('OPERADOR DE MONITORAMENTO')).toBe('Op. Monit.')
    expect(abreviarFuncao('ZELADOR')).toBe('Zel.')
    expect(abreviarFuncao('Auxiliar de T.I')).toBe('Aux. TI')
  })

  it('devolve o cargo original quando não há abreviação mapeada', () => {
    expect(abreviarFuncao('Vigia')).toBe('Vigia')
    expect(abreviarFuncao('Jardineiro Chefe')).toBe('Jardineiro Chefe')
  })

  it('devolve traço para cargo vazio ou nulo', () => {
    expect(abreviarFuncao('')).toBe('—')
    expect(abreviarFuncao('   ')).toBe('—')
    expect(abreviarFuncao(null)).toBe('—')
    expect(abreviarFuncao(undefined)).toBe('—')
  })
})
