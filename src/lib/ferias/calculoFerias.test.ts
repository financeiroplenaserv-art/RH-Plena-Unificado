import { describe, it, expect } from 'vitest'
import {
  calcularLimiteConcessivo,
  resumirFerias,
  DIAS_ALERTA_VENCIMENTO,
  type PeriodoSimples,
} from './calculoFerias'

// Referência fixa: 23/07/2026
const HOJE = new Date(2026, 6, 23)

describe('calcularLimiteConcessivo', () => {
  it('retorna null sem data de admissão', () => {
    expect(calcularLimiteConcessivo(null, null)).toBeNull()
  })

  it('sem gozo: limite é o fim do primeiro aquisitivo + 12 meses', () => {
    // Admissão 10/04/2023 → 1º aquisitivo termina 09/04/2024 → limite 09/04/2025
    expect(calcularLimiteConcessivo('2023-04-10', null)).toBe('2025-04-09')
  })

  it('com gozo cobrindo um aquisitivo: limite do aquisitivo seguinte', () => {
    // Admissão 10/04/2023, gozo terminou 31/03/2026 → cobre aquisitivo até 09/04/2025
    // → próximo limite 09/04/2027
    expect(calcularLimiteConcessivo('2023-04-10', '2026-03-31')).toBe('2027-04-09')
  })

  it('gozo no meio do aquisitivo corrente cobre o aquisitivo anterior completo', () => {
    // Admissão 27/11/2015, gozo 08/05/2026–06/06/2026 → cobre aquisitivo até 26/11/2025
    // → próximo limite 26/11/2027
    expect(calcularLimiteConcessivo('2015-11-27', '2026-06-06')).toBe('2027-11-26')
  })
})

describe('resumirFerias', () => {
  it('Sem dados quando não há admissão nem períodos', () => {
    const resumo = resumirFerias(null, [], HOJE)
    expect(resumo.situacao).toBe('Sem dados')
    expect(resumo.limiteConcessivo).toBeNull()
  })

  it('Em gozo quando hoje está dentro de um período de gozo', () => {
    const periodos: PeriodoSimples[] = [
      { tipo: 'gozo', data_inicio: '2026-07-02', data_fim: '2026-07-31' },
    ]
    expect(resumirFerias('2013-11-09', periodos, HOJE).situacao).toBe('Em gozo')
  })

  it('Em gozo também vale para agendado em andamento', () => {
    const periodos: PeriodoSimples[] = [
      { tipo: 'agendado', data_inicio: '2026-07-20', data_fim: '2026-08-18' },
    ]
    expect(resumirFerias('2013-11-09', periodos, HOJE).situacao).toBe('Em gozo')
  })

  it('Agendado quando há período confirmado futuro', () => {
    const periodos: PeriodoSimples[] = [
      { tipo: 'agendado', data_inicio: '2026-08-12', data_fim: '2026-09-10' },
    ]
    expect(resumirFerias('2018-04-07', periodos, HOJE).situacao).toBe('Agendado')
  })

  it('Previsto quando há apenas previsão do RH (não confirmada)', () => {
    const periodos: PeriodoSimples[] = [
      { tipo: 'previsto', data_inicio: '2026-08-01', data_fim: '2026-08-30' },
    ]
    expect(resumirFerias('2018-04-07', periodos, HOJE).situacao).toBe('Previsto')
  })

  it('Agendado tem precedência sobre Previsto', () => {
    const periodos: PeriodoSimples[] = [
      { tipo: 'previsto', data_inicio: '2026-08-01', data_fim: '2026-08-30' },
      { tipo: 'agendado', data_inicio: '2026-09-01', data_fim: '2026-09-30' },
    ]
    expect(resumirFerias('2018-04-07', periodos, HOJE).situacao).toBe('Agendado')
  })

  it('Previsão em andamento também conta como Previsto (não Em gozo)', () => {
    const periodos: PeriodoSimples[] = [
      { tipo: 'previsto', data_inicio: '2026-07-20', data_fim: '2026-08-18' },
    ]
    expect(resumirFerias('2018-04-07', periodos, HOJE).situacao).toBe('Previsto')
  })

  it('Vencido quando o limite concessivo já passou e não há gozo', () => {
    // Admissão 10/04/2023 sem gozo → limite 09/04/2025, já passou
    const resumo = resumirFerias('2023-04-10', [], HOJE)
    expect(resumo.situacao).toBe('Vencido')
    expect(resumo.limiteConcessivo).toBe('2025-04-09')
  })

  it(`A vencer quando o limite está a menos de ${DIAS_ALERTA_VENCIMENTO} dias`, () => {
    // Admissão 23/08/2024 sem gozo → limite 22/08/2026, a 30 dias de 23/07/2026
    const resumo = resumirFerias('2024-08-23', [], HOJE)
    expect(resumo.situacao).toBe('A vencer')
    expect(resumo.limiteConcessivo).toBe('2026-08-22')
  })

  it('Em dia quando o limite está além da janela de alerta', () => {
    // Admissão 10/04/2023, gozo recente → limite 09/04/2027
    const periodos: PeriodoSimples[] = [
      { tipo: 'gozo', data_inicio: '2026-03-02', data_fim: '2026-03-31' },
    ]
    const resumo = resumirFerias('2023-04-10', periodos, HOJE)
    expect(resumo.situacao).toBe('Em dia')
    expect(resumo.limiteConcessivo).toBe('2027-04-09')
    expect(resumo.ultimoGozo).toEqual({ inicio: '2026-03-02', fim: '2026-03-31' })
  })

  it('expõe o próximo agendado e a próxima previsão no resumo', () => {
    const periodos: PeriodoSimples[] = [
      { tipo: 'previsto', data_inicio: '2026-08-01', data_fim: '2026-08-30' },
      { tipo: 'agendado', data_inicio: '2026-09-01', data_fim: '2026-09-30' },
    ]
    const resumo = resumirFerias('2018-04-07', periodos, HOJE)
    expect(resumo.proximaPrevisao).toEqual({ inicio: '2026-08-01', fim: '2026-08-30' })
    expect(resumo.proximoAgendado).toEqual({ inicio: '2026-09-01', fim: '2026-09-30' })
  })
})
