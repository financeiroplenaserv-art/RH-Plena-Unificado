import { describe, it, expect } from 'vitest'
import { adicionarMeses, competenciaDe, diasEntre, janelaPedido, mesesFechados } from './datas'

describe('competência e meses', () => {
  it('competenciaDe devolve o 1º dia do mês', () => {
    expect(competenciaDe('2026-10-09')).toBe('2026-10-01')
  })

  it('adicionarMeses limita o dia ao último do mês de destino', () => {
    expect(adicionarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(adicionarMeses('2026-08-31', 6)).toBe('2027-02-28')
    expect(adicionarMeses('2026-10-01', -10)).toBe('2025-12-01')
  })

  it('mesesFechados exclui o mês corrente e vai do mais antigo ao mais recente', () => {
    expect(mesesFechados('2026-10-09', 6)).toEqual([
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
    ])
    expect(mesesFechados('2026-01-15', 2)).toEqual(['2025-11-01', '2025-12-01'])
  })

  it('diasEntre conta dias corridos', () => {
    expect(diasEntre('2026-10-01', '2026-10-15')).toBe(14)
    expect(diasEntre('2026-10-15', '2026-10-01')).toBe(-14)
  })
})

describe('janela do pedido (dia 1 a 15, aviso a partir do dia configurável)', () => {
  it('dia 9: aberta, sem aviso', () => {
    const j = janelaPedido({ hoje: '2026-10-09' })
    expect(j.competencia).toBe('2026-10-01')
    expect(j.aberta).toBe(true)
    expect(j.nivelAviso).toBe('normal')
    expect(j.diasParaPrazo).toBe(6)
    expect(j.prazo).toBe('2026-10-15')
  })

  it('dia 10: aviso âmbar; dia 15: último dia, ainda aberta', () => {
    expect(janelaPedido({ hoje: '2026-10-10' }).nivelAviso).toBe('ambar')
    const ultimo = janelaPedido({ hoje: '2026-10-15' })
    expect(ultimo.nivelAviso).toBe('ambar')
    expect(ultimo.aberta).toBe(true)
    expect(ultimo.diasParaPrazo).toBe(0)
  })

  it('dia 16: fechada e vermelha', () => {
    const j = janelaPedido({ hoje: '2026-10-16' })
    expect(j.aberta).toBe(false)
    expect(j.dentroDoPrazo).toBe(false)
    expect(j.nivelAviso).toBe('vermelho')
    expect(j.diasParaPrazo).toBe(-1)
  })

  it('reabertura libera o link fora da janela até a data informada', () => {
    expect(janelaPedido({ hoje: '2026-10-16', reabertoAte: '2026-10-20' })).toMatchObject({ aberta: true, reaberta: true })
    expect(janelaPedido({ hoje: '2026-10-21', reabertoAte: '2026-10-20' }).aberta).toBe(false)
    expect(janelaPedido({ hoje: '2026-10-10', reabertoAte: '2026-10-20' }).reaberta).toBe(false)
  })

  it('dia de aviso e limite configuráveis', () => {
    expect(janelaPedido({ hoje: '2026-10-07', diaAviso: 7 }).nivelAviso).toBe('ambar')
    expect(janelaPedido({ hoje: '2026-10-21', diaLimite: 20 }).aberta).toBe(false)
    expect(janelaPedido({ hoje: '2026-10-20', diaLimite: 20 }).aberta).toBe(true)
  })
})
