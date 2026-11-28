import { describe, expect, it } from 'vitest'
import {
  filtrarRotasAConfirmar,
  indiceRevisavel,
  montarRotasAConfirmar,
  proximaRotaRevisavel,
  revisaoConfirmada,
  TODOS_OS_POSTOS,
  type DecisaoRotaResumo,
} from './rotasAConfirmar'
import type { VtColaborador, VtDepartamento } from '@/hooks/useVt'

function colab(id: string, nome: string, extra: Partial<VtColaborador> = {}): VtColaborador {
  return {
    id,
    nome_completo: nome,
    departamento: 'POSTO A',
    departamento_id: 'dep-a',
    cidade: 'Niterói',
    endereco: 'RUA X, 10, CENTRO',
    vt_optante: true,
    vt_tipo_cartao: null,
    ...extra,
  }
}
const DEPS: VtDepartamento[] = [
  { id: 'dep-a', nome: 'POSTO A', nome_curto: 'POSTO A', empresa_id: 'e', status: 'Ativo', endereco: null, cidade: 'Niterói' },
  { id: 'dep-b', nome: 'POSTO B', nome_curto: 'POSTO B', empresa_id: 'e', status: 'Ativo', endereco: null, cidade: null },
]
const traj = (id: string, c: string, d = 'dep-a', precisao: 'exato' | 'bairro' = 'exato') =>
  ({ id, colaborador_id: c, departamento_id: d, precisao_origem: precisao })
const confirmada: DecisaoRotaResumo = { status: 'confirmada', itinerarioId: 'it', custoDiarioCentavos: 1120 }

describe('montarRotasAConfirmar', () => {
  it('tira da fila quem tem revisão confirmada com itinerário e custo; ignora não optantes', () => {
    const itens = montarRotasAConfirmar({
      colaboradores: [colab('1', 'Ana'), colab('2', 'Bia'), colab('3', 'Cris', { vt_optante: false })],
      departamentos: DEPS,
      trajetos: [traj('t1', '1'), traj('t2', '2')],
      decisoes: new Map([['t1', confirmada]]),
    })
    expect(itens.map((i) => i.nome)).toEqual(['Bia'])
  })

  it('classifica sugerida, antiga e sem rota e ordena nessa ordem, depois por nome', () => {
    const itens = montarRotasAConfirmar({
      colaboradores: [colab('1', 'Zélia'), colab('2', 'Ana'), colab('3', 'Bia'), colab('4', 'Ágata')],
      departamentos: DEPS,
      trajetos: [traj('t1', '1'), traj('t2', '2'), traj('t4', '4')],
      decisoes: new Map<string, DecisaoRotaResumo>([
        ['t1', { status: 'sugerida', itinerarioId: 'it', custoDiarioCentavos: 1120 }],
        ['t2', { status: 'confirmada', itinerarioId: null, custoDiarioCentavos: null }],
        ['t4', { status: 'sugerida', itinerarioId: 'it2', custoDiarioCentavos: null }],
      ]),
    })
    expect(itens.map((i) => [i.nome, i.motivo])).toEqual([
      ['Ágata', 'sugerida'],
      ['Zélia', 'sugerida'],
      ['Ana', 'antiga'],
      ['Bia', 'sem_rota'],
    ])
    expect(itens[2].rotulo).toBe('Rota antiga (bilhete da planilha) — revisar')
    expect(itens[3].trajetoId).toBeNull()
  })

  it('número 0 ou vazio no endereço NÃO é aviso (decisão da gestora, 28/11/2026)', () => {
    const itens = montarRotasAConfirmar({
      colaboradores: [colab('1', 'Ana', { departamento_id: 'dep-b', departamento: 'POSTO B', endereco: 'RUA X, 0, CENTRO' })],
      departamentos: DEPS,
      trajetos: [traj('t-novo', '1', 'dep-b', 'bairro')],
      decisoes: new Map(),
    })
    expect(itens[0].avisos).toEqual(['Posto sem cidade'])
  })

  it('só olha o trajeto do posto atual e marca endereço incompleto (sem rua) e posto sem cidade', () => {
    const itens = montarRotasAConfirmar({
      colaboradores: [colab('1', 'Ana', { departamento_id: 'dep-b', departamento: 'POSTO B', endereco: null })],
      departamentos: DEPS,
      trajetos: [traj('t-velho', '1', 'dep-a'), traj('t-novo', '1', 'dep-b', 'bairro')],
      decisoes: new Map([['t-velho', confirmada]]),
    })
    expect(itens).toHaveLength(1)
    expect(itens[0].trajetoId).toBe('t-novo')
    expect(itens[0].avisos).toEqual(['Endereço incompleto', 'Posto sem cidade'])
  })

  it('endereço corrigido no cadastro tira o aviso, mesmo com o trajeto gravado como "bairro" (caso Alcemir)', () => {
    const itens = montarRotasAConfirmar({
      colaboradores: [colab('1', 'Alcemir', { endereco: 'Travessa Cosme e Damião, 20, B CASA 05, Neves' })],
      departamentos: DEPS,
      trajetos: [traj('t1', '1', 'dep-a', 'bairro')],
      decisoes: new Map<string, DecisaoRotaResumo>([['t1', { status: 'sugerida', itinerarioId: 'it', custoDiarioCentavos: 890 }]]),
    })
    expect(itens[0].avisos).toEqual([])
    expect(itens[0].precisaoOrigem).toBe('exato')
  })

  it('decisão confirmada com custo zero ainda entra na fila', () => {
    expect(revisaoConfirmada({ status: 'confirmada', itinerarioId: 'x', custoDiarioCentavos: 0 })).toBe(false)
    expect(revisaoConfirmada(undefined)).toBe(false)
    expect(revisaoConfirmada(confirmada)).toBe(true)
  })
})

