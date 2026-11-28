// Conferência e saída do arquivo de pedido Riocard (lógica pura + download).
// A conferência de integridade garante que nenhum centavo do lote some ou apareça: tudo que
// tem valor > 0 ou está num arquivo, ou está na lista "fora" (que a gestora confere).

import type { AbaExcel } from '@/lib/vt/excelImportacoes'
import type { RelatorioRiocard } from '@/lib/vt/importacaoRiocard'
import type { ResultadoPedidoRiocard, TotalPedidoRiocard } from '@/lib/vt/pedidoRiocard'

export const DIAS_RELATORIO_ANTIGO = 7

export interface ConferenciaPedidoRiocard {
  ok: boolean
  totalLoteCentavos: number
  totalArquivosCentavos: number
  totalForaComValorCentavos: number
  foraComValor: number
}

export function conferirIntegridadePedido(
  totais: readonly TotalPedidoRiocard[],
  resultado: ResultadoPedidoRiocard,
): ConferenciaPedidoRiocard {
  const valorPorId = new Map(totais.map((t) => [t.colaboradorId, t.valorCentavos ?? 0]))
  const totalLoteCentavos = totais.reduce((s, t) => s + (t.valorCentavos && t.valorCentavos > 0 ? t.valorCentavos : 0), 0)
  const totalArquivosCentavos = resultado.arquivos.reduce((s, a) => s + a.totalCentavos, 0)
  const foraComValorLista = resultado.fora.filter((f) => (valorPorId.get(f.colaboradorId) ?? 0) > 0)
  const totalForaComValorCentavos = foraComValorLista.reduce((s, f) => s + (valorPorId.get(f.colaboradorId) ?? 0), 0)
  return {
    ok: totalArquivosCentavos + totalForaComValorCentavos === totalLoteCentavos,
    totalLoteCentavos,
    totalArquivosCentavos,
    totalForaComValorCentavos,
    foraComValor: foraComValorLista.length,
  }
}

/** Dias entre a emissão do relatório (AAAA-MM-DD) e hoje (AAAA-MM-DD); null se a data não existe. */
export function diasDesdeEmissao(emitidoEm: string | null, hoje: string): number | null {
  if (!emitidoEm) return null
  const a = Date.parse(`${emitidoEm}T00:00:00Z`)
  const b = Date.parse(`${hoje}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

export function relatorioRiocardAntigo(r: Pick<RelatorioRiocard, 'emitidoEm'>, hoje: string): boolean {
  const d = diasDesdeEmissao(r.emitidoEm, hoje)
  return d !== null && d > DIAS_RELATORIO_ANTIGO
}

const reais = (centavos: number) => Number((centavos / 100).toFixed(2))

/** Abas do Excel de conferência: o que vai em cada arquivo e quem fica fora. */
export function abasConferenciaPedidoRiocard(
  totais: readonly TotalPedidoRiocard[],
  resultado: ResultadoPedidoRiocard,
): AbaExcel[] {
  const valorPorId = new Map(totais.map((t) => [t.colaboradorId, t.valorCentavos]))
  return [
    {
      nome: 'No arquivo',
      linhas: [
        ['Matrícula Riocard', 'Nome', 'Valor (R$)', 'CNPJ da conta'],
        ...resultado.arquivos.flatMap((a) => a.itens.map((i) => [i.matriculaRiocard, i.nome, reais(i.valorCentavos), a.cnpj])),
      ],
    },
    {
      nome: 'Fora do arquivo',
      linhas: [
        ['Nome', 'Valor (R$)', 'Motivo'],
        ...resultado.fora.map((f) => {
          const v = valorPorId.get(f.colaboradorId)
          return [f.nome, v == null ? '' : reais(v), f.motivo]
        }),
      ],
    },
  ]
}

/** Baixa um texto puro (ASCII) sem BOM. */
export function baixarTextoPuro(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/plain;charset=us-ascii' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
