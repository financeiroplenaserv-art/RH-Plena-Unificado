import { describe, expect, it } from 'vitest'
import {
  compararPreferenciaDepartamento,
  departamentosSelecionaveis,
  encontrarDepartamentoFuzzy,
  idsColaboradoresDoDepartamento,
  idsGrupoDepartamento,
  nomeCurtoDepartamentoFuzzy,
  type DepartamentoFuzzy,
} from './departamentos'

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

describe('idsGrupoDepartamento', () => {
  // Casos reais da auditoria de 09/10/2026: o filtro por departamentoId da
  // listagem comparava o id EXATO, sem expandir irmãs — CARTÓRIO (colabs na
  // irmã sem nome_curto) e DUOCONNECT (colabs na irmã Inativa) voltavam 0.
  const depts: DepartamentoFuzzy[] = [
    { id: 'duo-ativa', nome: 'DUOCONNECT SOLUÇÕES AUDITIVAS LTDA', nome_curto: 'DUOCONNECT', status: 'Ativo' },
    { id: 'duo-inativa', nome: 'DUOCONNECT SOLUCOES AUDITIVAS LTDA', nome_curto: null, status: 'Inativo' },
    { id: 'duo-sem-curto', nome: 'DUOCONNECT SOLUCOES AUDITIVAS LTDA', nome_curto: null, status: 'Ativo' },
    { id: 'cnooc', nome: 'CNOOC PETROLEUM BRASIL LTDA', nome_curto: 'CNOOC PETROLEUM BRASIL LTDA', status: 'Ativo' },
    { id: 'cnocc-typo', nome: 'CNOCC PETROLEUM BRASIL LTDA', nome_curto: 'CNOOC PETROLEUM BRASIL LTDA', status: 'Ativo' },
    { id: 'outro', nome: 'OUTRO POSTO', nome_curto: 'OUTRO', status: 'Ativo' },
  ]

  it('inclui o alvo, a irmã Inativa e a irmã sem nome_curto (mesmo nome normalizado)', () => {
    const ids = idsGrupoDepartamento(depts, 'duo-ativa')
    expect(ids.has('duo-ativa')).toBe(true)
    expect(ids.has('duo-inativa')).toBe(true)
    expect(ids.has('duo-sem-curto')).toBe(true)
    expect(ids.has('outro')).toBe(false)
    expect(ids.size).toBe(3)
  })

  it('funciona a partir de qualquer linha do grupo (mesmo da irmã sem nome_curto)', () => {
    const ids = idsGrupoDepartamento(depts, 'duo-inativa')
    expect(ids.has('duo-ativa')).toBe(true)
    expect(ids.has('duo-sem-curto')).toBe(true)
    expect(ids.size).toBe(3)
  })

  it('expande por nome_curto compartilhado mesmo com nomes diferentes (typo CNOCC × CNOOC)', () => {
    const ids = idsGrupoDepartamento(depts, 'cnooc')
    expect(ids.has('cnooc')).toBe(true)
    expect(ids.has('cnocc-typo')).toBe(true)
  })

  it('retorna conjunto vazio quando o id não existe', () => {
    expect(idsGrupoDepartamento(depts, 'id-inexistente').size).toBe(0)
  })
})

describe('compararPreferenciaDepartamento', () => {
  const base = { nome: 'POSTO X', nome_curto: null, status: 'Ativo' }

  it('prefere Ativo a Inativo', () => {
    const ativo: DepartamentoFuzzy = { ...base, id: 'a', status: 'Ativo' }
    const inativo: DepartamentoFuzzy = { ...base, id: 'b', status: 'Inativo' }
    expect(compararPreferenciaDepartamento(ativo, inativo)).toBeLessThan(0)
    expect(compararPreferenciaDepartamento(inativo, ativo)).toBeGreaterThan(0)
  })

  it('prefere quem tem nome_curto (mesmo status)', () => {
    const comCurto: DepartamentoFuzzy = { ...base, id: 'a', nome_curto: 'X' }
    const semCurto: DepartamentoFuzzy = { ...base, id: 'b' }
    expect(compararPreferenciaDepartamento(comCurto, semCurto)).toBeLessThan(0)
  })

  it('Ativo vence mesmo contra Inativo com nome_curto', () => {
    const ativoSemCurto: DepartamentoFuzzy = { ...base, id: 'a', status: 'Ativo' }
    const inativoComCurto: DepartamentoFuzzy = { ...base, id: 'b', status: 'Inativo', nome_curto: 'X' }
    expect(compararPreferenciaDepartamento(ativoSemCurto, inativoComCurto)).toBeLessThan(0)
  })

  it('prefere o nome mais longo (mais específico) no último critério', () => {
    const curto: DepartamentoFuzzy = { id: 'a', nome: 'CBO', nome_curto: 'CBO', status: 'Ativo' }
    const longo: DepartamentoFuzzy = { id: 'b', nome: 'CBO SERVICOS MARITIMOS S.A.', nome_curto: 'CBO MACAÉ', status: 'Ativo' }
    expect(compararPreferenciaDepartamento(longo, curto)).toBeLessThan(0)
  })
})

