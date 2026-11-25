import { describe, expect, it } from 'vitest'
import {
  classificarCodigoLinha,
  construirAlternativaManual,
  inverterConducoes,
  type ConducaoManual,
} from '@/lib/vt/rotaManual'
import { calcularAlternativaSentido, calcularDiaIdaVolta, combinarIdaVolta } from '@/lib/vt/motor/idaVolta'
import type { FatosCartaoMotor } from '@/lib/vt/motor/tipos'

const CARTAO: FatosCartaoMotor = { situacaoBu: 'Ativado', consultadoEm: '2026-10-28' }
const DATA = '2026-11-25'
const linha = (codigo: string, id = codigo): ConducaoManual => ({ id, tipo: 'linha', codigo })

function alt(conducoes: ConducaoManual[], sentido: 'ida' | 'volta' = 'ida', motivo = 'confirmado com a colaboradora') {
  return construirAlternativaManual({
    conducoes,
    sentido,
    municipioOrigem: 'São Gonçalo',
    municipioDestino: 'Niterói',
    dataServico: DATA,
    horaReferencia: '06:00',
    consultadoEm: '2026-11-25T12:00:00.000Z',
    motivo,
    autorId: 'u1',
  })
}

describe('rota manual', () => {
  it('classifica o código: DETRO, municipal de Niterói e desconhecida', () => {
    expect(classificarCodigoLinha('489m').tipo).toBe('detro')
    expect(classificarCodigoLinha('532M').tipo).toBe('detro')
    expect(classificarCodigoLinha('39A').tipo).toBe('municipal_niteroi')
    expect(classificarCodigoLinha('999X').tipo).toBe('desconhecida')
    expect(classificarCodigoLinha('').tipo).toBe('desconhecida')
  })

  it('caso Ana Bela: 489M + 532M = R$ 9,40 por sentido (BUI) e R$ 18,80 no dia', () => {
    const ida = alt([linha('489M'), linha('532M')], 'ida')!
    const voltaConducoes = inverterConducoes([linha('489M'), linha('532M')])
    expect(voltaConducoes.map((c) => c.codigo)).toEqual(['532M', '489M'])
    const volta = alt(voltaConducoes, 'volta')!
    expect(calcularAlternativaSentido(ida, CARTAO, DATA).resultado.valorCentavos).toBe(940)
    const dia = calcularDiaIdaVolta(ida, volta, CARTAO, DATA)
    expect(dia.valorCentavos).toBe(1880)
    expect(dia.status).toBe('confirmado')
  })

  it('linha inexistente fica indeterminada, sem valor inventado', () => {
    const a = alt([linha('999X')])!
    const r = calcularAlternativaSentido(a, CARTAO, DATA)
    expect(r.resultado.valorCentavos).toBeNull()
    expect(r.resultado.status).toBe('indeterminado')
    expect(a.avisos.join(' ')).toMatch(/999X não foi encontrada/)
  })

  it('lista vazia não gera alternativa', () => {
    expect(alt([])).toBeNull()
  })

  it('grava provedor manual, motivo e autor na evidência combinada', () => {
    const ida = alt([linha('39A')], 'ida')!
    const volta = alt([linha('39A')], 'volta')!
    const dia = calcularDiaIdaVolta(ida, volta, CARTAO, DATA)
    const combinada = combinarIdaVolta(ida, volta, dia, CARTAO, DATA)
    expect(combinada.itinerario.provedor).toBe('manual')
    expect(combinada.itinerario.precisao).toBe('manual')
    expect(combinada.itinerario.rotaManual).toMatchObject({
      motivo: 'confirmado com a colaboradora',
      autorId: 'u1',
      horariosPresumidos: true,
    })
  })

  it('meio escolhido na lista (barca) vira o modal certo', () => {
    const a = alt([{ id: 'x', tipo: 'barca' }])!
    expect(a.itinerario.pernas[0]).toMatchObject({ modal: 'barca', sistemaTarifario: 'aquaviario' })
  })

  it('inverter conserva o trecho DETRO e gera ids novos', () => {
    const origem: ConducaoManual[] = [{ ...linha('416M'), secao: { secao: 0, rotulo: 'Percurso inteiro' } }, linha('39A')]
    const volta = inverterConducoes(origem)
    expect(volta[1].secao).toEqual({ secao: 0, rotulo: 'Percurso inteiro' })
    expect(volta.map((c) => c.id)).not.toContain(origem[0].id)
  })
})
