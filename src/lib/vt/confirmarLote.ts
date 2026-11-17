import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import { calcularConteudoHashLote } from '@/lib/vt/loteConteudo'
import {
  compararTotaisPorColaborador,
  hashDivergenciaColaborador,
  verificarAprovacoesDivergencias,
  type AprovacaoDivergenciaLote,
} from '@/lib/vt/divergenciasLote'

export type CodigoErroConfirmacaoLote =
  | 'nao_encontrado'
  | 'conflito_versao'
  | 'ja_confirmado'
  | 'lote_parcial'
  | 'conteudo_divergente'
  | 'divergencias_pendentes'
  | 'substituicao_requer_aprovacao'

export class ErroConfirmacaoLoteCarga extends Error {
  public readonly codigo: CodigoErroConfirmacaoLote

  constructor(codigo: CodigoErroConfirmacaoLote, mensagem: string) {
    super(mensagem)
    this.codigo = codigo
    this.name = 'ErroConfirmacaoLoteCarga'
  }
}

function clonar<T>(valor: T): T {
  return structuredClone(valor)
}

export class RepositorioLoteCargaEmMemoria {
  private readonly lotes = new Map<string, LoteCargaVT>()

  constructor(lotes: readonly LoteCargaVT[] = []) {
    for (const lote of lotes) this.lotes.set(lote.id, clonar(lote))
  }

  async obter(id: string): Promise<LoteCargaVT | null> {
    const lote = this.lotes.get(id)
    return lote ? clonar(lote) : null
  }

  async obterUltimoPorCompetencia(competencia: string): Promise<LoteCargaVT | null> {
    const lote = [...this.lotes.values()]
      .filter((item) => item.competencia === competencia)
      .sort((a, b) => b.versaoConteudo - a.versaoConteudo || b.id.localeCompare(a.id))[0]
    return lote ? clonar(lote) : null
  }

  async salvarRascunho(lote: LoteCargaVT, versaoEsperada: number): Promise<LoteCargaVT> {
    const atual = this.lotes.get(lote.id)
    if (atual) {
      if (
        atual.status !== 'rascunho' || atual.versaoConteudo !== versaoEsperada ||
        lote.versaoConteudo !== atual.versaoConteudo + 1
      ) {
        throw new ErroConfirmacaoLoteCarga(
          'conflito_versao',
          'O rascunho mudou ou já foi confirmado por outro operador.',
        )
      }
    } else if (versaoEsperada !== 0 || lote.versaoConteudo !== 1) {
      throw new ErroConfirmacaoLoteCarga(
        'conflito_versao',
        'Lote novo precisa começar na versão 1.',
      )
    }
    this.lotes.set(lote.id, clonar(lote))
    return clonar(lote)
  }

  async aprovarDivergencia(
    anteriorId: string,
    novoId: string,
    colaboradorId: string,
  ): Promise<string> {
    const anterior = this.lotes.get(anteriorId)
    const novo = this.lotes.get(novoId)
    if (!anterior || anterior.status !== 'confirmado' || !novo || novo.status !== 'rascunho') {
      throw new ErroConfirmacaoLoteCarga(
        'conflito_versao',
        'Os lotes mudaram ou já foram confirmados por outro operador.',
      )
    }
    const divergencia = compararTotaisPorColaborador(
      anterior.totaisPorColaborador,
      novo.totaisPorColaborador,
    ).find((item) => item.colaboradorId === colaboradorId && item.exigeAprovacao)
    if (!divergencia) {
      throw new ErroConfirmacaoLoteCarga(
        'divergencias_pendentes',
        'A divergência não existe ou já foi alterada.',
      )
    }
    return hashDivergenciaColaborador(divergencia)
  }

  async confirmarSeVersao(lote: LoteCargaVT, versaoEsperada: number): Promise<void> {
    const atual = this.lotes.get(lote.id)
    if (!atual || atual.status !== 'rascunho' || atual.versaoConteudo !== versaoEsperada) {
      throw new ErroConfirmacaoLoteCarga(
        'conflito_versao',
        'O lote mudou ou já foi confirmado por outro operador.',
      )
    }
    this.lotes.set(lote.id, clonar(lote))
  }

  async confirmarSubstitutoSeVersao({
    anteriorId,
    versaoEsperadaAnterior,
    novo,
    versaoEsperadaNovo,
  }: {
    anteriorId: string
    versaoEsperadaAnterior: number
    novo: LoteCargaVT
    versaoEsperadaNovo: number
  }): Promise<void> {
    const anterior = this.lotes.get(anteriorId)
    const atualNovo = this.lotes.get(novo.id)
    if (
      !anterior || anterior.status !== 'confirmado' || anterior.versaoConteudo !== versaoEsperadaAnterior ||
      !atualNovo || atualNovo.status !== 'rascunho' || atualNovo.versaoConteudo !== versaoEsperadaNovo
    ) {
      throw new ErroConfirmacaoLoteCarga(
        'conflito_versao',
        'Um dos lotes mudou ou a substituição já foi realizada por outro operador.',
      )
    }
    const substituido = clonar(anterior)
    substituido.status = 'substituido'
    this.lotes.set(anteriorId, substituido)
    this.lotes.set(novo.id, clonar(novo))
  }
}

export interface RepositorioConfirmacaoLoteCarga {
  obter(id: string): Promise<LoteCargaVT | null>
  confirmarSeVersao(lote: LoteCargaVT, versaoEsperada: number): Promise<void>
}

