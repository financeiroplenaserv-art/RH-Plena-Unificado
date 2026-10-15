import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chaveDepartamento, deduplicarFuncionariosImportacao, deveIgnorarErroImportacao, extrairMensagemErro, mapearDepartamentosImportacao, mensagemDepartamentoNaoResolvido } from './econtador'
import { REDIRECIONAMENTOS_DEPARTAMENTO_INATIVO } from './departamentos'
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

const cascais: DepartamentoFuzzy = {
  id: 'cascais', nome: 'CONDOMINIO VILA DE CASCAIS RESIDENCIAL', nome_curto: 'CASCAIS', empresa_id: null, status: 'Ativo',
}

describe('chaveDepartamento (regressão 15/10/2026 — espaço no fim da Alterdata)', () => {
  it('a chave é trim + lower-case', () => {
    expect(chaveDepartamento('CONDOMINIO VILA DE CASCAIS RESIDENCIAL ')).toBe('condominio vila de cascais residencial')
    expect(chaveDepartamento('  PLENA EA FACILITIES  ')).toBe('plena ea facilities')
  })

  it('texto bruto com espaço no fim acha a chave gravada a partir do nome aparado', () => {
    // A importação apara os nomes antes de montar o mapa, mas consultava com o
    // texto BRUTO (com espaço) — o get não achava a chave e o upsert zerava o
    // departamento_id (244 colaboradores). Gravação e consulta usam a mesma chave.
    const { mapa, naoResolvidos } = mapearDepartamentosImportacao(
      ['CONDOMINIO VILA DE CASCAIS RESIDENCIAL'], // nome já aparado pelo chamador
      [...ativas, cascais],
      EMPRESA,
    )
    expect(naoResolvidos).toEqual([])
    expect(mapa.get(chaveDepartamento('CONDOMINIO VILA DE CASCAIS RESIDENCIAL '))).toBe('cascais')
    expect(mapa.get(chaveDepartamento('condominio vila de cascais residencial  '))).toBe('cascais')
  })
})

const ID_DALIAS_INATIVA_1 = '52e9ab9f-2d2a-47d7-8eee-2214c671343d'
const ID_DALIAS_INATIVA_2 = '97806df1-396b-4a05-97f5-9ddb8c49582f'
const ID_ITAGUAI = '8eb83a32-e1f7-454f-9e53-3134bf887a26'

const daliasInativas: DepartamentoFuzzy[] = [
  { id: ID_DALIAS_INATIVA_1, nome: 'CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS', nome_curto: 'DALIAS', empresa_id: null, status: 'Inativo' },
  { id: ID_DALIAS_INATIVA_2, nome: 'CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS', nome_curto: 'DALIAS', empresa_id: null, status: 'Inativo' },
]
const itaguaiReal: DepartamentoFuzzy = {
  id: ID_ITAGUAI, nome: 'CONDOMINIO DO EDIFICIO RESIDENCIAL ROSAS', nome_curto: 'ITAGUAÍ', empresa_id: null, status: 'Ativo',
}

describe('redirect de linha inativa (decisão da gestão, 15/10/2026)', () => {
  it('as duas linhas inativas DALIAS têm redirect explícito para ITAGUAÍ', () => {
    expect(REDIRECIONAMENTOS_DEPARTAMENTO_INATIVO[ID_DALIAS_INATIVA_1]).toBe(ID_ITAGUAI)
    expect(REDIRECIONAMENTOS_DEPARTAMENTO_INATIVO[ID_DALIAS_INATIVA_2]).toBe(ID_ITAGUAI)
  })

  it('texto DALIAS casa com a linha INATIVA e vai para ITAGUAÍ pelo redirect explícito (não por grafia)', () => {
    // Prova de que não depende de semelhança: um departamento ativo SEM nenhuma
    // grafia parecida está na lista e não pode ser escolhido.
    const unrelated: DepartamentoFuzzy = {
      id: 'zz', nome: 'ZZ SEM RELACAO NENHUMA', nome_curto: 'ZZ', empresa_id: null, status: 'Ativo',
    }
    const { mapa, naoResolvidos } = mapearDepartamentosImportacao(
      ['CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS '], // com espaço no fim, como vem da Alterdata
      [unrelated, ...daliasInativas, itaguaiReal],
      EMPRESA,
    )
    expect(naoResolvidos).toEqual([])
    expect(mapa.get(chaveDepartamento('CONDOMINIO DO EDIFICIO RESIDENCIAL DALIAS '))).toBe(ID_ITAGUAI)
  })

  it('irmã inativa com nome_curto igual a uma ativa redireciona para a ativa (regra genérica)', () => {
    const inativa: DepartamentoFuzzy = {
      id: 'antigo', nome: 'EMPRESA X UNIDADE ANTIGA', nome_curto: 'POSTO X', empresa_id: null, status: 'Inativo',
    }
    const ativa: DepartamentoFuzzy = {
      id: 'atual', nome: 'EMPRESA X UNIDADE NOVA', nome_curto: 'POSTO X', empresa_id: null, status: 'Ativo',
    }
    const { mapa, naoResolvidos } = mapearDepartamentosImportacao(
      ['EMPRESA X UNIDADE ANTIGA'],
      [inativa, ativa],
      EMPRESA,
    )
    expect(naoResolvidos).toEqual([])
    expect(mapa.get(chaveDepartamento('EMPRESA X UNIDADE ANTIGA'))).toBe('atual')
  })

  it('linha inativa SEM redirect e SEM irmã ativa vai para naoResolvidos (contrato encerrado de verdade)', () => {
    const encerrado: DepartamentoFuzzy = {
      id: 'enc', nome: 'CONTRATO ENCERRADO TOTAL', nome_curto: 'ENCERRADO', empresa_id: null, status: 'Inativo',
    }
    const { mapa, naoResolvidos } = mapearDepartamentosImportacao(
      ['CONTRATO ENCERRADO TOTAL'],
      [encerrado, ...ativas],
      EMPRESA,
    )
    expect(mapa.size).toBe(0)
    expect(naoResolvidos).toEqual(['CONTRATO ENCERRADO TOTAL'])
  })
})

