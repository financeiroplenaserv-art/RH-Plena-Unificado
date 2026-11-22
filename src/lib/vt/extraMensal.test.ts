import { describe, expect, it } from 'vitest'
import type { ComponenteDecisaoTrajetoVT, DecisaoTrajetoVT, VersaoPrecoPacoteVT } from '@/lib/vt/contratosTarifarios'
import type { LancamentoAjusteVT } from '@/lib/vt/contratosLoteCarga'
import { construirRascunhoLoteCarga } from '@/lib/vt/construirLote'
import { totalizarColaboradorLote } from '@/lib/vt/loteCarga'
import { ajustesDosExtrasMensais, cargasDoLoteConfirmado } from '@/lib/vt/pontesLote'
import { montarWorkbookLote } from '@/lib/vt/excelLote'
import { atualizarConteudoHashLote } from '@/lib/vt/loteConteudo'
import { centavosParaCampo, validarExtraMensal } from '@/lib/vt/extraMensal'

const DECISAO: DecisaoTrajetoVT = {
  id: 'decisao-1', trajetoLegadoId: 't1', colaboradorId: 'pessoa-1', departamentoId: 'posto-1', revisao: 1,
  cotacaoId: null, status: 'confirmada', confirmadaPor: 'u', confirmadaEm: '2026-01-01T10:00:00Z',
  vigenteDesde: '2026-01-01', vigenteAte: null, referenciasLegadasNaoResolvidas: [],
}
const COMPONENTE: ComponenteDecisaoTrajetoVT = { id: 'c1', decisaoTrajetoId: 'decisao-1', pacoteId: 'p1', ordem: 1 }
const PRECO: VersaoPrecoPacoteVT = { id: 'pr1', pacoteId: 'p1', valorDiarioCentavos: 1000, vigenteDesde: '2026-01-01', vigenteAte: null }

const extra = (parcial: Partial<{ id: string; colaborador_id: string; valor_centavos: number; motivo: string }> = {}) => ({
  id: 'x1', colaborador_id: 'pessoa-1', competencia: '2026-11', valor_centavos: 1500, motivo: 'Foi a outro contrato', ...parcial,
})

