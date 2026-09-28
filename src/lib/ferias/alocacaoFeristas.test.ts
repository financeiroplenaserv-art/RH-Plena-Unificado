import { describe, it, expect } from 'vitest'
import { sugerirAlocacoes, elegiveisParaVaga } from './alocacaoFeristas'
import type { FeriasFerista, FeriasFuncao, FeriasSolicitacao } from '@/types/ferias'

// ============================================================
// Cenário simulado: 3 contratos (D1, D2, D3), 15 colaboradores
// (c1..c15 distribuídos entre eles) e 5 feristas:
//   F1 Porteiro (casa D1) · F2 Porteiro (casa D2) · F3 ASG (casa D3)
//   F4 Encarregado (casa D1) · F5 Porteiro (casa D3)
// ============================================================

const HOJE = '2026-09-28'

const FUNCOES: FeriasFuncao[] = [
  { id: 'fp', nome: 'Porteiro', nivel: 1, cobre_funcoes: ['fv'], aliases: ['PORTEIRO'], ativo: true },
  { id: 'fa', nome: 'ASG', nivel: 1, cobre_funcoes: ['fj'], aliases: ['ASG'], ativo: true },
  { id: 'fe', nome: 'Encarregado', nivel: 3, cobre_funcoes: ['fp'], aliases: ['ENCARREGADO'], ativo: true },
  { id: 'fv', nome: 'Vigia', nivel: 1, cobre_funcoes: [], aliases: ['VIGIA'], ativo: true },
  { id: 'fj', nome: 'Jardineiro', nivel: 1, cobre_funcoes: [], aliases: ['JARDINEIRO'], ativo: true },
]

function ferista(id: string, nome: string, funcaoId: string, departamentoId: string, parcial: Partial<FeriasFerista> = {}): FeriasFerista {
  return {
    id,
    colaborador_id: `col-${id}`,
    funcao_id: funcaoId,
    max_dias_consecutivos: 30,
    max_coberturas_mes: 2,
    ativo: true,
    observacao: null,
    colaborador: { id: `col-${id}`, nome_completo: nome, matricula: id, cargo: '', status: 'Ativo', departamento_id: departamentoId },
    ...parcial,
  }
}

const F1 = ferista('F1', 'Ferista Um', 'fp', 'D1')
const F2 = ferista('F2', 'Ferista Dois', 'fp', 'D2')
const F3 = ferista('F3', 'Ferista Três', 'fa', 'D3')
const F4 = ferista('F4', 'Ferista Quatro', 'fe', 'D1')
const F5 = ferista('F5', 'Ferista Cinco', 'fp', 'D3')
const CINCO_FERISTAS = [F1, F2, F3, F4, F5]

function vaga(id: string, departamentoId: string | null, funcaoId: string | null, inicio: string, fim: string, colaboradorId = `c${id}`): FeriasSolicitacao {
  return {
    id,
    colaborador_id: colaboradorId,
    departamento_id: departamentoId,
    funcao_id: funcaoId,
    data_inicio: inicio,
    data_fim: fim,
    tipo: 'agendado',
    status: 'aprovada',
    dias_abono: 0,
    adiantamento_13: false,
    parcelada: false,
    origem: 'manual',
    observacao: null,
    ferista_alocado_id: null,
    origem_alocacao: null,
    pedido_colaborador: false,
    registrado_por: null,
    aprovado_por: null,
    data_aprovacao: null,
  }
}

function cobertura(feristaId: string, departamentoId: string | null, inicio: string, fim: string) {
  return { ferista_id: feristaId, departamento_id: departamentoId, data_inicio: inicio, data_fim: fim, status: 'confirmada' as const }
}

function feriasProprias(colaboradorId: string, inicio: string, fim: string) {
  return { colaborador_id: colaboradorId, data_inicio: inicio, data_fim: fim, tipo: 'gozo' as const, status: 'em_andamento' as const }
}

const SEM_NADA = { funcoes: FUNCOES, alocacoes: [], feriasFeristas: [], hoje: HOJE }

