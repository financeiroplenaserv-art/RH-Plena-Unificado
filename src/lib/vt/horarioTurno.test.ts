import { describe, expect, it } from 'vitest'
import { descreverAlternativo, descreverHorarioDoTurno, escolherHorarioDoTurno, lerHorarioDoTurno } from './horarioTurno'

describe('lerHorarioDoTurno', () => {
  it.each([
    ['19 ÀS 07HS ENSEADA PORTARIA NOT. (PAR) COM INTERVALO', '19:00', '07:00', true],
    ['19:00 às 07:00h ROSAS PORT N. IMPAR', '19:00', '07:00', true],
    ['7:00 às 15:20h Faltista ASG', '07:00', '15:20', false],
    ['8 ÀS 16:20h CALLE ASG - 1', '08:00', '16:20', false],
    ['7 ÀS 19 ENSEADA PORT. DIA IMPAR', '07:00', '19:00', false],
  ])('lê %s', (turno, entrada, saida, noturno) => {
    expect(lerHorarioDoTurno(turno)?.principal).toEqual({ entrada, saida, noturno })
  })

  it('turno com sábado diferente: principal + sábado à parte', () => {
    const lido = lerHorarioDoTurno('07:00 às 16:00 e sáb 7 às 11hs CBO - ASG - 8')
    expect(lido?.principal).toEqual({ entrada: '07:00', saida: '16:00', noturno: false })
    expect(lido?.sabado).toEqual({ entrada: '07:00', saida: '11:00', noturno: false })
  })

  it.each([['Faltista ASG'], ['Inspetor Diurno'], ['CBO - ASG - 8'], ['25 às 30'], [''], [null], [undefined]])(
    'texto ilegível (%s) devolve null — nunca inventa horário',
    (turno) => {
      expect(lerHorarioDoTurno(turno)).toBeNull()
    },
  )
})

describe('escolherHorarioDoTurno', () => {
  const hoje = '2026-11-19'
  const dias = (turno: string, datas: string[]) => datas.map((data) => ({ data, turno }))

  it('escolhe o turno mais frequente e conta as ocorrências', () => {
    const registros = [
      ...dias('7:00 às 15:20h Faltista ASG', ['2026-11-10', '2026-11-11', '2026-11-12']),
      ...dias('8 ÀS 16:20h CALLE ASG - 1', ['2026-11-13']),
    ]
    const r = escolherHorarioDoTurno(registros, hoje)
    expect(r).toMatchObject({ entrada: '07:00', saida: '15:20', noturno: false, texto: '07:00 às 15:20', ocorrencias: 3 })
    expect(r?.alternativos).toEqual([{ entrada: '08:00', saida: '16:20', noturno: false, motivo: 'outro_turno', ocorrencias: 1 }])
    expect(descreverHorarioDoTurno(r!)).toBe('07:00 às 15:20 (visto em 3 dias)')
    expect(descreverAlternativo(r!.alternativos[0])).toBe('08:00 às 16:20 (1 dia)')
  })

  it('turno noturno: noturno = true (a volta é no dia seguinte)', () => {
    const r = escolherHorarioDoTurno(dias('19 ÀS 07HS ENSEADA PORTARIA NOT. (PAR) COM INTERVALO', ['2026-11-01', '2026-11-03']), hoje)
    expect(r).toMatchObject({ entrada: '19:00', saida: '07:00', noturno: true, ocorrencias: 2 })
  })

  it('sábado diferente entra em alternativos, mantendo o horário principal', () => {
    const r = escolherHorarioDoTurno(dias('07:00 às 16:00 e sáb 7 às 11hs CBO - ASG - 8', ['2026-11-02', '2026-11-03']), hoje)
    expect(r).toMatchObject({ entrada: '07:00', saida: '16:00' })
    expect(r?.alternativos).toEqual([{ entrada: '07:00', saida: '11:00', noturno: false, motivo: 'sabado', ocorrencias: 2 }])
    expect(descreverAlternativo(r!.alternativos[0])).toBe('sábado 07:00 às 11:00')
  })

  it('ignora o que é mais antigo que 60 dias, futuro e texto ilegível', () => {
    const r = escolherHorarioDoTurno(
      [
        ...dias('7 ÀS 19 ENSEADA PORT. DIA IMPAR', ['2026-08-01', '2026-08-02', '2026-08-03']),
        ...dias('7 ÀS 19 ENSEADA PORT. DIA IMPAR', ['2026-11-25']),
        ...dias('Faltista ASG', ['2026-11-10']),
        ...dias('8 ÀS 16:20h CALLE ASG - 1', ['2026-11-12']),
      ],
      hoje,
    )
    expect(r).toMatchObject({ entrada: '08:00', saida: '16:20', ocorrencias: 1, alternativos: [] })
  })

  it('empate: vale o turno mais recente', () => {
    const r = escolherHorarioDoTurno(
      [...dias('8 ÀS 16:20h A', ['2026-11-01']), ...dias('7 ÀS 19 B', ['2026-11-15'])],
      hoje,
    )
    expect(r).toMatchObject({ entrada: '07:00', saida: '19:00' })
  })

  it('sem nenhum turno legível devolve null', () => {
    expect(escolherHorarioDoTurno(dias('Faltista ASG', ['2026-11-10']), hoje)).toBeNull()
    expect(escolherHorarioDoTurno([], hoje)).toBeNull()
  })
})
