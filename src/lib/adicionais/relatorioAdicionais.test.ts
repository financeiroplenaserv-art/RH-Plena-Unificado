import { describe, it, expect } from 'vitest'
import { calcularRelatorioAdicionais, type DiaCalendarioBasico, type VinculoRelatorio } from './relatorioAdicionais'
import { gerarDiasDoPeriodo } from './calculoAdicionais'
import type { ContratoAdicional, RegimeTrabalho } from '@/types/adicionais'

// Período do caso real (02/10/2026): 20/08/2026 → 19/09/2026 (31 dias)
const INI = '2026-08-20'
const FIM = '2026-09-19'

function contrato(id: string, regime: RegimeTrabalho, adic: Partial<ContratoAdicional['adicionais']>, diasIntra: number[] = []): ContratoAdicional {
  return {
    id,
    nome: id,
    departamento_id: null,
    quantidade_colaboradores: 1,
    regime_trabalho: regime,
    adicionais: { insalubridade: false, noturno: false, periculosidade: false, feriado: false, intrajornada: false, ...adic },
    dias_intrajornada: diasIntra,
  }
}

function vinculo(id: string, colaborador: string, contratoId: string, inicio: string, fim: string | null): VinculoRelatorio {
  return { id, colaborador_id: colaborador, contrato_id: contratoId, data_inicio: inicio, data_fim: fim, colaborador_nome: colaborador }
}

function rodar(
  contratos: ContratoAdicional[],
  vinculos: VinculoRelatorio[],
  calendario: DiaCalendarioBasico[],
  ini = INI,
  fim = FIM,
  feriados: string[] = []
) {
  const linhas = calcularRelatorioAdicionais({
    inicio: ini,
    fim,
    vinculos,
    calendario,
    contratos: new Map(contratos.map(c => [c.id, c])),
    datasFeriados: new Set(feriados),
  })
  return (colab: string, contratoId?: string) =>
    linhas.find(l => l.colaborador_id === colab && (!contratoId || l.contrato_id === contratoId))
}

function dias(de: string, ate: string, status: string, extra: Partial<DiaCalendarioBasico> = {}, vinculoId = 'v1'): DiaCalendarioBasico[] {
  return gerarDiasDoPeriodo(de, ate).map(data => ({ vinculo_id: vinculoId, data, status, ...extra }))
}

