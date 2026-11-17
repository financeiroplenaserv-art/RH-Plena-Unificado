import { useCallback, useState } from 'react'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import {
  ErroConfirmacaoLoteCarga,
  type RepositorioSubstituicaoLoteCarga,
} from '@/lib/vt/confirmarLote'
import { construirRascunhoLoteCarga } from '@/lib/vt/construirLote'
import { confirmarLoteCarga, confirmarSubstitutoLoteCarga } from '@/lib/vt/confirmarLote'
import {
  compararTotaisPorColaborador,
  type AprovacaoDivergenciaLote,
  type DivergenciaColaboradorLote,
} from '@/lib/vt/divergenciasLote'
import { atualizarConteudoHashLote } from '@/lib/vt/loteConteudo'

export interface RepositorioLoteCargaAplicacao extends RepositorioSubstituicaoLoteCarga {
  obterUltimoPorCompetencia(competencia: string): Promise<LoteCargaVT | null>
  salvarRascunho(lote: LoteCargaVT, versaoEsperada: number): Promise<LoteCargaVT>
  aprovarDivergencia(anteriorId: string, novoId: string, colaboradorId: string): Promise<string>
}

export type EntradaConstruirLote = Omit<Parameters<typeof construirRascunhoLoteCarga>[0], 'versaoConteudo'> & {
  loteSubstituidoId?: string
}

export function useVtLoteCarga(
  repositorio: RepositorioLoteCargaAplicacao,
  usuarioId: string,
  agora: () => string = () => new Date().toISOString(),
) {
  const [lote, setLote] = useState<LoteCargaVT | null>(null)
  const [divergencias, setDivergencias] = useState<DivergenciaColaboradorLote[]>([])
  const [aprovacoes, setAprovacoes] = useState<AprovacaoDivergenciaLote[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const executar = useCallback(async function executarInterno<T>(operacao: () => Promise<T>): Promise<T | null> {
    setLoading(true)
    setErro(null)
    try {
      return await operacao()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao processar o lote de VT.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const carregar = useCallback(async (competencia: string) => {
    return executar(async () => {
      const encontrado = await repositorio.obterUltimoPorCompetencia(competencia)
      setLote(encontrado)
      setDivergencias([])
      setAprovacoes([])
      return encontrado
    })
  }, [executar, repositorio])

  const construir = useCallback(async (entrada: EntradaConstruirLote) => {
    return executar(async () => {
      const { loteSubstituidoId, ...dados } = entrada
      const anterior = loteSubstituidoId ? await repositorio.obter(loteSubstituidoId) : null
      if (loteSubstituidoId && (!anterior || anterior.status !== 'confirmado')) {
        throw new ErroConfirmacaoLoteCarga(
          'conflito_versao',
          'O lote anterior precisa estar confirmado para criar uma substituição.',
        )
      }
      const versaoAtual = lote?.id === entrada.id ? lote.versaoConteudo : 0
      let novo = await construirRascunhoLoteCarga({
        ...dados,
        versaoConteudo: versaoAtual + 1,
      })
      if (loteSubstituidoId) {
        novo = await atualizarConteudoHashLote({ ...novo, loteSubstituidoId })
      }
      const salvo = await repositorio.salvarRascunho(novo, versaoAtual)
      setLote(salvo)
      setDivergencias(anterior
        ? compararTotaisPorColaborador(anterior.totaisPorColaborador, salvo.totaisPorColaborador)
        : []
      )
      setAprovacoes([])
      return salvo
    })
  }, [executar, lote, repositorio])

  const confirmar = useCallback(async () => {
    if (!lote) return null
    return executar(async () => {
      const confirmado = await confirmarLoteCarga(repositorio, {
        loteId: lote.id,
        versaoEsperada: lote.versaoConteudo,
        usuarioId,
        agora: agora(),
      })
      setLote(confirmado)
      return confirmado
    })
  }, [agora, executar, lote, repositorio, usuarioId])

  const aprovar = useCallback(async (divergencia: DivergenciaColaboradorLote) => {
    if (!lote?.loteSubstituidoId) return null
    return executar(async () => {
      const divergenciaHash = await repositorio.aprovarDivergencia(
        lote.loteSubstituidoId!,
        lote.id,
        divergencia.colaboradorId,
      )
      const aprovacao: AprovacaoDivergenciaLote = {
        colaboradorId: divergencia.colaboradorId,
        divergenciaHash,
        aprovadaPor: usuarioId,
        aprovadaEm: agora(),
      }
      setAprovacoes((atuais) => [
        ...atuais.filter((item) => item.colaboradorId !== divergencia.colaboradorId),
        aprovacao,
      ])
      return aprovacao
    })
  }, [agora, executar, lote, repositorio, usuarioId])

  const substituir = useCallback(async () => {
    if (!lote?.loteSubstituidoId) return null
    return executar(async () => {
      const anterior = await repositorio.obter(lote.loteSubstituidoId!)
      if (!anterior) {
        throw new ErroConfirmacaoLoteCarga('nao_encontrado', 'Lote anterior não encontrado.')
      }
      const confirmado = await confirmarSubstitutoLoteCarga(repositorio, {
        anteriorId: anterior.id,
        versaoEsperadaAnterior: anterior.versaoConteudo,
        novoLoteId: lote.id,
        versaoEsperadaNovo: lote.versaoConteudo,
        usuarioId,
        agora: agora(),
        aprovacoes,
      })
      setLote(confirmado)
      return confirmado
    })
  }, [agora, aprovacoes, executar, lote, repositorio, usuarioId])

  return {
    lote,
    divergencias,
    aprovacoes,
    loading,
    erro,
    carregar,
    construir,
    confirmar,
    aprovar,
    substituir,
  }
}
