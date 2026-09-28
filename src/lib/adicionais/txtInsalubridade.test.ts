import { describe, it, expect } from 'vitest'
import {
  calcularValorInsalubridadeCentavos,
  gerarTxtInsalubridade,
  type LinhaInsalubridade,
  type ConfigTxtInsalubridade,
} from './txtInsalubridade'

const CONFIG: ConfigTxtInsalubridade = {
  salarioBase: 2000,
  codigoEvento: '012',
  ano: 2026,
  mes: 9,
}

function linha(parcial: Partial<LinhaInsalubridade>): LinhaInsalubridade {
  return {
    colaborador_nome: 'Fulano',
    matricula: '000016',
    empresaCodigo: '00032',
    dias: 30,
    ...parcial,
  }
}

describe('calcularValorInsalubridadeCentavos', () => {
  it('30 dias = 20% integral do salário', () => {
    expect(calcularValorInsalubridadeCentavos(2000, 30)).toBe(40000) // R$ 400,00
  })

  it('15 dias = metade', () => {
    expect(calcularValorInsalubridadeCentavos(2000, 15)).toBe(20000) // R$ 200,00
  })

  it('arredonda para centavos', () => {
    // 2000 * 0.2 * 7 / 30 = 93,333... -> R$ 93,33
    expect(calcularValorInsalubridadeCentavos(2000, 7)).toBe(9333)
  })

  it('0 dias = 0', () => {
    expect(calcularValorInsalubridadeCentavos(2000, 0)).toBe(0)
  })
})

describe('gerarTxtInsalubridade', () => {
  it('monta linha de exatamente 61 posições com os campos nas posições certas', () => {
    const { conteudo, gerados, pulados } = gerarTxtInsalubridade([linha({})], CONFIG)
    expect(gerados).toBe(1)
    expect(pulados).toHaveLength(0)
    const l = conteudo
    expect(l).toHaveLength(61)
    expect(l.slice(0, 6)).toBe('000001')  // sequencial
    expect(l.slice(6, 11)).toBe('00032')  // empresa
    expect(l.slice(11, 17)).toBe('010926') // ref1 = 01/09/26
    expect(l.slice(17, 23)).toBe('300926') // ref2 = 30/09/26
    expect(l.slice(23, 37)).toBe('000000' + '000000' + '00')
    expect(l.slice(37, 40)).toBe('012')   // código do evento
    expect(l.slice(40, 54)).toBe('00000000040000') // R$ 400,00 em centavos
    expect(l.slice(54, 60)).toBe('000016') // matrícula
    expect(l[60]).toBe('F')
  })

  it('fevereiro usa o último dia correto como ref2', () => {
    const { conteudo } = gerarTxtInsalubridade([linha({})], { ...CONFIG, ano: 2026, mes: 2 })
    expect(conteudo.slice(11, 17)).toBe('010226')
    expect(conteudo.slice(17, 23)).toBe('280226') // 2026 não é bissexto
  })

  it('junta múltiplas linhas com CRLF e sequencial crescente', () => {
    const { conteudo, gerados } = gerarTxtInsalubridade(
      [linha({}), linha({ matricula: '17', dias: 15 })],
      CONFIG
    )
    expect(gerados).toBe(2)
    const linhas = conteudo.split('\r\n')
    expect(linhas).toHaveLength(2)
    expect(linhas[0].slice(0, 6)).toBe('000001')
    expect(linhas[1].slice(0, 6)).toBe('000002')
    expect(linhas[1].slice(54, 60)).toBe('000017') // matrícula curta recebe pad
    expect(linhas[1].slice(40, 54)).toBe('00000000020000')
  })

  it('pula sem matrícula, matrícula longa, sem empresa e dias zerados, com motivo', () => {
    const { gerados, pulados } = gerarTxtInsalubridade(
      [
        linha({ colaborador_nome: 'Sem Matricula', matricula: null }),
        linha({ colaborador_nome: 'Matricula Longa', matricula: '1234567' }),
        linha({ colaborador_nome: 'Sem Empresa', empresaCodigo: null }),
        linha({ colaborador_nome: 'Sem Dias', dias: 0 }),
        linha({ colaborador_nome: 'Ok' }),
      ],
      CONFIG
    )
    expect(gerados).toBe(1)
    expect(pulados.map(p => p.nome)).toEqual(['Sem Matricula', 'Matricula Longa', 'Sem Empresa', 'Sem Dias'])
    expect(pulados.every(p => p.motivo.length > 0)).toBe(true)
  })

  it('normaliza código do evento digitado com texto', () => {
    const { conteudo } = gerarTxtInsalubridade([linha({})], { ...CONFIG, codigoEvento: '12' })
    expect(conteudo.slice(37, 40)).toBe('012')
  })
})
