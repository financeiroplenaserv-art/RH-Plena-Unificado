import { describe, it, expect } from 'vitest'
import { calcularVR, gerarArquivoVRPAT } from './calculoVR'
import type { VRColaboradorPonto, VRColaboradorEscala, VRConfiguracao, VREscalaDia, VRResultadoCalculo } from '@/types'

const CONFIG: VRConfiguracao = {
  valorVR: 25.5,
  descontoPercentual: 0,
  dataCorte: '2026-06-30',
  dataEfetivacao: '2026-07-01',
  cnpjCliente: '12345678000195',
  produto: 'VR',
  empresaAlterdata: '00032',
  dadosEmpresa: {},
}

function criarRegistros(diasTrabalhados: number, diasFalta = 0, diasFolga = 0) {
  const registros = []
  for (let i = 0; i < diasTrabalhados; i++) {
    registros.push({ data: `0${i + 1}/06/26`, horasTrabalhadas: '08:00', tipo: 'trabalhado' as const })
  }
  for (let i = 0; i < diasFalta; i++) {
    registros.push({ data: `${i + 10}/06/26`, horasTrabalhadas: '00:00', tipo: 'falta' as const })
  }
  for (let i = 0; i < diasFolga; i++) {
    registros.push({ data: `${i + 20}/06/26`, horasTrabalhadas: '00:00', tipo: 'folga' as const })
  }
  return registros
}

function criarEscalaDias(quantidade: number): VREscalaDia[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    data: `${String(i + 1).padStart(2, '0')}/06/2026`,
    tipo: 'T' as const,
    minutosTrabalhados: 480,
  }))
}

