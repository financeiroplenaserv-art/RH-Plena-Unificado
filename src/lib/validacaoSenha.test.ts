import { describe, it, expect } from 'vitest'
import { validarNovaSenha } from '@/lib/validacaoSenha'

describe('validarNovaSenha', () => {
  it('aceita senha válida com confirmação igual', () => {
    expect(validarNovaSenha('plena123', 'plena123')).toBeNull()
  })
  it('rejeita senha com menos de 6 caracteres', () => {
    expect(validarNovaSenha('abc12', 'abc12')).toBe('A senha deve ter pelo menos 6 caracteres')
  })
  it('rejeita confirmação diferente', () => {
    expect(validarNovaSenha('plena123', 'plena124')).toBe('As senhas não conferem')
  })
  it('valida o tamanho antes da confirmação', () => {
    expect(validarNovaSenha('abc', 'xyz')).toBe('A senha deve ter pelo menos 6 caracteres')
  })
})
