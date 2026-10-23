import { describe, expect, it } from 'vitest'
import {
  ajusteDoFechamento,
  competenciaAnterior,
  postoDeReferencia,
  conciliarCarga,
  diasDoEspelho,
  type DiasEspelho,
} from '@/lib/vt/fechamento'
import type { EspelhoColaborador } from '@/lib/ocorrencias/importacaoPonto'
import type { VtCargaDetalhe } from '@/types/vt'

const POSTO_A: VtCargaDetalhe = {
  departamento_id: 'd1',
  posto: 'ITAGUAÍ',
  dias: 3,
  custo_dia_centavos: 1120,
  subtotal_centavos: 3360,
  dias_cobertura: 0,
  dias_treinamento: 0,
  datas: ['2026-11-03', '2026-11-04', '2026-11-05'],
}

const POSTO_B: VtCargaDetalhe = {
  departamento_id: 'd2',
  posto: 'CBO',
  dias: 1,
  custo_dia_centavos: 1880,
  subtotal_centavos: 1880,
  datas: ['2026-11-06'],
}

function espelho(entradas: [string, DiasEspelho extends Map<string, infer V> ? V : never][]): DiasEspelho {
  return new Map(entradas)
}

describe('competenciaAnterior', () => {
  it('mês anterior no mesmo ano e virada de ano', () => {
    expect(competenciaAnterior('2026-11')).toBe('2026-10')
    expect(competenciaAnterior('2027-01')).toBe('2026-12')
  })
})

describe('diasDoEspelho', () => {
  it('só devolve dias da competência (mês civil)', () => {
    const esp: EspelhoColaborador = {
      pagina: 1,
      nomePdf: 'FULANO',
      cpfPdf: '00000000000',
      periodoInicio: null,
      periodoFim: null,
      dias: [
        { data: '2026-10-31', realizado: 'x', justificativa: '', categoria: null, classificacao: 'trabalhado' },
        { data: '2026-11-01', realizado: 'x', justificativa: '', categoria: null, classificacao: 'trabalhado' },
        { data: '2026-11-19', realizado: 'x', justificativa: '', categoria: null, classificacao: 'trabalhado' },
        { data: '2026-12-01', realizado: 'x', justificativa: '', categoria: null, classificacao: 'trabalhado' },
      ],
    }
    const mapa = diasDoEspelho(esp, '2026-11')
    expect([...mapa.keys()]).toEqual(['2026-11-01', '2026-11-19'])
  })
})