describe('relatório — proporcional ao vínculo (decisão da gestão, 02/10/2026)', () => {
  it('caso Carlos Alexandre: 6x1, periculosidade, vínculo 03/09→19/09 com 11 trabalhou + 6 folga → 17 e 11 trabalhados', () => {
    const folgas = new Set(['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-12', '2026-09-13', '2026-09-19'])
    const cal = gerarDiasDoPeriodo('2026-09-03', '2026-09-19').map(data => ({
      vinculo_id: 'v1',
      data,
      status: folgas.has(data) ? 'folga' : 'trabalhou',
    }))
    const linha = rodar([contrato('c1', '6x1', { periculosidade: true })], [vinculo('v1', 'carlos', 'c1', '2026-09-03', '2026-09-19')], cal)('carlos')!
    expect(linha.dias_periculosidade).toBe(17) // antes: 30
    expect(linha.dias_trabalhados).toBe(11) // antes: 25 (dias antes do vínculo inferidos como trabalhados)
    expect(linha.folgas).toBe(6)
    expect(linha.faltas).toBe(0)
  })

  it('caso Pedro/Marcelo: cobertura da vaga antes do vínculo segue gerando o adicional do substituto, igual a antes', () => {
    const c = contrato('c1', '6x1', { insalubridade: true })
    const cobertura = dias('2026-08-20', '2026-09-01', 'folga_substituicao', {
      substituto_colaborador_id: 'marcelo',
      substituto_colaborador_nome: 'MARCELO',
      substituto_sem_adicional: false,
    })
    const r = rodar([c], [vinculo('v1', 'pedro', 'c1', '2026-09-03', '2026-09-19')], cobertura)
    const pedro = r('pedro')!
    const marcelo = r('marcelo')!
    // Pedro: só os 17 dias do vínculo (6x1 inferido a partir de 03/09: 15 trabalhou + 2 folga)
    expect(pedro.dias_insalubridade).toBe(17)
    expect(pedro.dias_trabalhados).toBe(15) // antes: 16 (02/09 inferido como trabalhou)
    expect(pedro.folgas).toBe(2) // antes: 15 (as 13 coberturas contavam como folga dele)
    // Marcelo: idêntico ao que receberia se as mesmas coberturas estivessem
    // dentro do vínculo do titular (comportamento anterior preservado)
    const referencia = rodar([c], [vinculo('v1', 'pedro', 'c1', '2026-08-01', '2026-09-19')], cobertura)('marcelo')!
    expect(marcelo).toEqual(referencia)
    expect(marcelo.dias_trabalhados).toBe(13)
    // Cada dia coberto conta UMA vez (decisão da gestão, 02/10/2026) —
    // antes a folga com substituição contava em dobro e dava 26.
    expect(marcelo.dias_insalubridade).toBe(13)
  })

  it('substituição "sem adicional" fora do vínculo não gera linha para o substituto', () => {
    const cobertura = dias('2026-08-20', '2026-09-01', 'folga_substituicao', {
      substituto_colaborador_id: 'marcelo',
      substituto_sem_adicional: true,
    })
    const r = rodar([contrato('c1', '6x1', { insalubridade: true })], [vinculo('v1', 'pedro', 'c1', '2026-09-03', '2026-09-19')], cobertura)
    expect(r('marcelo')).toBeUndefined()
    expect(r('pedro')!.dias_insalubridade).toBe(17)
  })

  it('admitido no dia 3 (sem lançamentos) → 17 dias de insalubridade', () => {
    const linha = rodar([contrato('c1', '12x36', { insalubridade: true })], [vinculo('v1', 'a', 'c1', '2026-09-03', null)], [])('a')!
    expect(linha.dias_insalubridade).toBe(17)
    expect(linha.dias_trabalhados).toBe(9) // 12x36 a partir de 03/09: dias 0, 2, …, 16
    expect(linha.folgas).toBe(8)
  })

  it('vínculo que termina no meio do período (data_fim) → mesma fórmula', () => {
    const linha = rodar(
      [contrato('c1', '12x36', { insalubridade: true, periculosidade: true })],
      [vinculo('v1', 'a', 'c1', '2026-01-10', '2026-09-05')],
      []
    )('a')!
    expect(linha.dias_insalubridade).toBe(17) // 20/08 → 05/09
    expect(linha.dias_periculosidade).toBe(17)
    expect(linha.dias_trabalhados + linha.folgas).toBe(17)
  })

  it('falta dentro do vínculo desconta; falta lançada fora do vínculo é ignorada para o titular', () => {
    const cal = [
      ...dias('2026-08-25', '2026-08-25', 'falta'), // fora
      ...dias('2026-09-10', '2026-09-10', 'falta'), // dentro
    ]
    const linha = rodar([contrato('c1', '6x1', { insalubridade: true })], [vinculo('v1', 'a', 'c1', '2026-09-03', '2026-09-19')], cal)('a')!
    expect(linha.faltas).toBe(1)
    expect(linha.dias_insalubridade).toBe(16)
  })

  it('folga dentro do vínculo não desconta', () => {
    const cal = dias('2026-09-03', '2026-09-19', 'folga')
    const linha = rodar([contrato('c1', '6x1', { insalubridade: true })], [vinculo('v1', 'a', 'c1', '2026-09-03', '2026-09-19')], cal)('a')!
    expect(linha.dias_insalubridade).toBe(17)
    expect(linha.dias_trabalhados).toBe(0)
  })

  it('dois vínculos em contratos diferentes: cada linha com os seus dias', () => {
    const r = rodar(
      [contrato('c1', '12x36', { insalubridade: true }), contrato('c2', '12x36', { periculosidade: true })],
      [vinculo('v1', 'a', 'c1', '2026-08-01', '2026-08-31'), vinculo('v2', 'a', 'c2', '2026-09-01', null)],
      []
    )
    expect(r('a', 'c1')!.dias_insalubridade).toBe(12) // 20/08 → 31/08
    expect(r('a', 'c2')!.dias_periculosidade).toBe(19) // 01/09 → 19/09
  })

  it('dois vínculos no mesmo contrato (linha fundida): soma os dias, com teto de 30', () => {
    const c = contrato('c1', '12x36', { insalubridade: true })
    const separados = rodar([c], [vinculo('v1', 'a', 'c1', '2026-08-20', '2026-08-29'), vinculo('v2', 'a', 'c1', '2026-09-05', '2026-09-19')], [])('a')!
    expect(separados.dias_insalubridade).toBe(25) // 10 + 15
    const sobrepostos = rodar([c], [vinculo('v1', 'a', 'c1', '2026-08-20', '2026-09-10'), vinculo('v2', 'a', 'c1', '2026-09-01', '2026-09-19')], [])('a')!
    expect(sobrepostos.dias_insalubridade).toBe(30) // 22 + 19 → teto 30
  })

  it('12×36 na borda: só o par dentro do vínculo sai do titular; o substituto recebe também o que cobriu fora', () => {
    const c = contrato('c1', '12x36', { insalubridade: true })
    const sub = { substituto_colaborador_id: 's' }
    const cal = [
      ...dias('2026-09-01', '2026-09-01', 'ferias', sub), // fora (escala, diff −2)
      ...dias('2026-09-02', '2026-09-02', 'ferias'), // fora (folga do par)
      ...dias('2026-09-03', '2026-09-03', 'ferias', sub), // dentro (escala)
      ...dias('2026-09-04', '2026-09-04', 'ferias'), // dentro (folga pareada)
    ]
    const r = rodar([c], [vinculo('v1', 'a', 'c1', '2026-09-03', '2026-09-19')], cal)
    expect(r('a')!.ferias).toBe(2)
    expect(r('a')!.dias_insalubridade).toBe(15) // 17 − 2 (par 03+04)
    expect(r('s')!.dias_insalubridade).toBe(4) // pares 01+02 e 03+04, como antes
  })

  it('noturno, intrajornada e feriado contam só dentro do vínculo', () => {
    // intrajornada aos sábados (6); feriados 22/08 (fora do vínculo) e 07/09 (segunda, dentro)
    const c = contrato('c1', '5x2', { noturno: true, intrajornada: true, feriado: true }, [6])
    const cal = dias('2026-09-03', '2026-09-19', 'trabalhou')
    const linha = rodar([c], [vinculo('v1', 'a', 'c1', '2026-09-03', '2026-09-19')], cal, INI, FIM, ['2026-08-21', '2026-09-07'])('a')!
    expect(linha.dias_trabalhados).toBe(17)
    expect(linha.dias_noturno).toBe(17)
    expect(linha.dias_intrajornada).toBe(3) // sábados 05, 12 e 19/09 (22/08 e 29/08 ficam fora)
    expect(linha.dias_feriado).toBe(1) // só 07/09 (21/08 é sexta, mas fora do vínculo)
  })
})