describe('encontrarDepartamentoFuzzy — desempate determinístico (independente da ordem do array)', () => {
  // Os 5 textos reais da auditoria de 09/10/2026 que resolviam diferente
  // conforme a ordenação da lista (as telas carregam com ordenações
  // diferentes). Cada caso é testado com o array na ordem normal e invertida.
  const casos: Array<{ texto: string; esperado: string; depts: DepartamentoFuzzy[] }> = [
    {
      // CARMO CAMPANELLA — duplicada Ativa com curto × Inativa sem curto
      texto: 'CARMO CAMPANELLA',
      esperado: 'carmo-ativa',
      depts: [
        { id: 'carmo-inativa', nome: 'CARMO CAMPANELLA', nome_curto: null, status: 'Inativo' },
        { id: 'carmo-ativa', nome: 'CARMO CAMPANELLA', nome_curto: 'CARMO', status: 'Ativo' },
      ],
    },
    {
      // DALIAS — a linha com curto DALIAS foi inativada; a Ativa atual tem o mesmo nome
      texto: 'CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS ',
      esperado: 'dalias-ativa',
      depts: [
        { id: 'dalias-inativa', nome: 'CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS', nome_curto: 'DALIAS', status: 'Inativo' },
        { id: 'dalias-ativa', nome: 'CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS', nome_curto: 'DALIAS', status: 'Ativo' },
      ],
    },
    {
      // 3º OFÍCIO — Ativa sem curto × irmã Ativa com curto CARTÓRIO (grafia com º/acentos)
      texto: '3 OFICIO DE NOTAS DA COMARCA DE NITEROI ',
      esperado: 'oficio-cartorio',
      depts: [
        { id: 'oficio-sem-curto', nome: '3 OFICIO DE NOTAS DA COMARCA DE NITEROI', nome_curto: null, status: 'Ativo' },
        { id: 'oficio-cartorio', nome: '3º OFÍCIO DE NOTAS DA COMARCA DE NITERÓI', nome_curto: 'CARTÓRIO', status: 'Ativo' },
      ],
    },
    {
      // DUOCONNECT — match exato na linha INATIVA × Ativa com curto DUOCONNECT
      texto: 'DUOCONNECT SOLUCOES AUDITIVAS LTDA ',
      esperado: 'duo-ativa',
      depts: [
        { id: 'duo-inativa', nome: 'DUOCONNECT SOLUCOES AUDITIVAS LTDA', nome_curto: null, status: 'Inativo' },
        { id: 'duo-ativa', nome: 'DUOCONNECT SOLUÇÕES AUDITIVAS LTDA', nome_curto: 'DUOCONNECT', status: 'Ativo' },
      ],
    },
    {
      // J P R PROJETOS — duplicada Ativa × Inativa com o mesmo nome (match por tokens)
      texto: 'J P R PROJETOS',
      esperado: 'jpr-ativa',
      depts: [
        { id: 'jpr-inativa', nome: 'J P R PROJETOS E CONSTRUCOES LTDA', nome_curto: null, status: 'Inativo' },
        { id: 'jpr-ativa', nome: 'J P R PROJETOS E CONSTRUCOES LTDA', nome_curto: null, status: 'Ativo' },
      ],
    },
  ]

  for (const { texto, esperado, depts } of casos) {
    it(`"${texto.trim()}" resolve para ${esperado} com o array em qualquer ordem`, () => {
      expect(encontrarDepartamentoFuzzy(depts, null, texto)?.id).toBe(esperado)
      expect(encontrarDepartamentoFuzzy([...depts].reverse(), null, texto)?.id).toBe(esperado)
    })
  }

  it('em empate com substring, vence o nome mais longo/específico — "CBO SERVICOS MARITIMOS" NÃO resolve para a Aliança de curto "CBO"', () => {
    // Caso real (AGENTS.md): o texto legado "CBO SERVICOS MARITIMOS" é o posto
    // CBO MACAÉ; o curto "CBO" da Aliança (Niterói) é substring do texto e não
    // pode sequestrar a resolução quando a ordem do array muda.
    const deptsCbo: DepartamentoFuzzy[] = [
      { id: 'alianca-cbo', nome: 'ALIANCA S A INDUSTRIA NAVAL E EMPRESA DE NAVEGACAO', nome_curto: 'CBO', status: 'Ativo' },
      { id: 'cbo-macae', nome: 'CBO SERVICOS MARITIMOS S.A.', nome_curto: 'CBO MACAÉ', status: 'Ativo' },
    ]
    expect(encontrarDepartamentoFuzzy(deptsCbo, null, 'CBO SERVICOS MARITIMOS ')?.id).toBe('cbo-macae')
    expect(encontrarDepartamentoFuzzy([...deptsCbo].reverse(), null, 'CBO SERVICOS MARITIMOS ')?.id).toBe('cbo-macae')
  })
})

