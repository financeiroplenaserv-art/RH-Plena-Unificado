import { describe, it, expect } from 'vitest'
import { deveIgnorarErroImportacao, extrairMensagemErro, mapearDepartamentosImportacao, mensagemDepartamentoNaoResolvido } from './econtador'
import type { DepartamentoFuzzy } from './departamentos'

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

describe('extrairMensagemErro', () => {
  it('extrai message + code de PostgrestError (objeto simples, não é Error)', () => {
    expect(extrairMensagemErro(erroMatriculaDuplicada)).toBe(
      '[23505] duplicate key value violates unique constraint "colaboradores_matricula_unique"'
    )
  })

  it('extrai message de objeto sem code', () => {
    expect(extrairMensagemErro({ message: 'falha qualquer' })).toBe('falha qualquer')
  })

  it('usa message de Error comum', () => {
    expect(extrairMensagemErro(new Error('Conflito de dados'))).toBe('Conflito de dados')
  })

  it('devolve string solta como está', () => {
    expect(extrairMensagemErro('erro simples')).toBe('erro simples')
  })

  it('extrai message de string contendo JSON (formato legado do histórico)', () => {
    const legado = JSON.stringify(erroMatriculaDuplicada, null, 2)
    expect(extrairMensagemErro(legado)).toBe(
      'duplicate key value violates unique constraint "colaboradores_matricula_unique"'
    )
  })

  it('devolve como está string que começa com { mas não é JSON válido', () => {
    expect(extrairMensagemErro('{quebrado')).toBe('{quebrado')
  })

  it('serializa objeto sem message e lida com vazio/nulo', () => {
    expect(extrairMensagemErro({ code: '23505' })).toBe('{"code":"23505"}')
    expect(extrairMensagemErro(null)).toBe('Erro desconhecido')
    expect(extrairMensagemErro(undefined)).toBe('Erro desconhecido')
    expect(extrairMensagemErro('')).toBe('Erro desconhecido')
  })
})

const EMPRESA = 'fe2f1e37-3915-4801-a2a4-179268a56fa2'
const ativas: DepartamentoFuzzy[] = [
  { id: 'rosas', nome: 'CONDOMINIO DO EDIFICIO RESIDENCIAL ROSAS', nome_curto: 'ITAGUAÍ', empresa_id: null, status: 'Ativo' },
  { id: 'alianca', nome: 'ALIANÇA S/A - INDÚSTRIA NAVAL', nome_curto: 'CBO', empresa_id: null, status: 'Ativo' },
  { id: 'ltda', nome: 'FLOR DE LOTUS CONSULTORIO MEDICO LTDA', nome_curto: 'NUTRINDO IDEAIS', empresa_id: null, status: 'Ativo' },
]

describe('mapearDepartamentosImportacao (09/10/2026: nunca cria departamento)', () => {
  it('casa texto sem acento com cadastro acentuado e devolve o id no mapa', () => {
    const { mapa, naoResolvidos } = mapearDepartamentosImportacao(
      ['ALIANCA S A INDUSTRIA NAVAL'],
      ativas,
      EMPRESA,
    )
    expect(mapa.get('alianca s a industria naval')).toBe('alianca')
    expect(naoResolvidos).toEqual([])
  })

  it('texto de contrato encerrado NÃO é criado: vai para naoResolvidos e fica fora do mapa', () => {
    const { mapa, naoResolvidos } = mapearDepartamentosImportacao(
      ['NICE SERVICOS COMERCIAIS DE LIMPEZA'],
      ativas,
      EMPRESA,
    )
    expect(mapa.size).toBe(0)
    expect(naoResolvidos).toEqual(['NICE SERVICOS COMERCIAIS DE LIMPEZA'])
  })

  it('casos reais da consolidação de 09/10: textos legados casam com a linha ativa oficial', () => {
    const casos: [string, string][] = [
      ['CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS', 'rosas'], // fusão Dalias → ITAGUAÍ
      ['FLOR DE LOTUS CONSULTORIO MEDICO', 'ltda'], // irmã sem LTDA → NUTRINDO IDEAIS
    ]
    for (const [texto, idEsperado] of casos) {
      const { mapa, naoResolvidos } = mapearDepartamentosImportacao([texto], ativas, EMPRESA)
      expect(mapa.get(texto.toLowerCase())).toBe(idEsperado)
      expect(naoResolvidos).toEqual([])
    }
  })

  it('mistura: mapeia os que casam e lista os que não casam, sem criar nada', () => {
    const { mapa, naoResolvidos } = mapearDepartamentosImportacao(
      ['ALIANCA S A INDUSTRIA NAVAL', 'CONTRATO ENCERRADO X', 'FLOR DE LOTUS CONSULTORIO MEDICO'],
      ativas,
      EMPRESA,
    )
    expect(mapa.size).toBe(2)
    expect(naoResolvidos).toEqual(['CONTRATO ENCERRADO X'])
  })

  it('mensagem do histórico orienta o cadastro manual', () => {
    expect(mensagemDepartamentoNaoResolvido('X')).toContain('não criado automaticamente')
    expect(mensagemDepartamentoNaoResolvido('X')).toContain('"X"')
  })
})