describe('deduplicarFuncionariosImportacao (15/10/2026 — mesma pessoa 2x na Alterdata)', () => {
  const vigente = { cpf: '111', codigo: '55', id: 'a1', nome: 'MARIA', demissao: null, admissao: '2024-03-01' }
  const demitido = { cpf: '111', codigo: '55', id: 'a1', nome: 'MARIA', demissao: '2020-06-30', admissao: '2018-01-10' }

  it('mantém o contrato vigente quando o demitido vem primeiro (ordem real da API)', () => {
    const { unicos, duplicados } = deduplicarFuncionariosImportacao([demitido, vigente])
    expect(unicos).toEqual([vigente])
    expect(duplicados).toHaveLength(1)
    expect(duplicados[0].descartado).toBe(demitido)
    expect(duplicados[0].mantido).toBe(vigente)
  })

  it('mantém o contrato vigente quando o demitido vem por último', () => {
    const { unicos } = deduplicarFuncionariosImportacao([vigente, demitido])
    expect(unicos).toEqual([vigente])
  })

  it('dois registros sem demissão: vale a admissão mais recente', () => {
    const antigo = { cpf: '222', nome: 'JOSE', demissao: null, admissao: '2019-05-01' }
    const recente = { cpf: '222', nome: 'JOSE', demissao: null, admissao: '2025-02-01' }
    expect(deduplicarFuncionariosImportacao([antigo, recente]).unicos).toEqual([recente])
    expect(deduplicarFuncionariosImportacao([recente, antigo]).unicos).toEqual([recente])
  })

  it('pessoas diferentes (CPF distinto) são mantidas; sem chave, entra como está', () => {
    const outro = { cpf: '999', nome: 'OUTRO', demissao: null, admissao: '2024-01-01' }
    const semChave = { nome: 'SEM CPF', demissao: null, admissao: null }
    const { unicos, duplicados } = deduplicarFuncionariosImportacao([vigente, outro, semChave])
    expect(unicos).toEqual([vigente, outro, semChave])
    expect(duplicados).toEqual([])
  })

  it('casa por código/matrícula quando o CPF vem vazio', () => {
    const a = { cpf: '', codigo: '77', nome: 'ANA', demissao: '2021-01-01', admissao: '2019-01-01' }
    const b = { cpf: null, codigo: '77', nome: 'ANA', demissao: null, admissao: '2023-01-01' }
    const { unicos } = deduplicarFuncionariosImportacao([a, b])
    expect(unicos).toEqual([b])
  })
})

describe('cópia na Edge Function sync-econtador', () => {
  const raiz = resolve(__dirname, '../..')
  const fn = readFileSync(resolve(raiz, 'supabase/functions/sync-econtador/index.ts'), 'utf8').replace(/\r\n/g, '\n')
  // Mesma extração de scripts/sincronizar-sync-econtador.mjs (fatia entre os
  // marcadores SYNC-ECONTADOR do src).
  const fatia = (arq: string) => {
    const linhas = readFileSync(resolve(raiz, arq), 'utf8').replace(/\r\n/g, '\n').split('\n')
    const i = linhas.findIndex((l) => l.startsWith('// >>> SYNC-ECONTADOR: INÍCIO'))
    const j = linhas.findIndex((l) => l.startsWith('// <<< SYNC-ECONTADOR: FIM'))
    return linhas.slice(i + 1, j).join('\n').trimEnd()
  }
  it.each(['src/lib/departamentos.ts', 'src/lib/econtador.ts'])(
    'a function contém a fatia SYNC-ECONTADOR de %s idêntica (rode node scripts/sincronizar-sync-econtador.mjs)',
    (arq) => {
      expect(
        fn.includes(`// >>> LÓGICA PURA: ${arq} (cópia — não editar aqui)\n` + fatia(arq) + `\n// <<< FIM: ${arq}`)
      ).toBe(true)
    }
  )
})