describe('relatório — substituto: cada dia coberto conta uma vez (decisão da gestão, 02/10/2026)', () => {
  it('folga com substituição: titular 17 + substituto 13 = 30 (antes o substituto recebia 26)', () => {
    const c = contrato('c1', '5x2', { insalubridade: true, periculosidade: true })
    const cal = dias('2026-08-20', '2026-09-01', 'folga_substituicao', { substituto_colaborador_id: 's' })
    const r = rodar([c], [vinculo('v1', 'a', 'c1', '2025-01-01', null)], cal)
    expect(r('a')!.dias_insalubridade).toBe(17)
    expect(r('s')!.dias_insalubridade).toBe(13)
    // Periculosidade: a folga com substituição já gerava (uma vez) — critério mantido
    expect(r('s')!.dias_periculosidade).toBe(13)
  })

  it('12×36: folga com substituição + par pareado, mais falta coberta — sem dobra', () => {
    const c = contrato('c1', '12x36', { insalubridade: true, periculosidade: true })
    const s = { substituto_colaborador_id: 's' }
    const cal = [
      // vínculo desde 20/08 → 03/09 é dia de escala (diff 14), 04/09 folga
      ...dias('2026-09-03', '2026-09-03', 'folga_substituicao', s),
      ...dias('2026-09-04', '2026-09-04', 'folga_substituicao'),
      ...dias('2026-09-10', '2026-09-10', 'falta', s),
    ]
    const r = rodar([c], [vinculo('v1', 'a', 'c1', '2026-08-20', null)], cal)
    expect(r('s')!.dias_insalubridade).toBe(3) // par 03+04 (2) + falta 10/09 (1)
    expect(r('s')!.dias_periculosidade).toBe(2) // falta não gera
  })
})

describe('relatório — vínculo cheio continua idêntico (regressão)', () => {
  it('período de 31 dias com vínculo cheio → 30 (teto)', () => {
    const linha = rodar(
      [contrato('c1', '12x36', { insalubridade: true, periculosidade: true })],
      [vinculo('v1', 'a', 'c1', '2025-01-01', null)],
      []
    )('a')!
    expect(linha.dias_insalubridade).toBe(30)
    expect(linha.dias_periculosidade).toBe(30)
    expect(linha.dias_trabalhados + linha.folgas).toBe(31) // todos os dias inferidos pela escala, como antes
  })

  it('período de 28 dias (fevereiro) com vínculo cheio → 30, como antes', () => {
    const linha = rodar([contrato('c1', '6x1', { insalubridade: true })], [vinculo('v1', 'a', 'c1', '2025-01-01', null)], [], '2027-02-20', '2027-03-19')('a')!
    expect(linha.dias_insalubridade).toBe(30)
  })

  it('faltas, férias com substituto e substituto puro: mesmos números da regra de 01/08/2026', () => {
    const c = contrato('c1', '5x2', { insalubridade: true, periculosidade: true })
    const cal = [
      ...dias('2026-08-21', '2026-08-21', 'falta'),
      ...dias('2026-09-01', '2026-09-08', 'ferias', { substituto_colaborador_id: 's' }),
      ...dias('2026-09-15', '2026-09-15', 'falta', { substituto_colaborador_id: 's' }),
    ]
    const r = rodar([c], [vinculo('v1', 'a', 'c1', '2026-06-20', null)], cal)
    const titular = r('a')!
    expect(titular.faltas).toBe(2)
    expect(titular.ferias).toBe(8)
    expect(titular.dias_insalubridade).toBe(20) // 30 − 2 faltas − 8 transferidos
    expect(titular.dias_periculosidade).toBe(20)
    const subst = r('s')!
    expect(subst.dias_trabalhados).toBe(9)
    expect(subst.dias_insalubridade).toBe(9) // 8 férias + 1 falta coberta
    expect(subst.dias_periculosidade).toBe(8) // só férias
  })
})