describe('conciliarCarga (fechamento — faltou, desconta)', () => {
  it('tudo trabalhado: sem desconto', () => {
    const r = conciliarCarga(
      [POSTO_A],
      espelho([
        ['2026-11-03', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-04', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-05', { classificacao: 'trabalhado', categoria: null }],
      ])
    )
    expect(r.diasTrabalhados).toBe(3)
    expect(r.diasDescontados).toBe(0)
    expect(r.descontoCentavos).toBe(0)
  })

  it('falta e atestado descontam o custo do dia do posto planejado', () => {
    const r = conciliarCarga(
      [POSTO_A, POSTO_B],
      espelho([
        ['2026-11-03', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-04', { classificacao: 'falta', categoria: 'Falta' }],
        ['2026-11-05', { classificacao: 'atestado', categoria: 'Atestado' }],
        ['2026-11-06', { classificacao: 'nao_trabalhado', categoria: 'Folga' }], // previsto trabalho, ponto diz folga
      ])
    )
    expect(r.diasTrabalhados).toBe(1)
    expect(r.diasDescontados).toBe(3)
    expect(r.descontoCentavos).toBe(1120 + 1120 + 1880)
    expect(r.detalhe[0].descontados).toEqual(['2026-11-04', '2026-11-05'])
    expect(r.detalhe[1].descontados).toEqual(['2026-11-06'])
    const dia4 = r.diasDetalhe.find((d) => d.data === '2026-11-04')
    expect(dia4?.evidencia).toBe('Falta')
  })

  it('dia sem linha no espelho NUNCA desconta — vai para não conferido', () => {
    const r = conciliarCarga([POSTO_A], espelho([['2026-11-03', { classificacao: 'trabalhado', categoria: null }]]))
    expect(r.diasNaoConferidos).toBe(2)
    expect(r.descontoCentavos).toBe(0)
  })

  it('categoria "outro" conhecida (Afastado) desconta; texto irreconhecível não', () => {
    const r = conciliarCarga(
      [POSTO_A],
      espelho([
        ['2026-11-03', { classificacao: 'outro', categoria: 'Afastado' }],
        ['2026-11-04', { classificacao: 'outro', categoria: null }],
        ['2026-11-05', { classificacao: 'trabalhado', categoria: null }],
      ])
    )
    expect(r.diasDescontados).toBe(1)
    expect(r.diasNaoConferidos).toBe(1)
    expect(r.diasTrabalhados).toBe(1)
  })

  it('carga antiga sem datas no detalhe: nada a conferir', () => {
    const r = conciliarCarga([{ ...POSTO_A, datas: undefined }], espelho([]))
    expect(r.diasPlanejados).toBe(0)
    expect(r.descontoCentavos).toBe(0)
  })
})

describe('conciliarCarga — crédito do dia trabalhado fora da carga (decisão de 23/10/2026)', () => {
  it('troca de plantão: desconta a folga planejada e credita o dia trabalhado no posto de referência', () => {
    // Planejado 03/04/05 (ITAGUAÍ) e 06 (CBO). Trocou o plantão do dia 05 pelo dia 07.
    const r = conciliarCarga(
      [POSTO_A, POSTO_B],
      espelho([
        ['2026-11-03', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-04', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-05', { classificacao: 'nao_trabalhado', categoria: 'Folga' }],
        ['2026-11-06', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-07', { classificacao: 'trabalhado', categoria: null }],
      ])
    )
    expect(r.diasDescontados).toBe(1)
    expect(r.descontoCentavos).toBe(1120)
    expect(r.diasCreditados).toBe(1)
    // ITAGUAÍ tem 3 dias planejados × CBO 1 → referência = ITAGUAÍ
    expect(r.creditoCentavos).toBe(1120)
    expect(r.detalhe[0].creditados).toEqual(['2026-11-07'])
    expect(r.detalhe[1].creditados).toEqual([])
    expect(r.diasForaSemPosto).toEqual([])
    // os dias planejados não mudam com o crédito
    expect(r.diasPlanejados).toBe(4)
    const dia7 = r.diasDetalhe.find((d) => d.data === '2026-11-07')
    expect(dia7?.resultado).toBe('creditado')
  })

  it('dia já planejado e trabalhado NÃO credita (nunca duas vezes); folga/falta fora da carga não credita', () => {
    const r = conciliarCarga(
      [POSTO_A],
      espelho([
        ['2026-11-03', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-04', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-05', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-08', { classificacao: 'nao_trabalhado', categoria: 'Folga' }],
        ['2026-11-09', { classificacao: 'falta', categoria: 'Falta' }],
      ])
    )
    expect(r.diasTrabalhados).toBe(3)
    expect(r.diasCreditados).toBe(0)
    expect(r.creditoCentavos).toBe(0)
  })

  it('sem nenhum dia planejado: não credita por palpite — lista como "sem posto, conferir"', () => {
    const r = conciliarCarga(
      [],
      espelho([
        ['2026-11-10', { classificacao: 'trabalhado', categoria: null }],
        ['2026-11-02', { classificacao: 'trabalhado', categoria: null }],
      ])
    )
    expect(r.diasCreditados).toBe(0)
    expect(r.creditoCentavos).toBe(0)
    expect(r.diasForaSemPosto).toEqual(['2026-11-02', '2026-11-10'])
    expect(r.diasDetalhe.every((d) => d.resultado === 'fora_sem_posto')).toBe(true)
  })

  it('posto de referência: mais dias planejados; empate → primeiro do detalhe', () => {
    const c = { ...POSTO_B, departamento_id: 'd3', posto: 'OUTRO', datas: ['2026-11-07'] }
    expect(postoDeReferencia([POSTO_B, c])?.departamento_id).toBe('d2')
    expect(postoDeReferencia([POSTO_B, POSTO_A])?.departamento_id).toBe('d1')
    expect(postoDeReferencia([{ ...POSTO_A, datas: [] }])).toBeNull()
  })

  it('ajuste da carga seguinte = crédito − desconto (pode ser positivo); fechamento antigo sem crédito = só desconto', () => {
    expect(ajusteDoFechamento({ desconto_centavos: 1120, credito_centavos: 3360 })).toEqual({
      ajuste: 2240,
      desconto: 1120,
      credito: 3360,
    })
    expect(ajusteDoFechamento({ desconto_centavos: 500 }).ajuste).toBe(-500)
  })
})
