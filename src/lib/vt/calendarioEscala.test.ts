import { describe, expect, it } from 'vitest'
import {
  contaDaEscala,
  diasEscalaDoRelatorio,
  lerDiasEscala,
  montarCalendarioEscala,
} from '@/lib/vt/calendarioEscala'
import type { DiaRelatorio } from '@/lib/vt/gestaoEscalasFlit'

const nomePosto = (id: string) => ({ 'posto-a': 'CBO', 'posto-b': 'ITAGUAÍ' })[id] ?? id

describe('diasEscalaDoRelatorio', () => {
  it('converte as marcas do Flit em siglas, guarda o horário do [T] e a célula crua desconhecida', () => {
    const dias: DiaRelatorio[] = [
      { data: '2026-12-01', marca: 'trabalha', texto: '[T] 07:00 - 19:00' },
      { data: '2026-12-02', marca: 'folga', texto: '[F]' },
      { data: '2026-12-03', marca: 'ferias', texto: '[FR]' },
      { data: '2026-12-04', marca: 'afastado', texto: '[AF]' },
      { data: '2026-12-05', marca: 'atestado', texto: '[AT]' },
      { data: '2026-12-06', marca: 'vazio', texto: '' },
      { data: '2026-12-07', marca: 'vazio', texto: '[LM] licença' },
    ]
    expect(diasEscalaDoRelatorio(dias, 'CONDOMINIO X')).toEqual({
      '2026-12-01': { marca: 'T', local: 'CONDOMINIO X', horario: '07:00 - 19:00' },
      '2026-12-02': { marca: 'F', local: 'CONDOMINIO X' },
      '2026-12-03': { marca: 'FR', local: 'CONDOMINIO X' },
      '2026-12-04': { marca: 'AF', local: 'CONDOMINIO X' },
      '2026-12-05': { marca: 'AT', local: 'CONDOMINIO X' },
      '2026-12-06': { marca: '', local: 'CONDOMINIO X' },
      '2026-12-07': { marca: '[LM] licença', local: 'CONDOMINIO X' },
    })
  })

  it('lerDiasEscala descarta lixo do jsonb', () => {
    expect(lerDiasEscala(null)).toBeNull()
    expect(lerDiasEscala([1])).toBeNull()
    expect(lerDiasEscala({ '2026-12-01': { marca: 'T', local: 'X' }, ruim: {}, '2026-12-02': 'x' })).toEqual({
      '2026-12-01': { marca: 'T', local: 'X' },
    })
  })
})

