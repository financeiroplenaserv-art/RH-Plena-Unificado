import { describe, expect, it } from 'vitest'
import {
  enderecoMudou,
  exigenciasDeCargas,
  exigenciasDeCoberturas,
  filtrarRotasAConfirmar,
  montarRotasAConfirmar,
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
  { id: 'dep-b', nome: 'POSTO B', nome_curto: 'POSTO B', empresa_id: 'e', status: 'Ativo', endereco: null, cidade: 'Niterói' },
]
const traj = (id: string, c: string, d = 'dep-a') => ({
  id,
  colaborador_id: c,
  departamento_id: d,
  precisao_origem: 'exato' as const,
})
const confirmada: DecisaoRotaResumo = { status: 'confirmada', itinerarioId: 'it', custoDiarioCentavos: 1120 }

describe('exigências do mês (cobertura e escala)', () => {
  it('monta o motivo de cobertura/treinamento por vir ou em andamento e ignora encerrada e "sem cobertura"', () => {
    const nome = (id: string) => (id === 'dep-b' ? 'POSTO B' : 'POSTO A')
    const ex = exigenciasDeCoberturas(
      [
        { colaborador_id: '1', departamento_id: 'dep-b', data_inicio: '2026-12-01', data_fim: '2026-12-10' },
        { colaborador_id: '2', departamento_id: 'dep-b', data_inicio: '2026-11-18', data_fim: '2026-11-25', tipo: 'treinamento' },
        { colaborador_id: '3', departamento_id: 'dep-b', data_inicio: '2026-10-01', data_fim: '2026-11-20' },
        { colaborador_id: null, departamento_id: 'dep-b', data_inicio: '2026-12-01', data_fim: '2026-12-10' },
      ],
      nome,
      '2026-11-21',
    )
    expect(ex.map((e) => e.motivo)).toEqual([
      'Cobertura de férias em POSTO B a partir de 01/12',
      'Treinamento em POSTO B em andamento até 25/11',
    ])
  })

  it('monta o motivo de escala a partir do detalhe das cargas', () => {
    const ex = exigenciasDeCargas([
      {
        colaborador_id: '1',
        competencia: '2026-12',
        detalhe: [
          { departamento_id: 'dep-b', posto: 'ÉVORA', dias: 8 },
          { departamento_id: 'dep-a', posto: 'POSTO A', dias: 1 },
          { departamento_id: 'dep-c', posto: 'X', dias: 0 },
        ],
      },
      { colaborador_id: '2', competencia: '2026-11', detalhe: null },
    ])
    expect(ex.map((e) => e.motivo)).toEqual([
      'Escala de dezembro: 8 dias em ÉVORA',
      'Escala de dezembro: 1 dia em POSTO A',
    ])
  })

  it('lista pessoa × posto exigido, junta motivos, ordena a carga primeiro e ignora não optante', () => {
    const itens = montarRotasAConfirmar({
      colaboradores: [colab('1', 'Zélia'), colab('2', 'Ana'), colab('3', 'Cris', { vt_optante: false })],
      departamentos: DEPS,
      trajetos: [traj('t1', '1')],
      decisoes: new Map(),
      exigencias: [
        { colaboradorId: '1', departamentoId: 'dep-b', motivo: 'Cobertura de férias em POSTO B a partir de 01/12' },
        { colaboradorId: '1', departamentoId: 'dep-b', motivo: 'Escala de dezembro: 8 dias em POSTO B' },
        { colaboradorId: '1', departamentoId: 'dep-b', motivo: 'Escala de dezembro: 8 dias em POSTO B' },
        { colaboradorId: '1', departamentoId: 'dep-a', motivo: 'Escala de dezembro: 3 dias em POSTO A' },
        { colaboradorId: '3', departamentoId: 'dep-b', motivo: 'Cobertura de férias em POSTO B a partir de 01/12' },
      ],
    })
    expect(itens.map((i) => [i.nome, i.nomePosto, i.precisaCarga])).toEqual([
      ['Zélia', 'POSTO A', true],
      ['Zélia', 'POSTO B', true],
      ['Ana', 'POSTO A', false],
    ])
    const b = itens.find((i) => i.nomePosto === 'POSTO B')!
    expect(b.trajetoId).toBeNull()
    expect(b.motivo).toBe('sem_rota')
    expect(b.motivos).toEqual([
      'Cobertura de férias em POSTO B a partir de 01/12',
      'Escala de dezembro: 8 dias em POSTO B',
    ])
    // posto principal que a escala também exige: mantém os dois motivos
    const a = itens.find((i) => i.nome === 'Zélia' && i.nomePosto === 'POSTO A')!
    expect(a.motivos).toEqual(['Posto principal', 'Escala de dezembro: 3 dias em POSTO A'])
    expect(filtrarRotasAConfirmar(itens, { busca: '', postoId: TODOS_OS_POSTOS, soCarga: true })).toHaveLength(2)
  })

  it('rota confirmada sai da fila; trajeto criado pela fila (sem bilhete) segue como sem rota', () => {
    const itens = montarRotasAConfirmar({
      colaboradores: [colab('1', 'Ana')],
      departamentos: DEPS,
      trajetos: [{ ...traj('t1', '1', 'dep-b'), bilhete_id: null }, { ...traj('t2', '1'), bilhete_id: 'b' }],
      decisoes: new Map<string, DecisaoRotaResumo>([
        ['t1', { status: 'sugerida', itinerarioId: null, custoDiarioCentavos: null }],
        ['t2', confirmada],
      ]),
      exigencias: [{ colaboradorId: '1', departamentoId: 'dep-b', motivo: 'Escala de dezembro: 2 dias em POSTO B' }],
    })
    expect(itens.map((i) => [i.nomePosto, i.motivo, i.trajetoId])).toEqual([['POSTO B', 'sem_rota', 't1']])
  })
})

