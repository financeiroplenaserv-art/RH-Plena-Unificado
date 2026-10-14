import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import type { ContratoSubst, LinhaKitSubst, ParamsSubstituicao, VinculoSubstituicao } from '@/lib/materiais/substituicao'
import type { ResultadoSubstituicaoItem } from '@/types/materiais'

// "Substituir em todos os kits" (migration 128). A escrita é só pela RPC
// mat_substituir_item_kits (SECURITY DEFINER, reconfere pode_aprovar_materiais()).

/**
 * Vínculos de substituição gravados (item inteiro ou só uma variação), base
 * da média com cadeia X→Y→W. Tolerante: sem a migration 128 (coluna
 * inexistente) devolve [] em silêncio — a média segue como antes.
 */
export async function carregarVinculosSubstituicao(): Promise<VinculoSubstituicao[]> {
  try {
    return await lerVinculos()
  } catch (e) {
    // Nunca derruba a tela que só queria a média.
    console.warn('Vínculos de substituição indisponíveis:', e)
    return []
  }
}

async function lerVinculos(): Promise<VinculoSubstituicao[]> {
  const [ri, rv] = await Promise.all([
    supabase
      .from('mat_itens')
      .select('id, substituido_por_id, substituido_por_variacao_id')
      .not('substituido_por_id', 'is', null),
    supabase
      .from('mat_item_variacoes')
      .select('id, item_id, substituido_por_id, substituido_por_variacao_id')
      .not('substituido_por_id', 'is', null),
  ])
  if (ri.error || rv.error) {
    const erro = ri.error ?? rv.error
    if (!estruturaAusente(erro, true)) console.warn('Vínculos de substituição indisponíveis:', erro?.message)
    return []
  }
  type Linha = { id: string; item_id?: string; substituido_por_id: string | null; substituido_por_variacao_id: string | null }
  const itens = ((ri.data ?? []) as Linha[]).map((i) => ({
    item_id: i.id,
    variacao_id: null,
    substituido_por_id: i.substituido_por_id as string,
    substituido_por_variacao_id: i.substituido_por_variacao_id ?? null,
  }))
  const variacoes = ((rv.data ?? []) as Linha[]).map((v) => ({
    item_id: v.item_id as string,
    variacao_id: v.id,
    substituido_por_id: v.substituido_por_id as string,
    substituido_por_variacao_id: v.substituido_por_variacao_id ?? null,
  }))
  return [...itens, ...variacoes]
}

export interface DadosPreviaSubstituicao {
  kit: LinhaKitSubst[]
  contratos: ContratoSubst[]
  vinculos: VinculoSubstituicao[]
}

export function useMateriaisSubstituicao() {
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  /** Linhas de kit da origem e do destino (todos os contratos) + contratos + vínculos. */
  const carregarPrevia = useCallback(async (deItemId: string, paraItemId: string): Promise<DadosPreviaSubstituicao | null> => {
    setCarregando(true)
    const ids = [...new Set([deItemId, paraItemId].filter(Boolean))]
    const [rk, rc, vinculos] = await Promise.all([
      selecionarTudo<LinhaKitSubst>((de, ate) =>
        supabase
          .from('mat_kit_itens')
          .select('id, contrato_id, item_id, variacao_id, quantidade, periodicidade_meses')
          .in('item_id', ids)
          .order('id')
          .range(de, ate)
      ),
      supabase.from('mat_contratos').select('id, nome, ativo').order('nome'),
      carregarVinculosSubstituicao(),
    ])
    setCarregando(false)
    const erro = rk.error ?? rc.error
    if (erro) {
      toast.error(mensagemErroMateriais(erro, 'carregar a prévia da substituição'))
      return null
    }
    return {
      kit: (rk.data ?? []).map((k) => ({ ...k, quantidade: Number(k.quantidade), periodicidade_meses: Number(k.periodicidade_meses ?? 1) })),
      contratos: (rc.data ?? []) as ContratoSubst[],
      vinculos,
    }
  }, [])

  /** Chama a RPC e confere o retorno (anti-falso-sucesso). */
  const substituir = useCallback(
    async (p: ParamsSubstituicao, inativar: boolean, levarHistorico: boolean): Promise<ResultadoSubstituicaoItem | null> => {
      setSalvando(true)
      const { data, error } = await supabase.rpc('mat_substituir_item_kits', {
        p_de: p.deItemId,
        p_de_variacao: p.deVariacaoId,
        p_para: p.paraItemId,
        p_para_variacao: p.paraVariacaoId,
        p_inativar: inativar,
        p_levar_historico: levarHistorico,
      })
      setSalvando(false)
      if (error) {
        toast.error(mensagemErroMateriais(error, 'substituir o item nos kits'))
        return null
      }
      const r = data as ResultadoSubstituicaoItem | null
      if (!r || typeof r.linhas_trocadas !== 'number') {
        toast.error('A substituição não confirmou o resultado — recarregue a tela e confira os kits.')
        return null
      }
      const partes: string[] = []
      if (r.linhas_trocadas === 0) partes.push('nenhum kit tinha o item')
      else
        partes.push(
          `${r.contratos} ${r.contratos === 1 ? 'contrato' : 'contratos'} atualizado${r.contratos === 1 ? '' : 's'}` +
            (r.contratos_com_soma > 0 ? ` (${r.contratos_com_soma} com quantidades somadas)` : '')
        )
      if (r.alteracoes_pendentes > 0) partes.push(`${r.alteracoes_pendentes} solicitação(ões) pendente(s) transferida(s)`)
      if (r.historico_vinculado) partes.push('histórico levado para a média do novo item')
      if (r.inativado) partes.push('origem inativada')
      toast.success(`Substituição concluída: ${partes.join('; ')}.`)
      return r
    },
    []
  )

  return { carregando, salvando, carregarPrevia, substituir }
}