describe('calcularVR', () => {
  it('calcula dias elegíveis = dias PDF + dias escala - abatimentos', () => {
    const pdfAtual = new Map<string, VRColaboradorPonto>([
      ['joao', {
        colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
        registros: criarRegistros(10),
      }],
    ])

    const escala: VRColaboradorEscala[] = [{
      colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar', matricula: '001' },
      dias: criarEscalaDias(5),
    }]

    const resultado = calcularVR(new Map(), pdfAtual, escala, CONFIG)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].diasPdf).toBe(10)
    expect(resultado[0].diasEscala).toBe(5)
    expect(resultado[0].diasAbatimento).toBe(0)
    expect(resultado[0].diasElegiveis).toBe(15)
    expect(resultado[0].valorBruto).toBe(15 * CONFIG.valorVR)
  })

  it('aplica abatimentos do mês anterior', () => {
    const pdfAnterior = new Map<string, VRColaboradorPonto>([
      ['joao', {
        colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
        registros: criarRegistros(20, 3),
      }],
    ])

    const pdfAtual = new Map<string, VRColaboradorPonto>([
      ['joao', {
        colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
        registros: criarRegistros(10),
      }],
    ])

    const escala: VRColaboradorEscala[] = [{
      colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
      dias: criarEscalaDias(5),
    }]

    const resultado = calcularVR(pdfAnterior, pdfAtual, escala, CONFIG)

    expect(resultado[0].diasAbatimento).toBe(3)
    expect(resultado[0].diasElegiveis).toBe(12) // 10 + 5 - 3
  })

  it('não permite dias elegíveis negativos', () => {
    const pdfAnterior = new Map<string, VRColaboradorPonto>([
      ['joao', {
        colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
        registros: criarRegistros(0, 10),
      }],
    ])

    const pdfAtual = new Map<string, VRColaboradorPonto>([
      ['joao', {
        colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
        registros: criarRegistros(2),
      }],
    ])

    const escala: VRColaboradorEscala[] = [{
      colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
      dias: criarEscalaDias(3),
    }]

    const resultado = calcularVR(pdfAnterior, pdfAtual, escala, CONFIG)

    expect(resultado[0].diasElegiveis).toBe(0)
  })

  it('encontra colaborador na escala mesmo com nome ligeiramente diferente', () => {
    const pdfAtual = new Map<string, VRColaboradorPonto>([
      ['joao silva', {
        colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
        registros: criarRegistros(8),
      }],
    ])

    const escala: VRColaboradorEscala[] = [{
      colaborador: { cpf: '12345678901', nome: 'JOAO SILVA SAURO', cargo: 'Auxiliar' },
      dias: criarEscalaDias(4),
    }]

    const resultado = calcularVR(new Map(), pdfAtual, escala, CONFIG)

    expect(resultado[0].diasPdf).toBe(8)
    expect(resultado[0].diasEscala).toBe(4)
  })

  it('processa colaborador apenas na escala (sem PDF atual)', () => {
    const escala: VRColaboradorEscala[] = [{
      colaborador: { cpf: '12345678901', nome: 'MARIA OLIVEIRA', cargo: 'Auxiliar' },
      dias: criarEscalaDias(6),
    }]

    const resultado = calcularVR(new Map(), new Map(), escala, CONFIG)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].nome).toBe('MARIA OLIVEIRA')
    expect(resultado[0].diasPdf).toBe(0)
    expect(resultado[0].diasEscala).toBe(6)
    expect(resultado[0].diasElegiveis).toBe(6)
  })

  it('prioriza match por CPF ao invés de nome parecido', () => {
    const pdfAtual = new Map<string, VRColaboradorPonto>([
      ['joao silva', {
        colaborador: { cpf: '98765432100', nome: 'JOAO SILVA', cargo: 'Auxiliar' },
        registros: criarRegistros(8),
      }],
    ])

    const escala: VRColaboradorEscala[] = [
      {
        colaborador: { cpf: '98765432100', nome: 'JOAO SILVA SAURO', cargo: 'Auxiliar', matricula: '002' },
        dias: criarEscalaDias(4),
      },
      {
        colaborador: { cpf: '12345678901', nome: 'JOAO SILVA', cargo: 'Auxiliar', matricula: '001' },
        dias: criarEscalaDias(2),
      },
    ]

    const resultado = calcularVR(new Map(), pdfAtual, escala, CONFIG)

    expect(resultado).toHaveLength(2)
    const principal = resultado.find(r => r.matricula === '002')
    expect(principal).toBeDefined()
    expect(principal?.matchTipo).toBe('cpf')
    expect(principal?.diasEscala).toBe(4)
  })

  it('registra match por similaridade quando nome tem pequena variação', () => {
    const pdfAtual = new Map<string, VRColaboradorPonto>([
      ['joao silva sauro', {
        colaborador: { cpf: '11122233344', nome: 'JOAO SILVA SAURO', cargo: 'Auxiliar' },
        registros: criarRegistros(8),
      }],
    ])

    const escala: VRColaboradorEscala[] = [{
      colaborador: { cpf: '55566677788', nome: 'JOAO SILVIO SAURO', cargo: 'Auxiliar', matricula: '001' },
      dias: criarEscalaDias(4),
    }]

    const resultado = calcularVR(new Map(), pdfAtual, escala, CONFIG)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].matchTipo).toBe('nome_similar')
  })
})

describe('gerarArquivoVRPAT', () => {
  it('pula colaboradores com CPF inválido', () => {
    const resultados: VRResultadoCalculo[] = [
      {
        cpf: '12345678900', // inválido
        nome: 'JOAO INVALIDO',
        matricula: '001',
        diasElegiveis: 10,
        diasPdf: 5,
        diasEscala: 5,
        diasAbatimento: 0,
        valorBruto: 255,
        detalhes: [],
      },
      {
        cpf: '52998224725', // válido
        nome: 'MARIA VALIDA',
        matricula: '002',
        diasElegiveis: 15,
        diasPdf: 10,
        diasEscala: 5,
        diasAbatimento: 0,
        valorBruto: 382.5,
        detalhes: [],
      },
    ]

    const conteudo = gerarArquivoVRPAT(resultados, CONFIG)
    const linhasTipo30 = conteudo.split('\n').filter(l => l.startsWith('30'))

    expect(linhasTipo30).toHaveLength(1)
    expect(linhasTipo30[0]).toContain('MARIA VALIDA')
  })
})
