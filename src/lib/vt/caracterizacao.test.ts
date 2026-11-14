import { describe, expect, it } from 'vitest'
import { aplicarCoberturas, agruparDiasPorPosto, calcularCargaMes } from '@/lib/vt/carga'
import { conciliarCarga } from '@/lib/vt/fechamento'
import { casarColaboradores } from '@/lib/vt/gestaoEscalasFlit'
import { escolherConjuntoDoPeriodo, ordenarParaMescla } from '@/lib/vt/escolherEspelho'
import { montarRascunhoCarga, validarRascunhoCarga } from '@/lib/vt/cargaRascunho'
import type { VtBilhete, VtTrajeto } from '@/types/vt'

const BUN: VtBilhete = {
  id: 'bun-1',
  nome: 'BU NITERÓI',
  valor_diario_centavos: 1120,
  vigente_desde: '2026-10-21',
  ativo: true,
  cartao_necessario: 'bun',
  usa_integracao: true,
}

const TRAJETO: VtTrajeto = {
  id: 'trajeto-1',
  colaborador_id: 'pessoa-1',
  departamento_id: 'posto-coberto',
  bilhete_id: BUN.id,
  bilhete_2_id: null,
  escopo: 'niteroi_municipal',
  precisao_origem: 'bairro',
  origem: 'manual',
  status: 'confirmado',
  valor_extra_centavos: 0,
  observacao: null,
  confirmado_por: 'operador-1',
  confirmado_em: '2026-10-21T10:00:00Z',
}

describe('caracterização das regras saudáveis que a migração deve preservar', () => {
  it('cobertura substitui o posto sem duplicar o dia; posto sem trajeto confirmado não soma', () => {
    const linhas = aplicarCoberturas(
      [{ colaborador_id: 'pessoa-1', data: '2026-11-10', local_nome: 'BASE', local_nome_curto: 'BASE' }],
      [{
        id: 'cobertura-1',
        colaborador_id: 'pessoa-1',
        departamento_id: 'posto-coberto',
        data_inicio: '2026-11-10',
        data_fim: '2026-11-10',
        observacao: null,
        registrado_por: null,
        created_at: '2026-11-01T10:00:00Z',
      }],
      () => 'POSTO COBERTO',
    )
    const { porColaborador } = agruparDiasPorPosto(linhas, () => null)
    const dias = [...(porColaborador.get('pessoa-1')?.entries() ?? [])].map(([departamento_id, valor]) => ({
      departamento_id,
      rotulo: valor.rotulo,
      dias: valor.dias,
      datas: valor.datas,
    }))
    const resultado = calcularCargaMes(dias, [TRAJETO], [BUN], '2026-11-01')

    expect(linhas).toHaveLength(1)
    expect(resultado.necessidade_centavos).toBe(1120)
    expect(resultado.pendentes).toEqual([])
    expect(resultado.detalhe[0].datas).toEqual(['2026-11-10'])
  })

  it('ausência de linha no ponto não gera desconto; falta comprovada gera', () => {
    const detalhe = [{
      departamento_id: 'posto-1',
      posto: 'POSTO',
      dias: 2,
      custo_dia_centavos: 1120,
      subtotal_centavos: 2240,
      datas: ['2026-11-03', '2026-11-04'],
    }]
    const resultado = conciliarCarga(detalhe, new Map([
      ['2026-11-03', { classificacao: 'falta', categoria: 'Falta' }],
    ]))

    expect(resultado.descontoCentavos).toBe(1120)
    expect(resultado.diasDescontados).toBe(1)
    expect(resultado.diasNaoConferidos).toBe(1)
  })

  it('trabalho fora da carga sem posto de referência vira pendência, nunca crédito por palpite', () => {
    const resultado = conciliarCarga([], new Map([
      ['2026-11-10', { classificacao: 'trabalhado', categoria: null }],
    ]))

    expect(resultado.creditoCentavos).toBe(0)
    expect(resultado.diasCreditados).toBe(0)
    expect(resultado.diasForaSemPosto).toEqual(['2026-11-10'])
  })

  it('somente casamento exato único resolve pessoa; homônimo ativo fica pendente', () => {
    const colaboradores = [
      { id: '1', nome_completo: 'JOÃO  DA SILVA', status: 'Ativo' },
      { id: '2', nome_completo: 'Ana Maria', status: 'Ativo' },
      { id: '3', nome_completo: 'ANA MARIA', status: 'Ativo' },
      { id: '4', nome_completo: 'João da Silva', status: 'Inativo' },
    ]
    const casamentos = casarColaboradores(['João da Silva', 'Ana Maria', 'Ausente'], colaboradores)

    expect(casamentos.get('João da Silva')).toEqual({ id: '1' })
    expect(casamentos.get('Ana Maria')).toEqual({ id: null })
    expect(casamentos.get('Ausente')).toEqual({ id: null })
  })

  it('conjunto de espelhos cobre o período e a mescla deixa o mais recente por último', () => {
    const arquivos = [
      { id: 'p2', periodo_inicio: '2026-10-07', periodo_fim: '2026-10-13', ponto_ate: '2026-10-13', created_at: '2026-10-14T10:00:00Z' },
      { id: 'p1', periodo_inicio: '2026-09-20', periodo_fim: '2026-10-07', ponto_ate: '2026-10-07', created_at: '2026-10-08T10:00:00Z' },
      { id: 'p3', periodo_inicio: '2026-10-12', periodo_fim: '2026-10-19', ponto_ate: '2026-10-19', created_at: '2026-10-20T10:00:00Z' },
    ]
    const escolhidos = escolherConjuntoDoPeriodo(arquivos, '2026-09-20', '2026-10-19')

    expect(escolhidos).toHaveLength(3)
    expect(ordenarParaMescla(escolhidos).map((arquivo) => arquivo.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('rascunho íntegro faz ida e volta; formato desconhecido é rejeitado', () => {
    const rascunho = montarRascunhoCarga([{
      nome: 'PESSOA',
      departamentoTexto: 'POSTO',
      cargo: 'Vigia',
      horario: '',
      dias: [{ data: '2026-11-03', marca: 'trabalha', texto: '[T]' }],
    }], 'escalas.xlsx', '2026-11', '2026-11-01T10:00:00Z')

    expect(validarRascunhoCarga(JSON.parse(JSON.stringify(rascunho)))).toEqual(rascunho)
    expect(validarRascunhoCarga({ ...rascunho, versao: 999 })).toBeNull()
  })
})
