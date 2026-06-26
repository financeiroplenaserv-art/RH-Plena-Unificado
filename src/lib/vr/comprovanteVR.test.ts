import { describe, it, expect } from 'vitest'
import { gerarRecibosLoteHTML } from './comprovanteVR'
import type { VRResultadoCalculo, VRConfiguracao } from '@/types'

const configBase: VRConfiguracao = {
  valorVR: 30,
  descontoPercentual: 0,
  dataCorte: '2026-06-20',
  dataEfetivacao: '2026-06-25',
  cnpjCliente: '00.000.000/0000-00',
  produto: 'VR',
  empresaAlterdata: '00032',
  dadosEmpresa: {
    razaoSocial: 'Plena EA',
  },
}

function criarResultado(parcial: Partial<VRResultadoCalculo>): VRResultadoCalculo {
  const diasElegiveis = parcial.diasElegiveis ?? 10
  const extra = parcial.extra ?? 0
  return {
    cpf: '00000000000',
    nome: 'Colaborador Teste',
    matricula: '001234',
    diasElegiveis,
    diasPdf: diasElegiveis,
    diasEscala: diasElegiveis,
    diasAbatimento: 0,
    valorBruto: diasElegiveis * configBase.valorVR + extra,
    extra,
    matchTipo: 'cpf',
    detalhes: [],
    ...parcial,
  }
}

describe('gerarRecibosLoteHTML', () => {
  it('não deve somar o extra duas vezes no total geral da capa', () => {
    const resultados = [
      criarResultado({ nome: 'Acácio', diasElegiveis: 10, extra: 50 }),
      criarResultado({ nome: 'Maria', diasElegiveis: 5, extra: 0 }),
    ]

    const html = gerarRecibosLoteHTML(resultados, configBase)

    // Total correto: Acácio (10*30 + 50 = 350) + Maria (5*30 = 150) = 500
    expect(html).toContain('R$ 500.00')
    expect(html).not.toContain('R$ 550.00')
  })

  it('deve manter o total individual correto quando há extra', () => {
    const resultados = [criarResultado({ nome: 'Acácio', diasElegiveis: 10, extra: 50 })]

    const html = gerarRecibosLoteHTML(resultados, configBase)

    expect(html).toContain('R$ 350.00')
  })
})
