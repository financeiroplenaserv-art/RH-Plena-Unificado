import { describe, it, expect } from 'vitest'
import { escaladoParaTrabalhar, contarDiasFeriadoEscalado } from './calculoAdicionais'

const FERIADOS = new Set(['2026-06-04', '2026-06-24', '2026-12-25'])
const PERIODO = ['2026-06-04', '2026-06-05', '2026-06-24', '2026-12-24', '2026-12-25']

describe('escaladoParaTrabalhar', () => {
  it('12x36 alterna dia sim, dia não a partir do início do vínculo', () => {
    expect(escaladoParaTrabalhar('12x36', '2026-06-20', '2026-06-20')).toBe(true)
    expect(escaladoParaTrabalhar('12x36', '2026-06-20', '2026-06-21')).toBe(false)
    expect(escaladoParaTrabalhar('12x36', '2026-06-20', '2026-06-22')).toBe(true)
  })
  it('6x1 folga a cada 7º dia', () => {
    expect(escaladoParaTrabalhar('6x1', '2026-06-20', '2026-06-25')).toBe(true)
    expect(escaladoParaTrabalhar('6x1', '2026-06-20', '2026-06-26')).toBe(false)
  })
  it('5x2 trabalha de segunda a sexta', () => {
    expect(escaladoParaTrabalhar('5x2', undefined, '2026-06-24')).toBe(true) // quarta
    expect(escaladoParaTrabalhar('5x2', undefined, '2026-06-27')).toBe(false) // sábado
  })
})

describe('contarDiasFeriadoEscalado (regra: só feriado com escala prevista)', () => {
  it('conta apenas feriados em dia de trabalho previsto no 12x36', () => {
    // vínculo iniciado 20/06: trabalha diferenças pares — 04/06, 24/06 e 25/12 caem em dia de trabalho
    expect(contarDiasFeriadoEscalado('12x36', '2026-06-20', PERIODO, FERIADOS)).toBe(3)
    // vínculo iniciado 21/06: os três feriados caem nas folgas dele
    expect(contarDiasFeriadoEscalado('12x36', '2026-06-21', PERIODO, FERIADOS)).toBe(0)
  })
  it('6x1 não conta o feriado que cai na folga semanal', () => {
    // início 20/06: 25/12 cai exatamente na folga (188 % 7 = 6) — contam 04/06 e 24/06
    expect(contarDiasFeriadoEscalado('6x1', '2026-06-20', PERIODO, FERIADOS)).toBe(2)
  })
  it('ignora datas que não são feriado cadastrado', () => {
    expect(contarDiasFeriadoEscalado('12x36', '2026-06-20', ['2026-06-20', '2026-06-22'], FERIADOS)).toBe(0)
  })
  it('5x2 conta todos os feriados em dia de semana', () => {
    // 04/06 (qui), 24/06 (qua) e 25/12 (sex) — todos dias úteis
    expect(contarDiasFeriadoEscalado('5x2', undefined, PERIODO, FERIADOS)).toBe(3)
  })
})
