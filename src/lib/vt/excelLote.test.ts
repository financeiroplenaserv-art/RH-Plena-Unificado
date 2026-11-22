import { describe, expect, it } from 'vitest'
import { montarWorkbookLote } from '@/lib/vt/excelLote'
import { atualizarConteudoHashLote } from '@/lib/vt/loteConteudo'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'

async function loteConfirmado(): Promise<LoteCargaVT> {
  const lote = await atualizarConteudoHashLote({
    id: 'lote-1',
    competencia: '2026-11',
    status: 'confirmado',
    versaoConteudo: 1,
    conteudoHash: '',
    versaoCalculo: '4.0.0',
    versaoRegras: { fluxo: 'vertical-1' },
    fonte: {
      tipo: 'gestao_escalas_flit',
      nomeArquivo: 'escalas.xlsx',
      conteudoHash: 'fonte-1',
      importadoEm: '2026-11-01T10:00:00Z',
    },
    linhas: [{
      id: 'linha-1',
      colaboradorId: 'pessoa-1',
      departamentoId: 'posto-1',
      data: '2026-11-10',
      origemDia: 'escala',
      decisaoTrajetoId: 'decisao-1',
      decisaoRevisao: 1,
      componentes: [],
      ajustes: [],
      custoDiaCentavos: 1000,
      pendenciaIds: [],
    }],
    totaisPorColaborador: [{
      colaboradorId: 'pessoa-1',
      status: 'completo',
      necessidadeCentavos: 1000,
      ajusteCentavos: 0,
      valorCentavos: 1000,
      excedenteTruncadoCentavos: 0,
      lancamentoAjusteIds: [],
      pendenciaIds: [],
    }],
    pendencias: [],
    necessidadeCentavos: 1000,
    ajusteCentavos: 0,
    valorCentavos: 1000,
    confirmacao: {
      versaoConteudo: 1,
      conteudoHash: '',
      confirmadaPor: 'usuario-1',
      confirmadaEm: '2026-11-15T10:00:00Z',
    },
    loteSubstituidoId: null,
  })
  return { ...lote, conteudoHash: lote.conteudoHash, confirmacao: { ...lote.confirmacao!, conteudoHash: lote.conteudoHash } }
}

describe('Excel do lote confirmado', () => {
  it('usa os dados do snapshot e confirma o hash', async () => {
    const lote = await loteConfirmado()
    const workbook = await montarWorkbookLote(lote, new Map([['pessoa-1', 'Pessoa Teste']]))
    const XLSX = await import('@e965/xlsx')
    const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['Carga VT'])

    expect(dados).toEqual([{
      Colaborador: 'Pessoa Teste',
      Postos: 'posto-1: 1 dia(s) (1d × R$ 10,00)',
      'Necessidade (R$)': 10,
      'Ajuste (R$)': 0,
      'Extra no mês (R$)': 0,
      'Motivo do extra': '',
      'Total a creditar (R$)': 10,
    }])
  })

  it('recusa lote ainda não confirmado', async () => {
    await expect(montarWorkbookLote({ ...(await loteConfirmado()), status: 'rascunho' }))
      .rejects.toThrow('lote confirmado')
  })

  it('bloqueia exportação quando o conteúdo diverge do hash', async () => {
    const lote = await loteConfirmado()
    lote.necessidadeCentavos = 2000
    await expect(montarWorkbookLote(lote)).rejects.toThrow('hash')
  })
})