export interface RepositorioSubstituicaoLoteCarga extends RepositorioConfirmacaoLoteCarga {
  confirmarSubstitutoSeVersao(args: {
    anteriorId: string
    versaoEsperadaAnterior: number
    novo: LoteCargaVT
    versaoEsperadaNovo: number
  }): Promise<void>
}

async function validarLoteConfirmavel(lote: LoteCargaVT): Promise<string> {
  if (lote.valorCentavos == null || lote.totaisPorColaborador.some((total) => total.status === 'parcial')) {
    throw new ErroConfirmacaoLoteCarga(
      'lote_parcial',
      'O lote tem pendências e não pode ser confirmado.',
    )
  }
  const conteudoHash = await calcularConteudoHashLote(lote)
  if (conteudoHash !== lote.conteudoHash) {
    throw new ErroConfirmacaoLoteCarga(
      'conteudo_divergente',
      'O conteúdo do lote diverge do hash salvo. Recalcule antes de confirmar.',
    )
  }
  return conteudoHash
}

export async function confirmarLoteCarga(
  repositorio: RepositorioConfirmacaoLoteCarga,
  {
    loteId,
    versaoEsperada,
    usuarioId,
    agora,
  }: {
    loteId: string
    versaoEsperada: number
    usuarioId: string
    agora: string
  },
): Promise<LoteCargaVT> {
  const atual = await repositorio.obter(loteId)
  if (!atual) {
    throw new ErroConfirmacaoLoteCarga('nao_encontrado', 'Lote de carga não encontrado.')
  }
  if (atual.status === 'confirmado') {
    throw new ErroConfirmacaoLoteCarga('ja_confirmado', 'O lote já está confirmado.')
  }
  if (atual.status !== 'rascunho' || atual.versaoConteudo !== versaoEsperada) {
    throw new ErroConfirmacaoLoteCarga(
      'conflito_versao',
      'A versão do lote mudou. Recarregue antes de confirmar.',
    )
  }
  if (atual.loteSubstituidoId) {
    throw new ErroConfirmacaoLoteCarga(
      'substituicao_requer_aprovacao',
      'Uma substituição precisa das aprovações de divergências; use o fluxo próprio.',
    )
  }
  const conteudoHash = await validarLoteConfirmavel(atual)
  const snapshot = clonar(atual)
  snapshot.status = 'confirmado'
  snapshot.confirmacao = {
    versaoConteudo: atual.versaoConteudo,
    conteudoHash,
    confirmadaPor: usuarioId,
    confirmadaEm: agora,
  }
  await repositorio.confirmarSeVersao(snapshot, versaoEsperada)
  return clonar(snapshot)
}

export async function confirmarSubstitutoLoteCarga(
  repositorio: RepositorioSubstituicaoLoteCarga,
  {
    anteriorId,
    versaoEsperadaAnterior,
    novoLoteId,
    versaoEsperadaNovo,
    usuarioId,
    agora,
    aprovacoes = [],
  }: {
    anteriorId: string
    versaoEsperadaAnterior: number
    novoLoteId: string
    versaoEsperadaNovo: number
    usuarioId: string
    agora: string
    aprovacoes?: readonly AprovacaoDivergenciaLote[]
  },
): Promise<LoteCargaVT> {
  const [anterior, novo] = await Promise.all([
    repositorio.obter(anteriorId),
    repositorio.obter(novoLoteId),
  ])
  if (!anterior || !novo || anteriorId === novoLoteId) {
    throw new ErroConfirmacaoLoteCarga('nao_encontrado', 'Lote anterior ou substituto não encontrado.')
  }
  if (anterior.status !== 'confirmado' || anterior.versaoConteudo !== versaoEsperadaAnterior) {
    throw new ErroConfirmacaoLoteCarga(
      'conflito_versao',
      'O lote anterior mudou ou já foi substituído. Recarregue antes de confirmar.',
    )
  }
  if (novo.status !== 'rascunho' || novo.versaoConteudo !== versaoEsperadaNovo) {
    throw new ErroConfirmacaoLoteCarga(
      'conflito_versao',
      'O novo lote mudou ou já foi confirmado. Recarregue antes de confirmar.',
    )
  }
  if (novo.loteSubstituidoId && novo.loteSubstituidoId !== anteriorId) {
    throw new ErroConfirmacaoLoteCarga(
      'conflito_versao',
      'O novo lote está vinculado a outro lote substituído.',
    )
  }

  const divergencias = compararTotaisPorColaborador(
    anterior.totaisPorColaborador,
    novo.totaisPorColaborador,
  )
  const revisao = await verificarAprovacoesDivergencias(divergencias, aprovacoes)
  if (!revisao.completa) {
    throw new ErroConfirmacaoLoteCarga(
      'divergencias_pendentes',
      `Ainda há ${revisao.pendentes.length} divergência(s) sem aprovação.`,
    )
  }

  const conteudoHash = await validarLoteConfirmavel(novo)
  const snapshot = clonar(novo)
  snapshot.status = 'confirmado'
  snapshot.loteSubstituidoId = anteriorId
  snapshot.confirmacao = {
    versaoConteudo: novo.versaoConteudo,
    conteudoHash,
    confirmadaPor: usuarioId,
    confirmadaEm: agora,
  }
  await repositorio.confirmarSubstitutoSeVersao({
    anteriorId,
    versaoEsperadaAnterior,
    novo: snapshot,
    versaoEsperadaNovo,
  })
  return clonar(snapshot)
}