describe('filtros e navegação da fila', () => {
  const itens = montarRotasAConfirmar({
    colaboradores: [
      colab('1', 'Ana Souza'),
      colab('2', 'Bruno Lima', { departamento_id: 'dep-b', departamento: 'POSTO B' }),
      colab('3', 'Cláudia Rocha'),
    ],
    departamentos: DEPS,
    trajetos: [traj('t1', '1'), traj('t2', '2', 'dep-b')],
    decisoes: new Map(),
  })

  it('filtra por nome sem acento e por posto', () => {
    expect(filtrarRotasAConfirmar(itens, { busca: 'claudia', postoId: TODOS_OS_POSTOS }).map((i) => i.nome)).toEqual(['Cláudia Rocha'])
    expect(filtrarRotasAConfirmar(itens, { busca: '', postoId: 'dep-b' }).map((i) => i.nome)).toEqual(['Bruno Lima'])
  })

  it('a próxima passa também por quem não tem trajeto e usa a posição anterior quando a atual saiu da fila', () => {
    // fila: Ana, Bruno (rota antiga) e Cláudia (sem rota — o trajeto é criado ao abrir)
    const ana = itens.find((i) => i.nome === 'Ana Souza')!
    expect(proximaRotaRevisavel(itens, ana.chave)?.nome).toBe('Bruno Lima')
    const bruno = itens.find((i) => i.nome === 'Bruno Lima')!
    expect(proximaRotaRevisavel(itens, bruno.chave)?.nome).toBe('Cláudia Rocha')
    const claudia = itens.find((i) => i.nome === 'Cláudia Rocha')!
    expect(proximaRotaRevisavel(itens, claudia.chave)).toBeNull()
    const semAna = itens.filter((i) => i.nome !== 'Ana Souza')
    expect(indiceRevisavel(itens, ana.chave)).toBe(0)
    expect(proximaRotaRevisavel(semAna, ana.chave, 0)?.nome).toBe('Bruno Lima')
  })
})
