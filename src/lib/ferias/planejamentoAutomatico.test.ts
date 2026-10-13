import { describe, it, expect } from 'vitest'
import { gerarPlanoAutomatico, type ColaboradorPlano } from './planejamentoAutomatico'
import type { FeriasRegra, FeriasSolicitacao } from '@/types/ferias'

// Cenário: 2 contratos (D1, D2), funções Porteiro (fp) e ASG (fa).
// Admissões antigas garantem limites calculáveis e previsíveis.

const HOJE = '2026-09-25'
const INI = '2027-01-01'
const FIM = '2027-06-30'

function colab(id: string, admissao: string | null, departamentoId: string | null = 'D1', funcaoId: string | null = 'fp'): ColaboradorPlano {
  return {
    id,
    nome_completo: `Colaborador ${id}`,
    data_admissao: admissao,
    departamento_id: departamentoId,
    cargo: 'PORTEIRO (a)',
    status: 'Ativo',
    funcao_id: funcaoId,
  }
}

function solicitacao(colaboradorId: string, tipo: 'gozo' | 'agendado' | 'previsto', inicio: string, fim: string, status: FeriasSolicitacao['status'] = 'concluida'): FeriasSolicitacao {
  return {
    id: `s-${colaboradorId}-${inicio}`,
    colaborador_id: colaboradorId,
    departamento_id: 'D1',
    funcao_id: 'fp',
    data_inicio: inicio,
    data_fim: fim,
    tipo,
    status,
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

const REGRA_GLOBAL: FeriasRegra = { id: 'r1', departamento_id: null, funcao_id: null, max_simultaneos: 1 }
const SEM_REGRAS = [REGRA_GLOBAL]

describe('gerarPlanoAutomatico', () => {
  it('ordena por urgência CLT: limite mais antigo sai primeiro', () => {
    // c1: gozou em 2024 → limite antigo (vencido); c2: nunca gozou, admissão 2025 → limite mais novo
    const c1 = colab('c1', '2020-01-10')
    const c2 = colab('c2', '2025-06-01')
    const solicitacoes = [solicitacao('c1', 'gozo', '2024-02-01', '2024-03-01')]
    const { propostas } = gerarPlanoAutomatico({
      colaboradores: [c2, c1], // fora de ordem de propósito
      solicitacoes,
      regras: SEM_REGRAS,
      periodoInicio: INI,
      periodoFim: FIM,
      hoje: HOJE,
    })
    expect(propostas).toHaveLength(2)
    expect(propostas[0].colaborador.id).toBe('c1')
    expect(propostas[0].motivo).toContain('vencido')
    expect(propostas[1].colaborador.id).toBe('c2')
    expect(propostas[1].motivo).toContain('limite concessivo em')
  })

  it('não mexe em quem já tem plano no período (pedido do colaborador preservado)', () => {
    const c1 = colab('c1', '2020-01-10')
    const pedido = { ...solicitacao('c1', 'previsto', '2027-03-01', '2027-03-30', 'pendente'), pedido_colaborador: true }
    const { propostas, resumo } = gerarPlanoAutomatico({
      colaboradores: [c1],
      solicitacoes: [pedido],
      regras: SEM_REGRAS,
      periodoInicio: INI,
      periodoFim: FIM,
      hoje: HOJE,
    })
    expect(propostas).toHaveLength(0)
    expect(resumo.jaComPlano).toBe(1)
  })

  it('encadeia férias no mesmo contrato+função (teto 1): uma começa quando a outra termina', () => {
    const colaboradores = [colab('c1', '2020-01-10'), colab('c2', '2020-02-10'), colab('c3', '2020-03-10')]
    const { propostas } = gerarPlanoAutomatico({
      colaboradores,
      solicitacoes: [],
      regras: SEM_REGRAS,
      periodoInicio: INI,
      periodoFim: FIM,
      hoje: HOJE,
    })
    expect(propostas).toHaveLength(3)
    expect(propostas[0].data_inicio).toBe('2027-01-01')
    expect(propostas[0].data_fim).toBe('2027-01-30')
    expect(propostas[1].data_inicio).toBe('2027-01-31')
    expect(propostas[1].data_fim).toBe('2027-03-01')
    expect(propostas[2].data_inicio).toBe('2027-03-02')
  })

  it('grupos diferentes (função diferente ou contrato diferente) podem se sobrepor', () => {
    const porteiroD1 = colab('c1', '2020-01-10', 'D1', 'fp')
    const asgD1 = colab('c2', '2020-01-10', 'D1', 'fa')
    const porteiroD2 = colab('c3', '2020-01-10', 'D2', 'fp')
    const { propostas } = gerarPlanoAutomatico({
      colaboradores: [porteiroD1, asgD1, porteiroD2],
      solicitacoes: [],
      regras: SEM_REGRAS,
      periodoInicio: INI,
      periodoFim: FIM,
      hoje: HOJE,
    })
    expect(propostas).toHaveLength(3)
    for (const p of propostas) expect(p.data_inicio).toBe('2027-01-01')
  })

  it('regra com max 2 simultâneos cria 2 cadeias paralelas no mesmo grupo', () => {
    const regras: FeriasRegra[] = [
      REGRA_GLOBAL,
      { id: 'r2', departamento_id: 'D1', funcao_id: 'fp', max_simultaneos: 2 },
    ]
    const colaboradores = [colab('c1', '2020-01-10'), colab('c2', '2020-02-10'), colab('c3', '2020-03-10')]
    const { propostas } = gerarPlanoAutomatico({
      colaboradores,
      solicitacoes: [],
      regras,
      periodoInicio: INI,
      periodoFim: FIM,
      hoje: HOJE,
    })
    expect(propostas).toHaveLength(3)
    expect(propostas[0].data_inicio).toBe('2027-01-01')
    expect(propostas[1].data_inicio).toBe('2027-01-01') // 2ª cadeia paralela
    expect(propostas[2].data_inicio).toBe('2027-01-31')
  })

  it('ignora quem tem limite depois do período e quem não tem admissão', () => {
    const novo = colab('c1', '2026-06-01') // limite só em 2028
    const semAdmissao = colab('c2', null)
    const { propostas, resumo } = gerarPlanoAutomatico({
      colaboradores: [novo, semAdmissao],
      solicitacoes: [],
      regras: SEM_REGRAS,
      periodoInicio: INI,
      periodoFim: FIM,
      hoje: HOJE,
    })
    expect(propostas).toHaveLength(0)
    expect(resumo.semNecessidade).toBe(1)
    expect(resumo.semAdmissao).toBe(1)
  })

  it('marca como não coube quando a fila do grupo estoura o período', () => {
    // 5 porteiros no mesmo grupo, período de 2 meses: cabem ~2, o resto não coube
    const colaboradores = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id, i) => colab(id, `2020-0${i + 1}-10`))
    const { propostas, naoCouberam } = gerarPlanoAutomatico({
      colaboradores,
      solicitacoes: [],
      regras: SEM_REGRAS,
      periodoInicio: '2027-01-01',
      periodoFim: '2027-02-28',
      hoje: HOJE,
    })
    expect(propostas).toHaveLength(2) // 01/01 e 31/01
    expect(naoCouberam).toHaveLength(3)
    expect(naoCouberam[0].motivo).toContain('não coube no período')
  })

  it('vaga com início dentro do período é proposta mesmo estourando o fim', () => {
    const colaboradores = [colab('c1', '2020-01-10'), colab('c2', '2020-02-10')]
    const { propostas, naoCouberam } = gerarPlanoAutomatico({
      colaboradores,
      solicitacoes: [],
      regras: SEM_REGRAS,
      periodoInicio: '2027-06-01',
      periodoFim: '2027-07-15',
      hoje: HOJE,
    })
    expect(propostas).toHaveLength(2)
    expect(propostas[0].data_inicio).toBe('2027-06-01')
    expect(propostas[0].data_fim).toBe('2027-06-30') // cabe certinho
    expect(propostas[1].data_inicio).toBe('2027-07-01')
    expect(propostas[1].data_fim).toBe('2027-07-30') // estoura o período, mas o início coube
    expect(naoCouberam).toHaveLength(0)
  })
})
