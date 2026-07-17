import { describe, it, expect } from 'vitest'
import { formatarCPF, mascararCPF, validarCPF, parseMoedaParaCentavos, safeJsonParse, localStorageGetJson } from './utils'

describe('formatarCPF', () => {
  it('formata CPF string com 11 dígitos', () => {
    expect(formatarCPF('12345678901')).toBe('123.456.789-01')
  })

  it('formata CPF número com 11 dígitos', () => {
    expect(formatarCPF(12345678901)).toBe('123.456.789-01')
  })

  it('retorna string original se tiver menos de 11 dígitos', () => {
    expect(formatarCPF('123456')).toBe('123456')
  })

  it('retorna string vazia para null/undefined', () => {
    expect(formatarCPF(null)).toBe('')
    expect(formatarCPF(undefined)).toBe('')
  })
})

describe('mascararCPF', () => {
  it('mascara CPF mantendo os dígitos do meio', () => {
    expect(mascararCPF('12345678901')).toBe('***.456.789-**')
  })
})

describe('validarCPF', () => {
  it('aceita CPF válido', () => {
    expect(validarCPF('529.982.247-25')).toBe(true)
  })

  it('rejeita CPF com dígitos iguais', () => {
    expect(validarCPF('111.111.111-11')).toBe(false)
  })

  it('rejeita CPF com tamanho errado', () => {
    expect(validarCPF('123456')).toBe(false)
  })

  it('rejeita CPF com dígito verificador errado', () => {
    expect(validarCPF('123.456.789-00')).toBe(false)
  })

  it('rejeita null/undefined/vazio', () => {
    expect(validarCPF(null)).toBe(false)
    expect(validarCPF(undefined)).toBe(false)
    expect(validarCPF('')).toBe(false)
  })
})

describe('parseMoedaParaCentavos', () => {
  it('converte número 2.6 para 260 centavos', () => {
    expect(parseMoedaParaCentavos(2.6)).toBe(260)
  })

  it('converte string pt-BR "2,60" para 260 centavos', () => {
    expect(parseMoedaParaCentavos('2,60')).toBe(260)
  })

  it('converte string com R$ "R$ 2,60" para 260 centavos', () => {
    expect(parseMoedaParaCentavos('R$ 2,60')).toBe(260)
  })

  it('converte string en-US "2.60" para 260 centavos', () => {
    expect(parseMoedaParaCentavos('2.60')).toBe(260)
  })

  it('converte milhar pt-BR "1.234,56" para 123456 centavos', () => {
    expect(parseMoedaParaCentavos('1.234,56')).toBe(123456)
  })

  it('retorna null para vazio/null/undefined', () => {
    expect(parseMoedaParaCentavos('')).toBe(null)
    expect(parseMoedaParaCentavos(null)).toBe(null)
    expect(parseMoedaParaCentavos(undefined)).toBe(null)
  })
})

describe('safeJsonParse', () => {
  it('parseia JSON válido', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 })
  })

  it('parseia array JSON válido', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3])
  })

  it('retorna fallback para JSON inválido', () => {
    expect(safeJsonParse('{invalido}', [])).toEqual([])
  })

  it('retorna fallback para null/undefined', () => {
    expect(safeJsonParse(null, [])).toEqual([])
    expect(safeJsonParse(undefined, {})).toEqual({})
  })

  it('retorna fallback para string vazia', () => {
    expect(safeJsonParse('', [])).toEqual([])
  })
})

describe('localStorageGetJson', () => {
  it('lê e parseia JSON do localStorage', () => {
    window.localStorage.setItem('teste_safe_json', '[1,2]')
    expect(localStorageGetJson('teste_safe_json', [])).toEqual([1, 2])
    window.localStorage.removeItem('teste_safe_json')
  })

  it('retorna fallback quando chave não existe', () => {
    expect(localStorageGetJson('chave_inexistente_12345', [])).toEqual([])
  })

  it('retorna fallback quando JSON é inválido', () => {
    window.localStorage.setItem('teste_safe_json_invalido', 'not-json')
    expect(localStorageGetJson('teste_safe_json_invalido', [])).toEqual([])
    window.localStorage.removeItem('teste_safe_json_invalido')
  })
})