describe('montarCalendarioEscala', () => {
  it('monta as semanas dom→sáb do mês (dezembro/2026 começa numa terça)', () => {
    const cal = montarCalendarioEscala({ competencia: '2026-12', linhasPagas: [], marcas: {}, nomePosto })
    expect(cal.semanas[0].slice(0, 2)).toEqual([null, null])
    expect(cal.semanas[0][2]?.data).toBe('2026-12-01')
    expect(cal.semanas.every((s) => s.length === 7)).toBe(true)
    const dias = cal.semanas.flat().filter((d) => d !== null)
    expect(dias).toHaveLength(31)
    expect(dias[30]?.data).toBe('2026-12-31')
  })

  it('o lote vence a marca; treinamento roxo; folga/férias/afastado; vazio = sem registro; ausente = fora do relatório', () => {
    const cal = montarCalendarioEscala({
      competencia: '2026-12',
      linhasPagas: [
        { data: '2026-12-01', departamentoId: 'posto-a', origemDia: 'escala', custoDiaCentavos: 1120 },
        { data: '2026-12-02', departamentoId: 'posto-b', origemDia: 'cobertura', custoDiaCentavos: 1880 },
        { data: '2026-12-03', departamentoId: 'posto-b', origemDia: 'treinamento', custoDiaCentavos: 1880 },
      ],
      marcas: {
        '2026-12-01': { marca: 'T', local: 'CBO' },
        '2026-12-02': { marca: 'F', local: 'CBO' }, // cobertura sintetizada sobre folga: paga
        '2026-12-03': { marca: 'F', local: 'CBO' },
        '2026-12-04': { marca: 'F', local: 'CBO' },
        '2026-12-05': { marca: 'FR', local: 'CBO' },
        '2026-12-06': { marca: 'AF', local: 'CBO' },
        '2026-12-07': { marca: 'AT', local: 'CBO' },
        '2026-12-08': { marca: 'T', local: 'CBO' }, // [T] sem linha paga
        '2026-12-09': { marca: '', local: 'CBO' },
        '2026-12-10': { marca: 'XYZ', local: 'CBO' },
      },
      nomePosto,
    })
    const porData = new Map(cal.semanas.flat().filter((d) => d).map((d) => [d!.data, d!]))
    expect(porData.get('2026-12-01')).toMatchObject({ tipo: 'trabalho_vt', posto: 'CBO', custoDiaCentavos: 1120 })
    expect(porData.get('2026-12-02')).toMatchObject({ tipo: 'trabalho_vt', posto: 'ITAGUAÍ', origemDia: 'cobertura' })
    expect(porData.get('2026-12-02')?.descricao).toContain('cobertura de férias')
    expect(porData.get('2026-12-03')?.tipo).toBe('treinamento')
    expect(porData.get('2026-12-04')?.tipo).toBe('folga')
    expect(porData.get('2026-12-05')?.tipo).toBe('ferias')
    expect(porData.get('2026-12-06')?.tipo).toBe('afastado')
    expect(porData.get('2026-12-07')?.tipo).toBe('atestado')
    expect(porData.get('2026-12-08')?.tipo).toBe('trabalho_sem_vt')
    expect(porData.get('2026-12-09')?.tipo).toBe('sem_registro')
    expect(porData.get('2026-12-10')).toMatchObject({ tipo: 'outro', marca: 'XYZ' })
    expect(porData.get('2026-12-20')?.tipo).toBe('fora_relatorio')
    expect(porData.get('2026-12-01')?.descricao).toMatch(/^01\/12\/2026 \(terça\) — Trabalho \(gera VT\) — posto CBO/)
    expect(cal.temMarcas).toBe(true)
    expect(cal.tiposPresentes).toContain('fora_relatorio')
  })

  it('sem marcas gravadas mostra só os dias do lote', () => {
    const cal = montarCalendarioEscala({
      competencia: '2026-12',
      linhasPagas: [{ data: '2026-12-01', departamentoId: 'posto-a', origemDia: 'escala', custoDiaCentavos: 1120 }],
      marcas: null,
      nomePosto,
    })
    const dias = cal.semanas.flat().filter((d) => d)
    expect(dias.filter((d) => d!.tipo === 'trabalho_vt')).toHaveLength(1)
    expect(dias.filter((d) => d!.tipo === 'sem_detalhe')).toHaveLength(30)
    expect(cal.temMarcas).toBe(false)
  })
})

describe('contaDaEscala', () => {
  it('agrupa por posto × custo e soma ajuste e extra até o valor final', () => {
    const linhas = [
      { data: '2026-12-02', departamentoId: 'posto-a', origemDia: 'escala' as const, custoDiaCentavos: 1000 },
      { data: '2026-12-01', departamentoId: 'posto-a', origemDia: 'escala' as const, custoDiaCentavos: 1000 },
      { data: '2026-12-03', departamentoId: 'posto-b', origemDia: 'cobertura' as const, custoDiaCentavos: 1200 },
    ]
    const conta = contaDaEscala(
      linhas,
      { necessidadeCentavos: 3200, ajusteCentavos: -500 + 1500, valorCentavos: 4200, excedenteTruncadoCentavos: 0, extraMensalCentavos: 1500 },
      nomePosto,
    )
    expect(conta.grupos.map((g) => [g.posto, g.dias, g.subtotalCentavos])).toEqual([['CBO', 2, 2000], ['ITAGUAÍ', 1, 1200]])
    expect(conta.texto.replace(/\u00a0/g, ' ')).toBe('2 dias × R$ 10,00 no posto CBO + 1 dia × R$ 12,00 no posto ITAGUAÍ = R$ 32,00')
    expect(conta.ajusteFechamentoCentavos).toBe(-500)
    expect(conta.extraMensalCentavos).toBe(1500)
    expect(conta.necessidadeCentavos + conta.ajusteFechamentoCentavos + conta.extraMensalCentavos).toBe(conta.valorFinalCentavos)
  })

  it('pessoa sem dias e dia sem preço', () => {
    const vazio = contaDaEscala([], { necessidadeCentavos: 0, ajusteCentavos: 0, valorCentavos: 0, excedenteTruncadoCentavos: 0 }, nomePosto)
    expect(vazio.texto.replace(/\u00a0/g, ' ')).toBe('Nenhum dia de trabalho com VT = R$ 0,00')
    const semPreco = contaDaEscala(
      [{ data: '2026-12-01', departamentoId: 'posto-a', origemDia: 'escala', custoDiaCentavos: null }],
      { necessidadeCentavos: 0, ajusteCentavos: 0, valorCentavos: null, excedenteTruncadoCentavos: null },
      nomePosto,
    )
    expect(semPreco.texto).toContain('1 dia sem preço no posto CBO')
    expect(semPreco.valorFinalCentavos).toBeNull()
  })
})