describe('departamentosSelecionaveis', () => {
  it('lista só Ativas com nome_curto, dedup por nome_curto normalizado, ordenado pt-BR', () => {
    const depts: DepartamentoFuzzy[] = [
      { id: 'bt-1', nome: 'BLUE TERMINAL DEEP WATERS SA – ZMAX GROUP', nome_curto: 'BLUE TERMINAL', status: 'Ativo' },
      { id: 'bt-2', nome: 'BLUE TERMINALS DEEP WATERS S. A -ZMAX GROUP', nome_curto: 'Blue Terminal', status: 'Ativo' },
      { id: 'cnooc-inativa', nome: 'CNOOC PETROLEUM BRASIL LTDA', nome_curto: 'CNOOC PETROLEUM BRASIL LTDA', status: 'Inativo' },
      { id: 'sem-curto', nome: 'POSTO SEM NOME CURTO', nome_curto: null, status: 'Ativo' },
      { id: 'curto-vazio', nome: 'POSTO COM CURTO VAZIO', nome_curto: '', status: 'Ativo' },
      { id: 'agua', nome: 'CONDOMINIO AGUA VERDE', nome_curto: 'ÁGUA VERDE', status: 'Ativo' },
    ]
    const selecionaveis = departamentosSelecionaveis(depts)
    // dedup: um único BLUE TERMINAL (a primeira ocorrência na ordenação estável)
    expect(selecionaveis.filter((d) => d.nome_curto?.toUpperCase() === 'BLUE TERMINAL')).toHaveLength(1)
    // fora: Inativa, sem nome_curto e nome_curto vazio
    expect(selecionaveis.map((d) => d.id)).not.toContain('cnooc-inativa')
    expect(selecionaveis.map((d) => d.id)).not.toContain('sem-curto')
    expect(selecionaveis.map((d) => d.id)).not.toContain('curto-vazio')
    // ordenação pt-BR: ÁGUA VERDE antes de BLUE TERMINAL (acento não pesa)
    expect(selecionaveis.map((d) => d.nome_curto)).toEqual(['ÁGUA VERDE', 'BLUE TERMINAL'])
  })

  it('mantém a primeira ocorrência do par duplicado', () => {
    const depts: DepartamentoFuzzy[] = [
      { id: 'primeira', nome: 'NUTRINDO IDEAIS LTDA', nome_curto: 'NUTRINDO IDEAIS', status: 'Ativo' },
      { id: 'segunda', nome: 'FLOR DE LOTUS CONSULTORIO MEDICO', nome_curto: 'NUTRINDO IDEAIS', status: 'Ativo' },
    ]
    expect(departamentosSelecionaveis(depts).map((d) => d.id)).toEqual(['primeira'])
  })
})