describe('sugerirAlocacoes', () => {
  it('RN-07 sequência perfeita: mesmo ferista pega vagas encadeadas do mesmo posto', () => {
    const f1Folgado = ferista('F1', 'Ferista Um', 'fp', 'D1', { max_dias_consecutivos: 60 })
    const vagas = [
      vaga('v1', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c1'),
      vaga('v2', 'D1', 'fp', '2026-10-31', '2026-11-29', 'c2'),
    ]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: [f1Folgado, F2, F3, F4, F5], ...SEM_NADA })
    expect(criticas).toHaveLength(0)
    expect(sugestoes).toHaveLength(2)
    expect(sugestoes[0].ferista.id).toBe('F1')
    expect(sugestoes[1].ferista.id).toBe('F1')
    expect(sugestoes[1].motivo).toContain('sequência no contrato')
  })

  it('RN-06 conflito simultâneo: 2 vagas sobrepostas no mesmo posto pegam feristas distintos', () => {
    const vagas = [
      vaga('v1', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c1'),
      vaga('v3', 'D1', 'fp', '2026-10-15', '2026-11-13', 'c3'),
    ]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: CINCO_FERISTAS, ...SEM_NADA })
    expect(criticas).toHaveLength(0)
    expect(sugestoes).toHaveLength(2)
    expect(sugestoes[0].ferista.id).toBe('F1') // mesmo contrato vence a 1ª
    expect(sugestoes[1].ferista.id).not.toBe('F1') // F1 em conflito, outro assume
    expect(sugestoes[0].ferista.id).not.toBe(sugestoes[1].ferista.id)
  })

  it('RN-02.3 matriz: encarregado cobre porteiro (consta em cobre_funcoes)', () => {
    const vagas = [vaga('v4', 'D2', 'fp', '2026-11-02', '2026-12-01', 'c4')]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: [F4], ...SEM_NADA })
    expect(criticas).toHaveLength(0)
    expect(sugestoes[0].ferista.id).toBe('F4')
    expect(sugestoes[0].motivo).toContain('cobra via matriz (Encarregado → Porteiro)')
  })

  it('RN-02.3 matriz: porteiro NUNCA cobre encarregado (fora da matriz) — vira cobertura crítica', () => {
    const vagas = [vaga('v5', 'D1', 'fe', '2026-11-02', '2026-12-01', 'c5')]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: [F1, F2, F3, F5], ...SEM_NADA })
    expect(sugestoes).toHaveLength(0)
    expect(criticas).toHaveLength(1)
    expect(criticas[0].motivo).toBe('nenhum ferista elegível para a função')
  })

  it('RN-02.3 matriz: ASG NÃO cobre Porteiro (mesmo nível, mas fora da matriz)', () => {
    const vagas = [vaga('v5b', 'D2', 'fp', '2026-11-02', '2026-12-01', 'c5')]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: [F3], ...SEM_NADA })
    expect(sugestoes).toHaveLength(0)
    expect(criticas[0].motivo).toBe('nenhum ferista elegível para a função')
  })

  it('RN-02.3 matriz: ASG cobre Jardineiro (consta em cobre_funcoes)', () => {
    const vagas = [vaga('v5c', 'D3', 'fj', '2026-11-02', '2026-12-01', 'c5')]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: [F3], ...SEM_NADA })
    expect(criticas).toHaveLength(0)
    expect(sugestoes[0].ferista.id).toBe('F3')
    expect(sugestoes[0].motivo).toContain('cobra via matriz (ASG → Jardineiro)')
  })

  it('RN-02.4 fairness: entre elegíveis iguais, quem nunca alocou ganha de todos', () => {
    const fa = ferista('FA', 'Ferista A', 'fp', 'D3')
    const fb = ferista('FB', 'Ferista B', 'fp', 'D3')
    const vagas = [vaga('v6', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c6')]
    const alocacoes = [cobertura('FA', 'D1', '2026-07-01', '2026-07-30')]
    const { sugestoes } = sugerirAlocacoes({ vagas, feristas: [fa, fb], ...SEM_NADA, alocacoes })
    expect(sugestoes[0].ferista.id).toBe('FB')
    expect(sugestoes[0].motivo).toContain('nunca alocou')
  })

  it('RN-02.4 fairness: entre dois que já alocaram, ganha o há mais tempo sem alocar', () => {
    const fa = ferista('FA', 'Ferista A', 'fp', 'D3')
    const fb = ferista('FB', 'Ferista B', 'fp', 'D3')
    const vagas = [vaga('v7', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c7')]
    const alocacoes = [
      cobertura('FA', 'D1', '2026-08-15', '2026-09-01'), // 27d sem alocar
      cobertura('FB', 'D2', '2026-07-15', '2026-08-01'), // 58d sem alocar
    ]
    const { sugestoes } = sugerirAlocacoes({ vagas, feristas: [fa, fb], ...SEM_NADA, alocacoes })
    expect(sugestoes[0].ferista.id).toBe('FB')
  })

  it('RN-05 limite de coberturas no mês: ferista no limite é pulado', () => {
    // 2 coberturas tocando outubro sem sobrepor a vaga (05–09/out)
    const alocacoes = [
      cobertura('F1', 'D1', '2026-09-25', '2026-10-03'),
      cobertura('F1', 'D2', '2026-10-20', '2026-10-31'),
    ]
    const vagas = [vaga('v8', 'D1', 'fp', '2026-10-05', '2026-10-09', 'c8')]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: CINCO_FERISTAS, ...SEM_NADA, alocacoes })
    expect(criticas).toHaveLength(0)
    expect(sugestoes[0].ferista.id).not.toBe('F1') // F1 já tem 2 coberturas tocando outubro
  })

  it('RN-05 dias consecutivos: cobertura adjacente encadeada estoura o limite em OUTRO contrato', () => {
    const f1Curto = ferista('F1', 'Ferista Um', 'fp', 'D1', { max_dias_consecutivos: 35 })
    const alocacoes = [cobertura('F1', 'D1', '2026-09-01', '2026-09-30')]
    const vagas = [vaga('v9', 'D2', 'fp', '2026-10-01', '2026-10-30', 'c9')]
    const { sugestoes } = sugerirAlocacoes({ vagas, feristas: [f1Curto, F2, F3, F4, F5], ...SEM_NADA, alocacoes })
    // 30d (set) + 30d (out) = 60 consecutivos > 35 → F1 fora (vaga fora do contrato da cobertura)
    expect(sugestoes[0].ferista.id).not.toBe('F1')
  })

  it('RN-05 exceção de continuação: limite de dias NÃO barra a sequência no mesmo contrato', () => {
    const f1Curto = ferista('F1', 'Ferista Um', 'fp', 'D1', { max_dias_consecutivos: 35 })
    const alocacoes = [cobertura('F1', 'D1', '2026-09-01', '2026-09-30')]
    const vagas = [vaga('v9b', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c9')]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: [f1Curto], ...SEM_NADA, alocacoes })
    // 60 dias seguidos no mesmo posto: continuidade é o ideal operacional, o limite não se aplica
    expect(criticas).toHaveLength(0)
    expect(sugestoes[0].ferista.id).toBe('F1')
    expect(sugestoes[0].motivo).toContain('sequência no contrato')
  })

  it('RN-05 exceção de continuação: 4 férias mensais encadeadas no mesmo posto ficam com o mesmo ferista', () => {
    // O exemplo da gestão: contrato com 4 porteiros saindo um após o outro
    const vagas = [
      vaga('vO', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c1'),
      vaga('vN', 'D1', 'fp', '2026-10-31', '2026-11-29', 'c2'),
      vaga('vD', 'D1', 'fp', '2026-11-30', '2026-12-29', 'c3'),
      vaga('vJ', 'D1', 'fp', '2026-12-30', '2027-01-28', 'c4'),
    ]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: CINCO_FERISTAS, ...SEM_NADA })
    expect(criticas).toHaveLength(0)
    expect(sugestoes).toHaveLength(4)
    for (const s of sugestoes) expect(s.ferista.id).toBe('F1')
  })

  it('RN-04 ferista de férias: indisponível durante o próprio gozo', () => {
    const vagas = [vaga('v10', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c10')]
    const feriasFeristas = [feriasProprias('col-F1', '2026-10-05', '2026-10-20')]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: CINCO_FERISTAS, ...SEM_NADA, feriasFeristas })
    expect(criticas).toHaveLength(0)
    expect(sugestoes[0].ferista.id).not.toBe('F1')
  })

  it('RN-08 cobertura crítica por limite de carga: motivo explica a causa', () => {
    // 2 coberturas confirmadas tocando outubro SEM sobrepor a vaga (05–09/out)
    const alocacoes = [
      cobertura('F1', 'D1', '2026-09-25', '2026-10-03'),
      cobertura('F1', 'D2', '2026-10-20', '2026-10-31'),
    ]
    const vagas = [vaga('v11', 'D1', 'fp', '2026-10-05', '2026-10-09', 'c11')]
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: [F1], ...SEM_NADA, alocacoes })
    expect(sugestoes).toHaveLength(0)
    expect(criticas[0].motivo).toBe('todos os feristas elegíveis no limite de carga')
  })

  it('cobre as 15 vagas dos 3 contratos sem ferista repetido no mesmo período', () => {
    // 15 colaboradores (5 por contrato) com férias escalonadas
    const vagas = [
      vaga('v1', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c1'),
      vaga('v2', 'D1', 'fp', '2026-10-15', '2026-11-13', 'c2'),
      vaga('v3', 'D1', 'fa', '2026-11-02', '2026-12-01', 'c3'),
      vaga('v4', 'D1', 'fp', '2026-12-01', '2026-12-30', 'c4'),
      vaga('v5', 'D1', 'fe', '2026-10-01', '2026-10-30', 'c5'),
      vaga('v6', 'D2', 'fp', '2026-10-01', '2026-10-30', 'c6'),
      vaga('v7', 'D2', 'fp', '2026-11-02', '2026-12-01', 'c7'),
      vaga('v8', 'D2', 'fa', '2026-10-01', '2026-10-30', 'c8'),
      vaga('v9', 'D2', 'fp', '2026-12-01', '2026-12-30', 'c9'),
      vaga('v10', 'D2', 'fp', '2026-10-15', '2026-11-13', 'c10'),
      vaga('v11', 'D3', 'fp', '2026-10-01', '2026-10-30', 'c11'),
      vaga('v12', 'D3', 'fa', '2026-11-02', '2026-12-01', 'c12'),
      vaga('v13', 'D3', 'fp', '2026-10-15', '2026-11-13', 'c13'),
      vaga('v14', 'D3', 'fp', '2026-12-01', '2026-12-30', 'c14'),
      vaga('v15', 'D3', 'fe', '2026-10-01', '2026-10-30', 'c15'),
    ]
    const feristasFolgados = CINCO_FERISTAS.map((f) => ({ ...f, max_dias_consecutivos: 90, max_coberturas_mes: 8 }))
    const { sugestoes, criticas } = sugerirAlocacoes({ vagas, feristas: feristasFolgados, ...SEM_NADA })
    expect(sugestoes.length + criticas.length).toBe(15)

    // RN-03 dentro do lote: nenhum ferista com 2 sugestões sobrepostas
    const porFerista = new Map<string, { inicio: string; fim: string }[]>()
    for (const s of sugestoes) {
      const lista = porFerista.get(s.ferista.id) ?? []
      lista.push({ inicio: s.vaga.data_inicio, fim: s.vaga.data_fim })
      porFerista.set(s.ferista.id, lista)
    }
    for (const [, periodos] of porFerista) {
      for (let i = 0; i < periodos.length; i++) {
        for (let j = i + 1; j < periodos.length; j++) {
          const sobrepoe = periodos[i].inicio <= periodos[j].fim && periodos[i].fim >= periodos[j].inicio
          expect(sobrepoe).toBe(false)
        }
      }
    }
  })
})

