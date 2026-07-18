import { describe, it, expect } from 'vitest'
import { limparRegistroParaUpsert } from './importar'

describe('limparRegistroParaUpsert', () => {
  it('retorna null para linha sem matrícula', () => {
    expect(limparRegistroParaUpsert({ nome_completo: 'João' })).toBeNull()
  })

  it('retorna null para linha sem nome', () => {
    expect(limparRegistroParaUpsert({ matricula: '123' })).toBeNull()
  })

  it('não inclui campos vazios (não zera dados existentes no upsert)', () => {
    const resultado = limparRegistroParaUpsert({
      matricula: '123',
      nome_completo: 'João Silva',
      cpf: '',
      rg: '',
      data_nascimento: null,
      cargo: '',
      status: 'Ativo',
      tipo_contrato: 'CLT',
    })

    expect(resultado).not.toBeNull()
    expect(resultado!.payload).toEqual({
      matricula: '123',
      nome_completo: 'João Silva',
      status: 'Ativo',
      tipo_contrato: 'CLT',
    })
    expect(resultado!.payload.cpf).toBeUndefined()
    expect(resultado!.payload.rg).toBeUndefined()
    expect(resultado!.payload.data_nascimento).toBeUndefined()
    expect(resultado!.payload.cargo).toBeUndefined()
  })

  it('mantém campos preenchidos', () => {
    const resultado = limparRegistroParaUpsert({
      matricula: '123',
      nome_completo: 'João Silva',
      cargo: 'Porteiro',
      cidade: 'São Paulo',
      data_admissao: '2024-01-15',
    })

    expect(resultado!.payload.cargo).toBe('Porteiro')
    expect(resultado!.payload.cidade).toBe('São Paulo')
    expect(resultado!.payload.data_admissao).toBe('2024-01-15')
  })

  it('remove CPF inválido e sinaliza', () => {
    const resultado = limparRegistroParaUpsert({
      matricula: '123',
      nome_completo: 'João Silva',
      cpf: '111.111.111-11',
    })

    expect(resultado!.cpfInvalido).toBe(true)
    expect(resultado!.payload.cpf).toBeUndefined()
  })

  it('mantém CPF válido', () => {
    const resultado = limparRegistroParaUpsert({
      matricula: '123',
      nome_completo: 'João Silva',
      cpf: '529.982.247-25',
    })

    expect(resultado!.cpfInvalido).toBe(false)
    expect(resultado!.payload.cpf).toBe('529.982.247-25')
  })
})