describe('endereço mudou', () => {
  it('ignora diferença só de forma; acusa mudança de rua, número, bairro, cidade ou CEP', () => {
    const base = 'RUA DAS FLORES, 10, CENTRO, Niterói - RJ, 24020-001'
    expect(enderecoMudou(base, 'rua das flores, 10, centro, Niteroi - RJ, 24020001')).toBe(false)
    expect(enderecoMudou(base, 'Rua das Flores 10 Centro Niterói RJ 24020-001')).toBe(false)
    expect(enderecoMudou(base, 'RUA DAS FLORES, 11, CENTRO, Niterói - RJ, 24020-001')).toBe(true)
    expect(enderecoMudou(base, 'RUA DAS FLORES, 10, ICARAÍ, Niterói - RJ, 24020-001')).toBe(true)
    expect(enderecoMudou(base, 'RUA DAS FLORES, 10, CENTRO, Niterói - RJ, 24020-002')).toBe(true)
  })

  it('sem endereço salvo ou atual não acusa', () => {
    expect(enderecoMudou(null, 'RUA X, 1')).toBe(false)
    expect(enderecoMudou('', 'RUA X, 1')).toBe(false)
    expect(enderecoMudou('RUA X, 1', null)).toBe(false)
  })

  it('rota confirmada com endereço diferente volta à fila com antes e agora; mesma forma ou sem baseline, não', () => {
    const c1 = colab('1', 'Ana', { endereco: 'RUA NOVA, 50, CENTRO', cidade: 'Niterói', cep: '24020-001' })
    const c2 = colab('2', 'Bia', { endereco: 'RUA X, 10, CENTRO', cidade: 'Niterói' })
    const c3 = colab('3', 'Cris')
    const itens = montarRotasAConfirmar({
      colaboradores: [c1, c2, c3],
      departamentos: DEPS,
      trajetos: [traj('t1', '1'), traj('t2', '2'), traj('t3', '3')],
      decisoes: new Map([['t1', confirmada], ['t2', confirmada], ['t3', confirmada]]),
      origemConfirmada: new Map<string, string | null>([
        ['t1', 'Rua Velha, 7, Centro, Niterói - RJ, 24020-001'],
        ['t2', 'rua x, 10, centro, niteroi'],
        ['t3', null],
      ]),
    })
    expect(itens).toHaveLength(1)
    expect(itens[0]).toMatchObject({
      nome: 'Ana',
      motivo: 'endereco_mudou',
      rotulo: 'Endereço mudou — revisar a rota',
      enderecoAntes: 'Rua Velha, 7, Centro, Niterói - RJ, 24020-001',
    })
    expect(itens[0].enderecoAgora).toContain('RUA NOVA')
  })

  it('ordena: carga do mês, sugerida, endereço mudou, antiga, sem rota', () => {
    const itens = montarRotasAConfirmar({
      colaboradores: [
        colab('1', 'A-antiga'),
        colab('2', 'B-sem'),
        colab('3', 'C-end', { endereco: 'RUA NOVA, 5, CENTRO' }),
        colab('4', 'D-sug'),
        colab('5', 'E-carga'),
      ],
      departamentos: DEPS,
      trajetos: [traj('t1', '1'), traj('t3', '3'), traj('t4', '4'), traj('t5', '5')],
      decisoes: new Map<string, DecisaoRotaResumo>([
        ['t3', confirmada],
        ['t4', { status: 'sugerida', itinerarioId: 'i', custoDiarioCentavos: 900 }],
      ]),
      origemConfirmada: new Map([['t3', 'Rua Velha, 1, Centro, Niterói']]),
      exigencias: [{ colaboradorId: '5', departamentoId: 'dep-a', motivo: 'Escala de dezembro: 2 dias em POSTO A' }],
    })
    expect(itens.map((i) => i.nome)).toEqual(['E-carga', 'D-sug', 'C-end', 'A-antiga', 'B-sem'])
  })
})
