import { describe, expect, it } from 'vitest'
import { encontrarDepartamentoFuzzy, idsColaboradoresDoDepartamento, nomeCurtoDepartamentoFuzzy, type DepartamentoFuzzy } from './departamentos'

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

  it('usa o nome_curto da linha IRMÃ quando a resolvida não tem (duplicada legada)', () => {
    // Dados reais (05/09/2026): a colaborador aponta para a linha sem
    // nome_curto; a irmã com o mesmo nome tem nome_curto 'CBO'.
    const comDuplicada: DepartamentoFuzzy[] = [
      { id: '6e2e9d11', nome: 'ALIANCA S A INDUSTRIA NAVAL E EMPRESA DE NAVEGACAO', nome_curto: null, status: 'Ativo' },
      { id: '6863ec8e', nome: 'ALIANÇA S/A - INDÚSTRIA NAVAL E EMPRESA DE NAVEGAÇÃO', nome_curto: 'CBO', status: 'Ativo' },
    ]
    expect(nomeCurtoDepartamentoFuzzy(comDuplicada, '6e2e9d11', 'ALIANCA S A INDUSTRIA NAVAL E EMPRESA DE NAVEGACAO')).toBe('CBO')
  })

  it('prefere a irmã Ativa quando há duplicadas com nome_curto', () => {
    const comInativa: DepartamentoFuzzy[] = [
      { id: 'a', nome: 'POSTO X', nome_curto: null, status: 'Ativo' },
      { id: 'b', nome: 'POSTO X', nome_curto: 'X-ANTIGO', status: 'Inativo' },
      { id: 'c', nome: 'POSTO X', nome_curto: 'X', status: 'Ativo' },
    ]
    expect(nomeCurtoDepartamentoFuzzy(comInativa, 'a', null)).toBe('X')
  })

  it('retorna traço quando não há nada', () => {
    expect(nomeCurtoDepartamentoFuzzy([], null, null)).toBe('—')
  })
})

describe('idsColaboradoresDoDepartamento', () => {
  // Caso real (05/09/2026, relatórios CEU): o cadastro do departamento tem
  // acentos/pontuação ("Aliança S.A. Indústria Naval...") e o texto legado do
  // colaborador não ("ALIANCA S A INDUSTRIA...") — o ILIKE do banco não
  // casava e o filtro por "CBO" voltava vazio.
  const depts: DepartamentoFuzzy[] = [
    { id: 'd1', nome: 'Aliança S.A. Indústria Naval e Empresa de Navegação', nome_curto: 'CBO', empresa_id: 'emp1' },
    { id: 'd2', nome: 'Base Macaé', nome_curto: 'CBO Macaé', empresa_id: 'emp1' },
  ]
  const colaboradores = [
    { id: 'c1', departamento_id: null, departamento: 'ALIANCA S A INDUSTRIA NAVAL E EMPRESA DE NAVEGACAO', empresa_id: 'emp1' },
    { id: 'c2', departamento_id: 'd2', departamento: null, empresa_id: 'emp1' },
    { id: 'c3', departamento_id: null, departamento: 'PORTARIA SEDE', empresa_id: 'emp1' },
  ]

  it('encontra colaborador pelo nome_curto mesmo com texto legado sem acento e sem departamento_id', () => {
    const ids = idsColaboradoresDoDepartamento(depts, colaboradores, 'CBO')
    expect(ids.has('c1')).toBe(true)
    expect(ids.has('c2')).toBe(false)
    expect(ids.has('c3')).toBe(false)
  })

  it('encontra pelo nome completo do departamento', () => {
    const ids = idsColaboradoresDoDepartamento(depts, colaboradores, 'Aliança S.A. Indústria Naval e Empresa de Navegação')
    expect(ids.has('c1')).toBe(true)
  })

  it('encontra colaborador que só tem departamento_id', () => {
    const ids = idsColaboradoresDoDepartamento(depts, colaboradores, 'CBO Macaé')
    expect([...ids]).toEqual(['c2'])
  })

  it('fallback por texto livre quando nenhum departamento corresponde', () => {
    const ids = idsColaboradoresDoDepartamento(depts, colaboradores, 'PORTARIA')
    expect([...ids]).toEqual(['c3'])
  })

  it('encontra colaborador que aponta para a LINHA DUPLICADA do departamento (sem nome_curto)', () => {
    // Dados reais de produção (05/09/2026): "CBO" = 6863ec8e (nome com acentos)
    // e a duplicada 6e2e9d11 (sem acentos, nome_curto NULL) — Lourene aponta
    // para a duplicada; o filtro "CBO" precisa alcançá-la.
    const deptsDuplicados: DepartamentoFuzzy[] = [
      { id: '6863ec8e', nome: 'ALIANÇA S/A - INDÚSTRIA NAVAL E EMPRESA DE NAVEGAÇÃO', nome_curto: 'CBO', empresa_id: null },
      { id: '6e2e9d11', nome: 'ALIANCA S A INDUSTRIA NAVAL E EMPRESA DE NAVEGACAO', nome_curto: null, empresa_id: 'emp1' },
      { id: '7503715c', nome: 'CBO SERVICOS MARITIMOS S.A.', nome_curto: 'CBO MACAÉ', empresa_id: null },
    ]
    const colabs = [
      { id: 'lourene', departamento_id: '6e2e9d11', departamento: 'ALIANCA S A INDUSTRIA NAVAL E EMPRESA DE NAVEGACAO', empresa_id: 'emp1' },
      { id: 'outro', departamento_id: '7503715c', departamento: null, empresa_id: null },
    ]
    const ids = idsColaboradoresDoDepartamento(deptsDuplicados, colabs, 'CBO')
    expect(ids.has('lourene')).toBe(true)
    // CBO MACAÉ é outro posto — não pode entrar no filtro "CBO"
    expect(ids.has('outro')).toBe(false)
  })

  it('retorna vazio para termo vazio ou sem nenhuma correspondência', () => {
    expect(idsColaboradoresDoDepartamento(depts, colaboradores, '').size).toBe(0)
    expect(idsColaboradoresDoDepartamento(depts, colaboradores, 'INEXISTENTE').size).toBe(0)
  })
})
