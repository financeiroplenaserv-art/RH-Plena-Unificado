import { supabase } from '@/lib/supabase'
import type { LoteCargaVT } from '@/lib/vt/contratosLoteCarga'
import type { VtCargaLoteRow } from '@/types/vt'
import {
  ErroConfirmacaoLoteCarga,
  type CodigoErroConfirmacaoLote,
  type RepositorioSubstituicaoLoteCarga,
} from '@/lib/vt/confirmarLote'

export function loteDeLinha(linha: VtCargaLoteRow): LoteCargaVT {
  return {
    id: linha.id,
    competencia: linha.competencia,
    status: linha.status,
    versaoConteudo: linha.versao_conteudo,
    conteudoHash: linha.conteudo_hash,
    versaoCalculo: linha.versao_calculo,
    versaoRegras: linha.versao_regras,
    fonte: linha.fonte,
    linhas: linha.linhas as LoteCargaVT['linhas'],
    totaisPorColaborador: linha.totais_por_colaborador as LoteCargaVT['totaisPorColaborador'],
    pendencias: linha.pendencias as LoteCargaVT['pendencias'],
    necessidadeCentavos: linha.necessidade_centavos,
    ajusteCentavos: linha.ajuste_centavos,
    valorCentavos: linha.valor_centavos,
    confirmacao: linha.confirmacao,
    loteSubstituidoId: linha.lote_substituido_id,
  }
}

export function codigoErroRpc(mensagem: string): CodigoErroConfirmacaoLote {
  if (mensagem.includes('já está confirmado')) return 'ja_confirmado'
  if (mensagem.includes('pendências')) return 'lote_parcial'
  if (mensagem.includes('sem aprovação') || mensagem.includes('divergência não existe')) {
    return 'divergencias_pendentes'
  }
  if (mensagem.includes('Substituição exige aprovações')) return 'substituicao_requer_aprovacao'
  if (mensagem.includes('mudou') || mensagem.includes('versão') || mensagem.includes('substituído')) {
    return 'conflito_versao'
  }
  if (mensagem.includes('não encontrado')) return 'nao_encontrado'
  return 'conteudo_divergente'
}

export class RepositorioLoteCargaSupabase implements RepositorioSubstituicaoLoteCarga {
  async obter(id: string): Promise<LoteCargaVT | null> {
    const { data, error } = await supabase
      .from('vt_carga_lotes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? loteDeLinha(data as VtCargaLoteRow) : null
  }

  async obterUltimoPorCompetencia(competencia: string): Promise<LoteCargaVT | null> {
    const { data, error } = await supabase
      .from('vt_carga_lotes')
      .select('*')
      .eq('competencia', competencia)
      .order('versao_conteudo', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? loteDeLinha(data as VtCargaLoteRow) : null
  }

  async salvarRascunho(lote: LoteCargaVT, versaoEsperada: number): Promise<LoteCargaVT> {
    const { data, error } = await supabase.rpc('vt_salvar_rascunho_lote', {
      p_lote: lote,
      p_versao_esperada: versaoEsperada,
    })
    if (error) throw new ErroConfirmacaoLoteCarga(codigoErroRpc(error.message), error.message)
    return data as LoteCargaVT
  }

  async aprovarDivergencia(
    anteriorId: string,
    novoId: string,
    colaboradorId: string,
  ): Promise<string> {
    const { data, error } = await supabase.rpc('vt_aprovar_divergencia', {
      p_anterior_id: anteriorId,
      p_novo_id: novoId,
      p_colaborador_id: colaboradorId,
    })
    if (error) throw new ErroConfirmacaoLoteCarga(codigoErroRpc(error.message), error.message)
    return data
  }

  async confirmarSeVersao(lote: LoteCargaVT, versaoEsperada: number): Promise<void> {
    const { error } = await supabase.rpc('vt_confirmar_lote', {
      p_lote_id: lote.id,
      p_versao_esperada: versaoEsperada,
    })
    if (error) throw new ErroConfirmacaoLoteCarga(codigoErroRpc(error.message), error.message)
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
    const { error } = await supabase.rpc('vt_confirmar_substituto', {
      p_anterior_id: anteriorId,
      p_versao_esperada_anterior: versaoEsperadaAnterior,
      p_novo_id: novo.id,
      p_versao_esperada_novo: versaoEsperadaNovo,
    })
    if (error) throw new ErroConfirmacaoLoteCarga(codigoErroRpc(error.message), error.message)
  }
}
