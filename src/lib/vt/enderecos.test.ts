import { describe, expect, it } from 'vitest'
import {
  linkGoogleMapsTransito,
  normalizarEnderecoCasa,
  precisaoDoEndereco,
  textoOrigemCasa,
} from '@/lib/vt/enderecos'

// Casos reais da POC (scripts/poc-vt-normalizar-enderecos.mjs, 21/10/2026).
describe('normalizarEnderecoCasa', () => {
  it('rua dupla grudada fica só a primeira; "0" vira sem número; bairro é a última parte limpa', () => {
    expect(normalizarEnderecoCasa('RUA JARDIM FIGUEIRA RUA B , 0, LT 59, CARAMUJO')).toEqual({
      rua: 'RUA JARDIM FIGUEIRA',
      numero: '',
      bairro: 'CARAMUJO',
    })
  })

  it('complemento "53 FUNDOS" é descartado e o bairro vem do fim', () => {
    expect(normalizarEnderecoCasa('RUA AGOSTINHO CARDOSO DE ARAUJO, 0, 53 FUNDOS, PORTO VELHO')).toEqual({
      rua: 'RUA AGOSTINHO CARDOSO DE ARAUJO',
      numero: '',
      bairro: 'PORTO VELHO',
    })
  })

  it('"CS 3" é lixo; número válido permanece', () => {
    expect(normalizarEnderecoCasa('RUA ERNESTO FRANCA , 303, CS 3, MUTUA')).toEqual({
      rua: 'RUA ERNESTO FRANCA',
      numero: '303',
      bairro: 'MUTUA',
    })
  })

  it('endereço simples sem complemento', () => {
    expect(normalizarEnderecoCasa('TRAVESSA SANTO EXPEDITO, 43, BARRETO')).toEqual({
      rua: 'TRAVESSA SANTO EXPEDITO',
      numero: '43',
      bairro: 'BARRETO',
    })
  })

  it('"RUA W 18" não é rua dupla (o 18 não é prefixo de logradouro)', () => {
    expect(normalizarEnderecoCasa('RUA W 18, 255, LAGOMAR')).toEqual({
      rua: 'RUA W 18',
      numero: '255',
      bairro: 'LAGOMAR',
    })
  })

  it('S/N vira sem número', () => {
    expect(normalizarEnderecoCasa('RUA X, S/N, CENTRO')?.numero).toBe('')
    expect(normalizarEnderecoCasa('RUA X, s/n, CENTRO')?.numero).toBe('')
  })

  it('null e vazio retornam null', () => {
    expect(normalizarEnderecoCasa(null)).toBeNull()
    expect(normalizarEnderecoCasa('')).toBeNull()
    expect(normalizarEnderecoCasa(' , , ')).toBeNull()
  })

  it('bairro puramente numérico não vale; pega a parte anterior limpa', () => {
    expect(normalizarEnderecoCasa('RUA Y, 10, 45, INGA')?.bairro).toBe('INGA')
  })
})

describe('precisaoDoEndereco', () => {
  it('exato só com rua + número válido', () => {
    expect(precisaoDoEndereco('RUA ERNESTO FRANCA , 303, CS 3, MUTUA')).toBe('exato')
    expect(precisaoDoEndereco('TRAVESSA SANTO EXPEDITO, 43, BARRETO')).toBe('exato')
    expect(precisaoDoEndereco('RUA W 18, 255, LAGOMAR')).toBe('exato')
  })

  it('sem número válido (0/S/N) cai para bairro', () => {
    expect(precisaoDoEndereco('RUA JARDIM FIGUEIRA RUA B , 0, LT 59, CARAMUJO')).toBe('bairro')
    expect(precisaoDoEndereco('RUA AGOSTINHO CARDOSO DE ARAUJO, 0, 53 FUNDOS, PORTO VELHO')).toBe('bairro')
    expect(precisaoDoEndereco('RUA X, S/N, CENTRO')).toBe('bairro')
  })

  it('endereço nulo cai para bairro', () => {
    expect(precisaoDoEndereco(null)).toBe('bairro')
  })
})

describe('textoOrigemCasa', () => {
  it('exato: rua, número, bairro, cidade', () => {
    expect(textoOrigemCasa('RUA ERNESTO FRANCA , 303, CS 3, MUTUA', 'Niterói')).toBe(
      'RUA ERNESTO FRANCA, 303, MUTUA, Niterói',
    )
  })

  it('sem número: rua, bairro, cidade', () => {
    expect(textoOrigemCasa('RUA JARDIM FIGUEIRA RUA B , 0, LT 59, CARAMUJO', 'Niterói')).toBe(
      'RUA JARDIM FIGUEIRA, CARAMUJO, Niterói',
    )
  })

  it('sem endereço: só a cidade', () => {
    expect(textoOrigemCasa(null, 'Niterói')).toBe('Niterói')
    expect(textoOrigemCasa(null, null)).toBe('')
  })
})

describe('linkGoogleMapsTransito', () => {
  it('monta o link de rotas em modo transporte público', () => {
    const link = linkGoogleMapsTransito('CARAMUJO, Niterói', 'RUA X, 1, CENTRO, Niterói')
    expect(link).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=CARAMUJO%2C%20Niter%C3%B3i' +
        '&destination=RUA%20X%2C%201%2C%20CENTRO%2C%20Niter%C3%B3i&travelmode=transit',
    )
  })
})
