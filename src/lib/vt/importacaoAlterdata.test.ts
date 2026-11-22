import { describe, expect, it } from 'vitest'
import type { PaginaPDF } from '@/lib/ocorrencias/importacaoPonto'
import {
  calcularPreviaOptantes,
  cpf11,
  extrairRelatorioAlterdata,
  matriculaNormalizada,
  type ColaboradorOptante,
} from '@/lib/vt/importacaoAlterdata'

const it_ = (x: number, y: number, texto: string) => ({ x, y, texto })

// Dados fictícios.
function paginaTabela(): PaginaPDF {
  const cab = [it_(500, 764, 'CPF'), it_(363, 764, 'NOME'), it_(305, 764, 'MATRICULA'), it_(150, 764, 'RAZAO SOCIAL'), it_(941, 764, 'QTDE. USO')]
  const linha = (y: number, cpf: string, nome: string, mat: string, razao: string) => [
    it_(500, y, cpf),
    it_(363, y, nome),
    it_(305, y + 1, mat),
    it_(150, y, razao),
    it_(26, y, '00.378.476/0001-60'),
  ]
  return {
    numero: 1,
    itens: [...cab, ...linha(742, '1234567890', 'ANA TESTE', '000001', 'PLENA EA FACILITIES SERVICOS LTDA'), ...linha(730, '98765432100', 'BRUNO TESTE', '000002', 'PLENA TECH SERVICOS LTDA')],
  }
}

function paginaDeclaracao(nome: string, cpf: string, mat: string): PaginaPDF {
  return {
    numero: 1,
    itens: [
      it_(237, 734, 'Declaração de Não Beneficiário'),
      it_(38, 712, 'Empresa: PLENA EA FACILITIES SERVICOS LTDA'),
      it_(38, 656, `Funcionário: ${nome}`),
      it_(196, 607, `C.P.F: ${cpf}`),
      it_(376, 656, '('),
      it_(381, 656, mat),
      it_(410, 656, ')'),
    ],
  }
}

const colab = (id: string, nome: string, cpf: string | null, mat: string | null, optante: boolean | null, status = 'Ativo'): ColaboradorOptante => ({
  id,
  nome_completo: nome,
  cpf,
  matricula: mat,
  status,
  vt_optante: optante,
})

describe('extrairRelatorioAlterdata', () => {
  it('lê a tabela "desconta VT" com CPF sem zero à esquerda', () => {
    const r = extrairRelatorioAlterdata([paginaTabela()])
    expect(r.tipo).toBe('desconta')
    expect(r.registros).toEqual([
      { empresa: 'EA', matricula: '000001', nome: 'ANA TESTE', cpf: '01234567890' },
      { empresa: 'TECH', matricula: '000002', nome: 'BRUNO TESTE', cpf: '98765432100' },
    ])
  })

  it('lê uma declaração por página', () => {
    const r = extrairRelatorioAlterdata([paginaDeclaracao('CARLA TESTE', '11122233344', '000749'), paginaDeclaracao('DAVI TESTE', '55566677788', '000750')])
    expect(r.tipo).toBe('nao_beneficiario')
    expect(r.registros.map((x) => [x.nome, x.cpf, x.matricula, x.empresa])).toEqual([
      ['CARLA TESTE', '11122233344', '000749', 'EA'],
      ['DAVI TESTE', '55566677788', '000750', 'EA'],
    ])
  })

  it('não reconhece PDF de outro tipo', () => {
    expect(extrairRelatorioAlterdata([{ numero: 1, itens: [it_(1, 1, 'qualquer coisa')] }]).tipo).toBeNull()
  })
})

describe('normalização', () => {
  it('cpf11 completa zeros e recusa inválidos', () => {
    expect(cpf11('1234567890')).toBe('01234567890')
    expect(cpf11('123.456.789-09')).toBe('12345678909')
    expect(cpf11('')).toBeNull()
    expect(cpf11('000')).toBeNull()
    expect(cpf11('123456789012')).toBeNull()
  })
  it('matriculaNormalizada ignora zeros e pontuação', () => {
    expect(matriculaNormalizada('000743')).toBe('743')
    expect(matriculaNormalizada('01027q')).toBe('1027Q')
    expect(matriculaNormalizada('')).toBeNull()
  })
})

describe('calcularPreviaOptantes', () => {
  const reg = (nome: string, cpf: string | null, matricula: string | null = null) => ({ empresa: 'EA', matricula, nome, cpf })

  it('classifica mudanças, sem mudança, conflito, não encontrados e fora dos relatórios', () => {
    const cs = [
      colab('1', 'Ana', '1234567890', '1', false), // CPF sem zero no CORH
      colab('2', 'Bruno', '98765432100', '2', true), // já optante
      colab('3', 'Carla', '11122233344', '3', true), // vai deixar
      colab('4', 'Davi', '55566677788', '4', false), // já não optante
      colab('5', 'Eva', '12312312312', '5', true), // nos dois
      colab('6', 'Fábio', '45645645645', '6', true), // fora
    ]
    const desconta = [reg('Ana', '01234567890'), reg('Bruno', '98765432100'), reg('Eva', '12312312312'), reg('Zé', '99999999999')]
    const nao = [reg('Carla', '11122233344'), reg('Davi', '55566677788'), reg('Eva', '12312312312'), reg('Sumido', '88888888888')]
    const p = calcularPreviaOptantes(desconta, nao, cs)
    expect(p.virarOptante.map((m) => m.colaborador.id)).toEqual(['1'])
    expect(p.deixarDeSerOptante.map((m) => m.colaborador.id)).toEqual(['3'])
    expect(p.semMudanca.map((m) => m.colaborador.id).sort()).toEqual(['2', '4'])
    expect(p.conflitos.map((c) => c.colaborador.id)).toEqual(['5'])
    expect(p.naoEncontradosDesconta.map((s) => s.registro.nome)).toEqual(['Zé'])
    expect(p.naoEncontradosNaoBeneficiario.map((s) => s.registro.nome)).toEqual(['Sumido'])
    expect(p.foraDosRelatorios.map((c) => c.id)).toEqual(['6'])
  })

  it('sem CPF no relatório casa só por matrícula exata; nunca por nome', () => {
    const cs = [colab('1', 'Ana Silva', null, '000743', false), colab('2', 'Ana Silva', null, '9', false)]
    const p = calcularPreviaOptantes([reg('Ana Silva', null, '743'), reg('Ana Silva', null, null)], [], cs)
    expect(p.virarOptante.map((m) => m.colaborador.id)).toEqual(['1'])
    expect(p.virarOptante[0].casadoPor).toBe('matricula')
    expect(p.naoEncontradosDesconta[0].motivo).toMatch(/Sem CPF nem matrícula/)
  })

  it('CPF repetido no CORH não é escolhido por palpite', () => {
    const cs = [colab('1', 'Ana', '11122233344', '1', false), colab('2', 'Ana Dup', '11122233344', '2', false)]
    const p = calcularPreviaOptantes([reg('Ana', '11122233344')], [], cs)
    expect(p.virarOptante).toHaveLength(0)
    expect(p.naoEncontradosDesconta[0].motivo).toMatch(/repetido/)
  })

  it('optante nulo vira "deixar de ser" ao constar como não beneficiário', () => {
    const p = calcularPreviaOptantes([], [reg('Ana', '11122233344')], [colab('1', 'Ana', '11122233344', '1', null)])
    expect(p.deixarDeSerOptante).toHaveLength(1)
  })
})
