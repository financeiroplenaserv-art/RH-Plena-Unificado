import { describe, it, expect } from 'vitest'
import { normalizarCargo, resolverFuncao, podeCobrirFuncao } from './funcoesFerias'
import type { FeriasFuncao } from '@/types/ferias'

// Catálogo espelhando os seeds das migrações 112/113 (grafias reais da base +
// matriz de cobertura: ASG→Jardineiro, Porteiro→Vigia, Encarregado→Porteiro)
const FUNCOES: FeriasFuncao[] = [
  { id: 'f-asg', nome: 'ASG', nivel: 1, cobre_funcoes: ['f-jardineiro'], aliases: ['AUXILIAR DE SERV GERAIS (LIMPEZA)', 'AUXILIAR DE SERVICOS GERAIS', 'AUXILIAR DE SERVIÇOS GERAIS', 'ASG', 'AUXILIAR DE LIMPEZA'], ativo: true },
  { id: 'f-porteiro', nome: 'Porteiro', nivel: 1, cobre_funcoes: ['f-vigia'], aliases: ['PORTEIRO (a)', 'PORTEIRO', 'PORTEIRO(A)', 'AUXILIAR DE PORTARIA'], ativo: true },
  { id: 'f-vigia', nome: 'Vigia', nivel: 1, cobre_funcoes: [], aliases: ['Vigia', 'VIGIA'], ativo: true },
  { id: 'f-jardineiro', nome: 'Jardineiro', nivel: 1, cobre_funcoes: [], aliases: ['JARDINEIRO'], ativo: true },
  { id: 'f-recepcionista', nome: 'Recepcionista', nivel: 1, cobre_funcoes: [], aliases: ['RECEPCIONISTA'], ativo: true },
  { id: 'f-zelador', nome: 'Zelador', nivel: 2, cobre_funcoes: [], aliases: ['ZELADOR', 'ZELADOR(A)'], ativo: true },
  { id: 'f-encarregado', nome: 'Encarregado', nivel: 3, cobre_funcoes: ['f-porteiro'], aliases: ['ENCARREGADO JUNIOR', 'ENCARREGADO PLENO', 'ENCARREGADO PLENO ', 'ENCARREGADO', 'LIDER'], ativo: true },
]

describe('normalizarCargo', () => {
  it('trim, maiúsculas, sem acentos e espaços colapsados', () => {
    expect(normalizarCargo('  Auxiliar  de Serviços Gerais ')).toBe('AUXILIAR DE SERVICOS GERAIS')
    expect(normalizarCargo('ENCARREGADO PLENO ')).toBe('ENCARREGADO PLENO')
    expect(normalizarCargo('')).toBe('')
  })
})

describe('resolverFuncao', () => {
  it("resolve 'AUXILIAR DE SERV GERAIS (LIMPEZA)' para ASG", () => {
    expect(resolverFuncao('AUXILIAR DE SERV GERAIS (LIMPEZA)', FUNCOES)?.nome).toBe('ASG')
  })

  it("resolve 'PORTEIRO (a)' para Porteiro", () => {
    expect(resolverFuncao('PORTEIRO (a)', FUNCOES)?.nome).toBe('Porteiro')
  })

  it("resolve 'ENCARREGADO PLENO ' (espaço sobrando) para Encarregado", () => {
    expect(resolverFuncao('ENCARREGADO PLENO ', FUNCOES)?.nome).toBe('Encarregado')
  })

  it("resolve 'ENCARREGADO JUNIOR' para Encarregado", () => {
    expect(resolverFuncao('ENCARREGADO JUNIOR', FUNCOES)?.nome).toBe('Encarregado')
  })

  it("resolve 'Vigia' para Vigia", () => {
    expect(resolverFuncao('Vigia', FUNCOES)?.nome).toBe('Vigia')
  })

  it('casa o próprio nome da função (sem depender de alias)', () => {
    expect(resolverFuncao('Recepcionista', FUNCOES)?.nome).toBe('Recepcionista')
  })

  it('ignora funções inativas', () => {
    const inativas = FUNCOES.map((f) => (f.nome === 'Vigia' ? { ...f, ativo: false } : f))
    expect(resolverFuncao('VIGIA', inativas)).toBeNull()
  })

  it('em alias duplicado, prefere a função de maior nível', () => {
    const duplicado: FeriasFuncao[] = [
      ...FUNCOES,
      { id: 'f-lideranca', nome: 'Liderança Operacional', nivel: 4, cobre_funcoes: [], aliases: ['ENCARREGADO'], ativo: true },
    ]
    expect(resolverFuncao('encarregado', duplicado)?.id).toBe('f-lideranca')
  })

  it('retorna null para cargo null, vazio ou desconhecido', () => {
    expect(resolverFuncao(null, FUNCOES)).toBeNull()
    expect(resolverFuncao(undefined, FUNCOES)).toBeNull()
    expect(resolverFuncao('   ', FUNCOES)).toBeNull()
    expect(resolverFuncao('CARGO INEXISTENTE', FUNCOES)).toBeNull()
  })
})

describe('podeCobrirFuncao (RN-02.3 — matriz explícita, migration 113)', () => {
  const porNome = (nome: string) => FUNCOES.find((f) => f.nome === nome)!

  it('encarregado cobre porteiro (está na matriz)', () => {
    expect(podeCobrirFuncao(porNome('Encarregado'), porNome('Porteiro'))).toBe(true)
  })

  it('porteiro NÃO cobre encarregado (fora da matriz)', () => {
    expect(podeCobrirFuncao(porNome('Porteiro'), porNome('Encarregado'))).toBe(false)
  })

  it('ASG NÃO cobre Porteiro (mesmo nível, mas fora da matriz)', () => {
    expect(podeCobrirFuncao(porNome('ASG'), porNome('Porteiro'))).toBe(false)
  })

  it('ASG cobre Jardineiro (está na matriz)', () => {
    expect(podeCobrirFuncao(porNome('ASG'), porNome('Jardineiro'))).toBe(true)
  })

  it('Porteiro cobre Vigia (está na matriz)', () => {
    expect(podeCobrirFuncao(porNome('Porteiro'), porNome('Vigia'))).toBe(true)
  })

  it('cobrir a própria função é sempre implícito (não precisa constar no array)', () => {
    expect(podeCobrirFuncao(porNome('Vigia'), porNome('Vigia'))).toBe(true)
    expect(porNome('Vigia').cobre_funcoes).toEqual([])
  })
})