describe('elegiveisParaVaga', () => {
  it('devolve elegíveis ordenados por score com motivo legível', () => {
    const { elegiveis, motivoSemElegiveis } = elegiveisParaVaga({
      vaga: vaga('v1', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c1'),
      feristas: CINCO_FERISTAS,
      ...SEM_NADA,
    })
    expect(motivoSemElegiveis).toBeNull()
    expect(elegiveis[0].ferista.id).toBe('F1') // mesmo contrato e função
    expect(elegiveis[0].motivo).toContain('mesmo contrato e função')
    // F3 (ASG) NÃO é elegível para porteiro: fora da matriz cobre_funcoes
    expect(elegiveis.some((e) => e.ferista.id === 'F3')).toBe(false)
    expect(elegiveis.some((e) => e.ferista.id === 'F4')).toBe(true) // cobre via matriz
  })

  it('ignora ferista inativo', () => {
    const f1Inativo = ferista('F1', 'Ferista Um', 'fp', 'D1', { ativo: false })
    const { elegiveis } = elegiveisParaVaga({
      vaga: vaga('v1', 'D1', 'fp', '2026-10-01', '2026-10-30', 'c1'),
      feristas: [f1Inativo, F2],
      ...SEM_NADA,
    })
    expect(elegiveis.map((e) => e.ferista.id)).toEqual(['F2'])
  })
})
