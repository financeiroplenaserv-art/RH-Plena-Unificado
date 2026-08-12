import { describe, it, expect } from 'vitest'
import { deveIgnorarErroImportacao } from './econtador'

const erroMatriculaDuplicada = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "colaboradores_matricula_unique"',
}

describe('deveIgnorarErroImportacao', () => {
  it('ignora demitido (com data de demissão) com conflito de matrícula', () => {
    expect(deveIgnorarErroImportacao(erroMatriculaDuplicada, { demissao: '2015-05-12', status: 'Ativo' })).toBe(true)
  })

  it('ignora inativo (status) com conflito de matrícula', () => {
    expect(deveIgnorarErroImportacao(erroMatriculaDuplicada, { demissao: null, status: 'Inativo' })).toBe(true)
  })

  it('NÃO ignora conflito de matrícula em quem está ativo', () => {
    expect(deveIgnorarErroImportacao(erroMatriculaDuplicada, { demissao: null, status: 'Ativo' })).toBe(false)
  })

  it('NÃO ignora erro de outra constraint, mesmo em inativo', () => {
    const outroErro = { code: '23505', message: 'duplicate key value violates unique constraint "colaboradores_cpf_key"' }
    expect(deveIgnorarErroImportacao(outroErro, { demissao: '2015-05-12', status: 'Inativo' })).toBe(false)
  })

  it('NÃO ignora erro com outro código, mesmo em inativo', () => {
    const erroValidacao = { code: '23502', message: 'null value violates not-null constraint' }
    expect(deveIgnorarErroImportacao(erroValidacao, { demissao: '2015-05-12', status: 'Inativo' })).toBe(false)
  })

  it('NÃO ignora erro que não é objeto (string, Error comum)', () => {
    expect(deveIgnorarErroImportacao('23505 matricula', { demissao: '2015-05-12' })).toBe(false)
    expect(deveIgnorarErroImportacao(new Error('matricula'), { demissao: '2015-05-12' })).toBe(false)
  })
})
