import { describe, expect, it } from 'vitest'
import { horaMinutoValida, mascararHoraMinuto } from './partidaRota'
import { encontrarAlternativaInversa } from './rotaInversa'

describe('mascararHoraMinuto', () => {
  it('insere os dois-pontos ao digitar só números', () => {
    expect(mascararHoraMinuto('1000')).toBe('10:00')
    expect(mascararHoraMinuto('6')).toBe('6')
    expect(mascararHoraMinuto('061')).toBe('06:1')
    expect(mascararHoraMinuto('0600')).toBe('06:00')
  })
  it('limita a 5 caracteres e ignora letras', () => {
    expect(mascararHoraMinuto('10:0099')).toBe('10:00')
    expect(mascararHoraMinuto('ab12cd')).toBe('12')
  })
  it('apagar o último dígito depois dos dois-pontos remove também o separador', () => {
    expect(mascararHoraMinuto('10:')).toBe('10')
  })
})

describe('horaMinutoValida', () => {
  it('aceita 00:00 a 23:59 e recusa o resto', () => {
    expect(horaMinutoValida('00:00')).toBe(true)
    expect(horaMinutoValida('23:59')).toBe(true)
    expect(horaMinutoValida('24:00')).toBe(false)
    expect(horaMinutoValida('12:60')).toBe(false)
    expect(horaMinutoValida('10:0')).toBe(false)
    expect(horaMinutoValida('')).toBe(false)
  })
})

describe('encontrarAlternativaInversa', () => {
  const alt = (id: string, linhas: Array<string | null>) => ({
    alternativa: { id, itinerario: { pernas: linhas.map((linha) => ({ linha })) } },
  })
  it('acha a volta com as mesmas linhas em ordem inversa', () => {
    const ida = alt('i', ['62', '39A']).alternativa
    const volta = [alt('v1', ['62', '39A']), alt('v2', ['39A', '62'])]
    expect(encontrarAlternativaInversa(ida, volta)?.alternativa.id).toBe('v2')
  })
  it('devolve null sem correspondência ou com linha não identificada', () => {
    expect(encontrarAlternativaInversa(alt('i', ['62']).alternativa, [alt('v', ['39A'])])).toBeNull()
    expect(encontrarAlternativaInversa(alt('i', ['62', null]).alternativa, [alt('v', [null, '62'])])).toBeNull()
  })
})
