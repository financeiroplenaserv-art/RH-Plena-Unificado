import { describe, expect, it } from 'vitest'
import { gerarReciboEPIColorido, gerarReciboUniformeColorido, type ReciboData } from './ceuRecibos'

function dadosBase(cpf: string): ReciboData {
  return {
    colaborador: {
      nome: 'Fulano de Tal',
      matricula: '12345',
      funcao: 'Vigilante',
      departamento: 'Posto Central',
      cpf,
      data_admissao: '2024-01-15',
    },
    entregas: [
      {
        item: { descricao: 'Capacete de segurança', numero_ca: '12345', grupo_macro: 'EPI', subgrupo: 'Proteção' },
        quantidade: 1,
        situacao: 'Troca',
      },
    ],
    dataEntrega: '2026-08-01',
    numeroRecibo: 'REC-2026-0001',
    nomeEmpresa: 'Plena EA',
    cnpjEmpresa: '12.345.678/0001-90',
  }
}

describe('recibos CEU — CPF sempre no formato 000.000.000-00', () => {
  it('completa com zero à esquerda CPF gravado com 10 dígitos', () => {
    const html = gerarReciboEPIColorido(dadosBase('2053983752'))
    expect(html).toContain('020.539.837-52')
    expect(html).not.toContain('2053983752')
  })

  it('mantém a máscara para CPF de 11 dígitos', () => {
    const html = gerarReciboUniformeColorido(dadosBase('51563851768'))
    expect(html).toContain('515.638.517-68')
    expect(html).not.toContain('51563851768')
  })

  it('normaliza CPF que já vem com máscara', () => {
    const html = gerarReciboEPIColorido(dadosBase('515.638.517-68'))
    expect(html).toContain('515.638.517-68')
    expect(html).not.toContain('51563851768')
  })

  it('usa placeholder quando não há CPF', () => {
    const html = gerarReciboEPIColorido(dadosBase(''))
    expect(html).toContain('CPF: —')
  })
})
