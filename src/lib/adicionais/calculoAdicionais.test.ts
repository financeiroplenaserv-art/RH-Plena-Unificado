import { describe, it, expect } from 'vitest'
import {
  escaladoParaTrabalhar,
  contarDiasFeriadoEscalado,
  adicionalTitular30,
  insalubridadeSubstituto,
  periculosidadeSubstituto,
  contarDiasTransferidos,
} from './calculoAdicionais'

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

// Regra da gestão, 01/08/2026 — insalubridade/periculosidade:
// titular = 30 − faltas − dias de férias/afastado cobertos por substituto;
// substituto: insalubridade = todos os dias cobertos; periculosidade = só
// os dias de férias/afastado cobertos (falta não gera periculosidade).
describe('adicionalTitular30 (titular: 30 − faltas − transferidos)', () => {
  it('trabalhou tudo (qualquer escala) → 30', () => {
    expect(adicionalTitular30(0)).toBe(30)
  })
  it('faltou → 30 menos as faltas', () => {
    expect(adicionalTitular30(2)).toBe(28)
  })
  it('12x36 com férias cobertas por substituto → trabalhados + folgas da parte ativa', () => {
    // 14 dias ativos (7 trabalhados + 7 folgas) + 16 dias de férias cobertos
    expect(adicionalTitular30(0, 16)).toBe(14)
  })
  it('não-12x36 com férias → dias corridos da parte dele no mês', () => {
    // férias do dia 15 em diante cobertas pelo substituto: titular fica com 14
    expect(adicionalTitular30(0, 16)).toBe(14)
  })
  it('falta antes das férias desconta da parte do titular', () => {
    expect(adicionalTitular30(1, 16)).toBe(13)
  })
  it('afastado segue a mesma regra de férias', () => {
    expect(adicionalTitular30(0, 10)).toBe(20)
  })
  it('nunca fica negativo', () => {
    expect(adicionalTitular30(20, 15)).toBe(0)
  })
})

describe('insalubridadeSubstituto (todos os dias cobertos)', () => {
  it('férias/afastado + falta somam', () => {
    expect(insalubridadeSubstituto(16, 1)).toBe(17)
  })
  it('só cobertura de falta → recebe os dias substituídos', () => {
    expect(insalubridadeSubstituto(0, 2)).toBe(2)
  })
  it('só férias → a outra parte do mês', () => {
    expect(insalubridadeSubstituto(16, 0)).toBe(16)
  })
})

describe('periculosidadeSubstituto (só férias/afastado)', () => {
  it('cobertura de falta NÃO gera periculosidade', () => {
    expect(periculosidadeSubstituto(0)).toBe(0)
  })
  it('férias/afastado coberto → a outra parte do mês', () => {
    expect(periculosidadeSubstituto(16)).toBe(16)
  })
})

// Regra 12×36 da gestão (01/08/2026): o substituto cobre os dias de ESCALA
// do titular, mas recebe trabalhado + folga pareada — cada dia de escala
// coberto transfere 2 (o dia + a folga seguinte, se também for férias).
const BLOCO_FERIAS = [
  '2026-06-20', '2026-06-21', '2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25',
  '2026-06-26', '2026-06-27', '2026-06-28', '2026-06-29', '2026-06-30',
  '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07',
]
// Vínculo 12x36 iniciado em 20/06: dias de escala = diferenças pares
const ESCALA_MARIANA = ['2026-06-20', '2026-06-22', '2026-06-24', '2026-06-26', '2026-06-28', '2026-06-30', '2026-07-02', '2026-07-04', '2026-07-06']
const diasComSubstitutoEm = (cobertos: string[]) =>
  BLOCO_FERIAS.map(data => ({ data, comSubstituto: cobertos.includes(data) }))

describe('contarDiasTransferidos (12×36: trabalhado + folga pareada)', () => {
  it('caso Mariana: 9 dias de escala cobertos transferem o bloco inteiro (18)', () => {
    expect(contarDiasTransferidos('12x36', '2026-06-20', diasComSubstitutoEm(ESCALA_MARIANA))).toBe(18)
  })
  it('substituto em todos os dias do bloco não duplica (pareamento deduplica)', () => {
    expect(contarDiasTransferidos('12x36', '2026-06-20', diasComSubstitutoEm(BLOCO_FERIAS))).toBe(18)
  })
  it('um dia de escala coberto transfere o dia + a folga seguinte', () => {
    expect(contarDiasTransferidos('12x36', '2026-06-20', diasComSubstitutoEm(['2026-06-20']))).toBe(2)
  })
  it('dia de FOLGA coberto transfere só ele (a folga não gera novo par)', () => {
    expect(contarDiasTransferidos('12x36', '2026-06-20', diasComSubstitutoEm(['2026-06-21']))).toBe(1)
  })
  it('dia de escala no fim do bloco: folga fora do bloco não conta', () => {
    const dias = [{ data: '2026-07-06', comSubstituto: true }]
    expect(contarDiasTransferidos('12x36', '2026-06-20', dias)).toBe(1)
  })
  it('regime indefinido se comporta como 12×36 (padrão do sistema)', () => {
    expect(contarDiasTransferidos(undefined, '2026-06-20', diasComSubstitutoEm(['2026-06-20']))).toBe(2)
  })
  it('escalas normais: só os dias cobertos, sem folga pareada', () => {
    const dias = ['2026-06-22', '2026-06-23', '2026-06-24'].map(data => ({ data, comSubstituto: true }))
    expect(contarDiasTransferidos('5x2', undefined, dias)).toBe(3)
    expect(contarDiasTransferidos('6x1', '2026-06-20', dias)).toBe(3)
  })
})
