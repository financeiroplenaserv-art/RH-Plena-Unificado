import { describe, expect, it } from 'vitest'
import { BILHETE, classificarRota, type PernaRota } from './classificarRota'

// Motor de classificação de bilhete pela ROTA REAL (28/10/2026). Os casos
// usam as pessoas reais que motivaram a mudança: Joyce, Adalto, Thiago,
// José Orlando (BU suspenso) e Marco Antônio.

const nit = (municipio = 'Niterói'): PernaRota => ({ modal: 'onibus', municipio, intermunicipal: false })
const inter = (municipio: string): PernaRota => ({ modal: 'onibus', municipio, intermunicipal: true })

describe('classificarRota', () => {
  it('sem pernas: sem bilhete, confiança baixa', () => {
    const r = classificarRota([], { buAtivado: true })
    expect(r.bilhetes).toEqual([])
    expect(r.confianca).toBe('baixa')
  })

  it('caso Marco Antônio: 1 ônibus municipal em Niterói → BU Niterói, alta', () => {
    const r = classificarRota([nit()], { buAtivado: true })
    expect(r.bilhetes).toEqual([BILHETE.buNiteroi])
    expect(r.confianca).toBe('alta')
    expect(r.avisos).toEqual([])
  })

  it('2 ônibus em Niterói: integração de 1h cobre → BU Niterói sem aviso', () => {
    const r = classificarRota([nit(), nit()], { buAtivado: true })
    expect(r.bilhetes).toEqual([BILHETE.buNiteroi])
    expect(r.avisos).toEqual([])
  })

  it('3 ônibus em Niterói: BU Niterói com aviso de excedente (integração cobre 2)', () => {
    const r = classificarRota([nit(), nit(), nit()], { buAtivado: true })
    expect(r.bilhetes).toEqual([BILHETE.buNiteroi])
    expect(r.confianca).toBe('media')
    expect(r.avisos.join(' ')).toContain('2 conduções em 1h')
  })

  it('caso Adalto: intermunicipal Maricá → Niterói com BU ativado → BUI, alta', () => {
    const r = classificarRota([inter('Maricá')], { buAtivado: true })
    expect(r.bilhetes).toEqual([BILHETE.bui])
    expect(r.confianca).toBe('alta')
  })

  it('caso Thiago: linha direta São Gonçalo → Niterói → Passagem SG (mais barata), com aviso da 2ª condução', () => {
    const r = classificarRota([inter('São Gonçalo')], { buAtivado: true })
    expect(r.bilhetes).toEqual([BILHETE.passagemSg])
    expect(r.confianca).toBe('alta')
    expect(r.avisos.join(' ')).toContain('2ª condução')
  })

  it('SG → Niterói com conexão (municipal SG + intermunicipal) → BUI, não Passagem SG', () => {
    const r = classificarRota(
      [{ modal: 'onibus', municipio: 'São Gonçalo', intermunicipal: false }, inter('São Gonçalo')],
      { buAtivado: true }
    )
    expect(r.bilhetes).toEqual([BILHETE.bui])
  })

  it('caso José Orlando: intermunicipal com BU SUSPENSO → Sem integração BU, com aviso de reativação', () => {
    const r = classificarRota([inter('São Gonçalo'), nit()], {
      buAtivado: false,
      buSituacao: 'Suspenso Setrans',
    })
    expect(r.bilhetes).toEqual([BILHETE.semIntegracao])
    expect(r.confianca).toBe('media')
    expect(r.avisos.join(' ')).toContain('Suspenso Setrans')
    expect(r.avisos.join(' ')).toContain('Setrans')
  })

  it('BU não consultado: BUI com aviso de consulta pendente', () => {
    const r = classificarRota([inter('Itaboraí')], { buAtivado: null })
    expect(r.bilhetes).toEqual([BILHETE.bui])
    expect(r.confianca).toBe('media')
    expect(r.avisos.join(' ')).toContain('não consultada')
  })

  it('só modais municipais do Rio → Jaé (obrigatório desde ago/2025)', () => {
    const r = classificarRota(
      [{ modal: 'onibus', municipio: 'Rio de Janeiro', intermunicipal: false }],
      { buAtivado: null }
    )
    expect(r.bilhetes).toEqual([BILHETE.jaeRj])
    expect(r.avisos.join(' ')).toContain('Jaé')
  })

  it('VLT no Rio → Ônibus e VLT (integração Jaé)', () => {
    const r = classificarRota(
      [
        { modal: 'onibus', municipio: 'Rio de Janeiro', intermunicipal: false },
        { modal: 'vlt', municipio: 'Rio de Janeiro', intermunicipal: false },
      ],
      { buAtivado: null }
    )
    expect(r.bilhetes).toEqual([BILHETE.onibusVlt])
  })

  it('intermunicipal + VLT no Rio → BUI com aviso do Jaé no VLT', () => {
    const r = classificarRota(
      [inter('Niterói'), { modal: 'vlt', municipio: 'Rio de Janeiro', intermunicipal: false }],
      { buAtivado: true }
    )
    expect(r.bilhetes).toEqual([BILHETE.bui])
    expect(r.avisos.join(' ')).toContain('Jaé')
  })

  it('trem sozinho → TREM; ônibus + trem → Ônibus, Trem e Metrô', () => {
    const soTrem = classificarRota([{ modal: 'trem', municipio: 'Rio de Janeiro', intermunicipal: false }], {
      buAtivado: null,
    })
    expect(soTrem.bilhetes).toEqual([BILHETE.trem])
    const misto = classificarRota(
      [nit(), { modal: 'trem', municipio: 'Rio de Janeiro', intermunicipal: false }],
      { buAtivado: null }
    )
    expect(misto.bilhetes).toEqual([BILHETE.onibusTremMetro])
  })

  it('barca Niterói → Centro RJ → CENTRO RJ, com aviso para confirmar', () => {
    const r = classificarRota(
      [nit(), { modal: 'barca', municipio: 'Niterói', intermunicipal: true }],
      { buAtivado: true }
    )
    expect(r.bilhetes).toEqual([BILHETE.centroRj])
    expect(r.confianca).toBe('media')
  })

  it('municipal fora de Niterói/Rio (ex.: só SG): sem bilhete no catálogo — não inventa valor', () => {
    const r = classificarRota(
      [{ modal: 'onibus', municipio: 'São Gonçalo', intermunicipal: false }],
      { buAtivado: true }
    )
    expect(r.bilhetes).toEqual([])
    expect(r.confianca).toBe('baixa')
  })
})
