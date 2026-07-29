import { describe, it, expect } from 'vitest'
import { chaveCpf, montarMapaNomesPorCpf, nomeExibicaoVR } from './nomePorCpf'

describe('chaveCpf', () => {
  it('mantém CPF de 11 dígitos', () => {
    expect(chaveCpf('06028056782')).toBe('06028056782')
  })

  it('completa com zero à esquerda o CPF do cadastro (10 dígitos)', () => {
    expect(chaveCpf('6028056782')).toBe('06028056782')
  })

  it('remove pontuação antes de normalizar', () => {
    expect(chaveCpf('060.280.567-82')).toBe('06028056782')
  })

  it('rejeita valores sem tamanho de CPF', () => {
    expect(chaveCpf('123')).toBeNull()
    expect(chaveCpf('')).toBeNull()
    expect(chaveCpf(null)).toBeNull()
    expect(chaveCpf('123456789012')).toBeNull()
  })
})

describe('montarMapaNomesPorCpf', () => {
  it('indexa pelo CPF normalizado e ignora registros sem CPF válido', () => {
    const mapa = montarMapaNomesPorCpf([
      { cpf: '6028056782', nome_completo: 'MARCO ANTONIO FARIA PEDROSA' },
      { cpf: '3880048789', nome_completo: 'MARCO ANTONIO DO VALLE TALAVEIRA' },
      { cpf: '', nome_completo: 'SEM CPF' },
    ])
    expect(mapa.get('06028056782')).toBe('MARCO ANTONIO FARIA PEDROSA')
    expect(mapa.get('03880048789')).toBe('MARCO ANTONIO DO VALLE TALAVEIRA')
    expect(mapa.size).toBe(2)
  })
})

describe('nomeExibicaoVR', () => {
  const cadastro = montarMapaNomesPorCpf([
    { cpf: '6028056782', nome_completo: 'MARCO ANTONIO FARIA PEDROSA' },
    { cpf: '3880048789', nome_completo: 'MARCO ANTONIO DO VALLE TALAVEIRA' },
  ])

  it('corrige o nome trocado do espelho Flit pelo CPF (caso dos homônimos)', () => {
    // O ponto do Flit trouxe o CPF do Talaveira com o nome do Pedrosa.
    expect(nomeExibicaoVR('MARCO ANTONIO FARIA PEDROSA', '03880048789', cadastro))
      .toBe('MARCO ANTONIO DO VALLE TALAVEIRA')
    // E o CPF do Pedrosa continua com o nome dele.
    expect(nomeExibicaoVR('MARCO ANTONIO FARIA PEDROSA', '06028056782', cadastro))
      .toBe('MARCO ANTONIO FARIA PEDROSA')
  })

  it('mantém o nome original quando o CPF não consta no cadastro', () => {
    expect(nomeExibicaoVR('FULANO DESCONHECIDO', '99988877766', cadastro)).toBe('FULANO DESCONHECIDO')
  })

  it('mantém o nome original quando não há mapa (cadastro não carregado)', () => {
    expect(nomeExibicaoVR('MARCO ANTONIO FARIA PEDROSA', '03880048789')).toBe('MARCO ANTONIO FARIA PEDROSA')
    expect(nomeExibicaoVR('MARCO ANTONIO FARIA PEDROSA', '03880048789', undefined)).toBe('MARCO ANTONIO FARIA PEDROSA')
  })

  it('mantém o nome original quando o CPF é inválido/vazio', () => {
    expect(nomeExibicaoVR('NOME QUALQUER', '', cadastro)).toBe('NOME QUALQUER')
  })
})