function construir(ajustes: LancamentoAjusteVT[], colaboradorIds: string[] = ['pessoa-1']) {
  return construirRascunhoLoteCarga({
    id: 'lote-1', competencia: '2026-11', versaoCalculo: '4', versaoRegras: { f: '1' },
    fonte: { tipo: 'gestao_escalas_flit', nomeArquivo: 'a.xlsx', conteudoHash: 'h', importadoEm: '2026-11-01T10:00:00Z' },
    dias: [
      { colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-11-10', origemDia: 'escala' },
      { colaboradorId: 'pessoa-1', departamentoId: 'posto-1', data: '2026-11-11', origemDia: 'escala' },
    ],
    colaboradorIds,
    decisoes: [DECISAO], componentes: [COMPONENTE], versoesPreco: [PRECO],
    ajustesAnteriores: ajustes,
  })
}

describe('validarExtraMensal', () => {
  it('converte vírgula para centavos inteiros', () => {
    expect(validarExtraMensal('15,50', ' vai a outro contrato ')).toEqual({ ok: true, extra: { valorCentavos: 1550, motivo: 'vai a outro contrato' } })
    expect(centavosParaCampo(1550)).toBe('15,50')
  })
  it('exige motivo, valor positivo e respeita o teto', () => {
    expect(validarExtraMensal('15,00', '   ')).toMatchObject({ ok: false })
    expect(validarExtraMensal('0', 'x')).toMatchObject({ ok: false })
    expect(validarExtraMensal('', 'x')).toMatchObject({ ok: false })
    expect(validarExtraMensal('-3', 'x')).toMatchObject({ ok: false })
    expect(validarExtraMensal('9999,00', 'x')).toMatchObject({ ok: false })
    // Teto da gestora (22/11/2026): R$ 500,00
    expect(validarExtraMensal('500,00', 'x')).toMatchObject({ ok: true })
    expect(validarExtraMensal('500,01', 'x')).toMatchObject({ ok: false })
  })
})

describe('extra no mês no lote', () => {
  it('soma ao valor da pessoa e aparece separado da necessidade', async () => {
    const lote = await construir(ajustesDosExtrasMensais([extra()], '2026-11-20T10:00:00Z'))
    expect(lote.totaisPorColaborador[0]).toMatchObject({
      necessidadeCentavos: 2000, ajusteCentavos: 1500, valorCentavos: 3500,
      extraMensalCentavos: 1500, extraMensalMotivo: 'Foi a outro contrato', lancamentoAjusteIds: ['extra:x1'],
    })
  })

  it('mudar o extra ou o motivo muda o hash; sem extra o total não ganha campos', async () => {
    const sem = await construir([])
    const com = await construir(ajustesDosExtrasMensais([extra()], 't'))
    const outroValor = await construir(ajustesDosExtrasMensais([extra({ valor_centavos: 1600 })], 't'))
    const outroMotivo = await construir(ajustesDosExtrasMensais([extra({ motivo: 'Outro motivo' })], 't'))
    expect(new Set([sem.conteudoHash, com.conteudoHash, outroValor.conteudoHash, outroMotivo.conteudoHash]).size).toBe(4)
    expect(sem.totaisPorColaborador[0]).not.toHaveProperty('extraMensalCentavos')
  })

  it('pessoa sem dias de trabalho recebe só o extra (a tela avisa)', async () => {
    const lote = await construir(ajustesDosExtrasMensais([extra({ colaborador_id: 'pessoa-2', id: 'x2' })], 't'), ['pessoa-1', 'pessoa-2'])
    const total = lote.totaisPorColaborador.find((t) => t.colaboradorId === 'pessoa-2')!
    expect(total).toMatchObject({ status: 'completo', necessidadeCentavos: 0, valorCentavos: 1500, extraMensalCentavos: 1500 })
  })

  it('piso zero continua: débito do fechamento maior que necessidade + extra', () => {
    const total = totalizarColaboradorLote({
      colaboradorId: 'pessoa-1', linhas: [], pendencias: [],
      ajustesAnteriores: [
        ...ajustesDosExtrasMensais([extra({ valor_centavos: 500 })], 't'),
        { id: 'd', loteOrigemId: 'f', linhaOrigemId: null, colaboradorId: 'pessoa-1', data: null, tipo: 'debito', valorCentavos: 900, evidencia: 'falta', criadoPor: 'f', criadoEm: 't', consumidoPorLoteId: null },
      ],
    })
    expect(total).toMatchObject({ ajusteCentavos: -400, valorCentavos: 0, excedenteTruncadoCentavos: 400 })
  })

  it('recusa extra sem motivo (conversão e domínio)', () => {
    expect(() => ajustesDosExtrasMensais([extra({ motivo: '  ' })], 't')).toThrow(/motivo/)
    expect(() => totalizarColaboradorLote({
      colaboradorId: 'pessoa-1', linhas: [], pendencias: [],
      ajustesAnteriores: [{ id: 'e', loteOrigemId: 'x', linhaOrigemId: null, colaboradorId: 'pessoa-1', data: null, tipo: 'credito', origem: 'extra_mensal', valorCentavos: 100, evidencia: ' ', criadoPor: 'x', criadoEm: 't', consumidoPorLoteId: null }],
    })).toThrow(/motivo/)
  })

  it('Excel mostra Extra no mês e Motivo, e o Ajuste não conta o extra de novo', async () => {
    const rascunho = await construir(ajustesDosExtrasMensais([extra()], 't'))
    const confirmado = await atualizarConteudoHashLote({
      ...rascunho,
      status: 'confirmado',
      confirmacao: { versaoConteudo: 1, conteudoHash: '', confirmadaPor: 'u', confirmadaEm: '2026-11-21T10:00:00Z' },
    })
    const wb = await montarWorkbookLote(confirmado, new Map([['pessoa-1', 'Pessoa']]))
    const XLSX = await import('@e965/xlsx')
    const [linha] = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Carga VT'])
    expect(linha).toMatchObject({
      'Necessidade (R$)': 20, 'Ajuste (R$)': 0, 'Extra no mês (R$)': 15, 'Motivo do extra': 'Foi a outro contrato', 'Total a creditar (R$)': 35,
    })
  })

  it('ponte para vt_cargas: valor inclui o extra e o detalhe só tem as datas reais', async () => {
    const rascunho = await construir(ajustesDosExtrasMensais([extra()], 't'))
    const [carga] = cargasDoLoteConfirmado({ ...rascunho, status: 'confirmado' }, () => 'POSTO', 'u', '2026-11-21T10:00:00Z')
    expect(carga).toMatchObject({ necessidade_centavos: 2000, ajuste_centavos: 1500, valor_centavos: 3500 })
    expect(carga.detalhe).toHaveLength(1)
    expect(carga.detalhe[0].datas).toEqual(['2026-11-10', '2026-11-11'])
  })
})
