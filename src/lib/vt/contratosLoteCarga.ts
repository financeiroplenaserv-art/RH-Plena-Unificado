export interface FonteLoteCargaVT {
  tipo: 'gestao_escalas_flit'
  nomeArquivo: string | null
  conteudoHash: string
  importadoEm: string
}

export interface PendenciaLoteCargaVT {
  id: string
  colaboradorId: string | null
  codigo: string
  mensagem: string
  impeditivaConfirmacao: boolean
}

export interface LinhaLoteCargaVT {
  id: string
  colaboradorId: string
  departamentoId: string
  data: string
  origemDia: 'escala' | 'cobertura' | 'treinamento'
  decisaoTrajetoId: string | null
  pacoteId: string | null
  versaoPrecoPacoteId: string | null
  custoDiaCentavos: number | null
  pendenciaIds: string[]
}

export interface ConfirmacaoLoteCargaVT {
  versaoConteudo: number
  conteudoHash: string
  confirmadaPor: string
  confirmadaEm: string
}

export interface LoteCargaVT {
  id: string
  competencia: string
  status: 'rascunho' | 'confirmado' | 'substituido'
  versaoConteudo: number
  versaoCalculo: string
  versaoRegras: Readonly<Record<string, string>>
  fonte: FonteLoteCargaVT
  linhas: LinhaLoteCargaVT[]
  pendencias: PendenciaLoteCargaVT[]
  necessidadeCentavos: number
  ajusteCentavos: number
  valorCentavos: number
  confirmacao: ConfirmacaoLoteCargaVT | null
  loteSubstituidoId: string | null
}

export type CalcularRascunhoCarga = (
  competencia: string,
  fonte: FonteLoteCargaVT,
  ajustesAnteriores: readonly LancamentoAjusteVT[],
) => LoteCargaVT

export type ConfirmarLoteCarga = (
  loteId: string,
  versaoEsperada: number,
  usuarioId: string,
) => LoteCargaVT

export interface LancamentoAjusteVT {
  id: string
  loteOrigemId: string
  linhaOrigemId: string | null
  colaboradorId: string
  data: string | null
  tipo: 'debito' | 'credito' | 'pendencia'
  valorCentavos: number | null
  evidencia: string
  criadoPor: string
  criadoEm: string
}

export type ReconciliarLoteCarga = (
  loteConfirmadoId: string,
  evidenciasPonto: readonly unknown[],
  usuarioId: string,
) => LancamentoAjusteVT[]

export interface ArtefatoExportacaoVT {
  id: string
  loteConfirmadoId: string
  loteConteudoHash: string
  formato: 'excel_operacional' | 'riocard_pedido_txt'
  layoutVersao: string
  arquivoHash: string
  chaveIdempotencia: string
  geradoPor: string
  geradoEm: string
}

export type ExportarLoteConfirmado = (
  loteConfirmadoId: string,
  formato: ArtefatoExportacaoVT['formato'],
  usuarioId: string,
) => ArtefatoExportacaoVT
