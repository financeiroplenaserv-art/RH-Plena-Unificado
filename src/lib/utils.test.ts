import { describe, it, expect } from 'vitest'
import { formatarCPF, mascararCPF, validarCPF } from './utils'

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
