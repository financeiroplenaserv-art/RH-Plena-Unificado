import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'

function normalizarJson(valor: unknown): unknown {
  if (typeof valor === 'number' && !Number.isFinite(valor)) {
    throw new Error('Conteúdo do lote contém número inválido')
  }
  if (Array.isArray(valor)) return valor.map(normalizarJson)
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chave, item]) => [chave, normalizarJson(item)]),
    )
  }
  return valor
}

export function jsonCanonico(valor: unknown): string {
  return JSON.stringify(normalizarJson(valor))
}

function conteudoDoLote(lote: LoteCargaVT): unknown {
  return {
    competencia: lote.competencia,
    versaoCalculo: lote.versaoCalculo,
    versaoRegras: lote.versaoRegras,
    fonte: {
      tipo: lote.fonte.tipo,
      nomeArquivo: lote.fonte.nomeArquivo,
      conteudoHash: lote.fonte.conteudoHash,
    },
    linhas: [...lote.linhas]
      .sort((a, b) =>
        a.colaboradorId.localeCompare(b.colaboradorId) ||
        a.data.localeCompare(b.data) ||
        a.departamentoId.localeCompare(b.departamentoId) ||
        a.origemDia.localeCompare(b.origemDia)
      )
      .map((linha) => ({
        colaboradorId: linha.colaboradorId,
        departamentoId: linha.departamentoId,
        data: linha.data,
        origemDia: linha.origemDia,
        decisaoTrajetoId: linha.decisaoTrajetoId,
        decisaoRevisao: linha.decisaoRevisao,
        componentes: [...linha.componentes]
          .sort((a, b) => a.componenteId.localeCompare(b.componenteId))
          .map((componente) => ({
            componenteId: componente.componenteId,
            pacoteId: componente.pacoteId,
            versaoPrecoId: componente.versaoPrecoId,
            valorCentavos: componente.valorCentavos,
            vigenteDesde: componente.vigenteDesde,
          })),
        ajustes: [...linha.ajustes]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((ajuste) => ({
            id: ajuste.id,
            decisaoTrajetoId: ajuste.decisaoTrajetoId,
            valorDiarioCentavos: ajuste.valorDiarioCentavos,
            motivo: ajuste.motivo,
            autorId: ajuste.autorId,
            vigenteDesde: ajuste.vigenteDesde,
          })),
        custoDiaCentavos: linha.custoDiaCentavos,
        pendenciaIds: [...linha.pendenciaIds].sort(),
      })),
    totaisPorColaborador: [...lote.totaisPorColaborador]
      .sort((a, b) => a.colaboradorId.localeCompare(b.colaboradorId))
      .map((total) => ({
        ...total,
        lancamentoAjusteIds: [...total.lancamentoAjusteIds].sort(),
        pendenciaIds: [...total.pendenciaIds].sort(),
      })),
    pendencias: [...lote.pendencias]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((pendencia) => ({ ...pendencia })),
    necessidadeCentavos: lote.necessidadeCentavos,
    ajusteCentavos: lote.ajusteCentavos,
    valorCentavos: lote.valorCentavos,
  }
}

export function conteudoCanonicoLote(lote: LoteCargaVT): string {
  return jsonCanonico(conteudoDoLote(lote))
}

export async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function calcularConteudoHashLote(lote: LoteCargaVT): Promise<string> {
  return sha256Hex(conteudoCanonicoLote(lote))
}

export async function atualizarConteudoHashLote(lote: LoteCargaVT): Promise<LoteCargaVT> {
  return { ...lote, conteudoHash: await calcularConteudoHashLote(lote) }
}

export type SituacaoBannerLote = 'nao_salvo' | 'divergente' | 'parcial' | 'rascunho' | 'confirmado'

export function avaliarBannerLote(
  calculado: Pick<LoteCargaVT, 'conteudoHash' | 'versaoConteudo' | 'totaisPorColaborador'>,
  salvo: Pick<LoteCargaVT, 'conteudoHash' | 'versaoConteudo' | 'status' | 'confirmacao'> | null,
): {
  situacao: SituacaoBannerLote
  versaoAtual: number
  versaoSalva: number | null
  versaoConfirmada: number | null
} {
  let situacao: SituacaoBannerLote
  if (!salvo || salvo.status === 'substituido') {
    situacao = 'nao_salvo'
  } else if (salvo.conteudoHash !== calculado.conteudoHash) {
    situacao = 'divergente'
  } else if (salvo.status === 'confirmado') {
    situacao = 'confirmado'
  } else {
    situacao = calculado.totaisPorColaborador.some((total) => total.status === 'parcial')
      ? 'parcial'
      : 'rascunho'
  }
  return {
    situacao,
    versaoAtual: calculado.versaoConteudo,
    versaoSalva: salvo?.versaoConteudo ?? null,
    versaoConfirmada: salvo?.confirmacao?.versaoConteudo ?? null,
  }
}
