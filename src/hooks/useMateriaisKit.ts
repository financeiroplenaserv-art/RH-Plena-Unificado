import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { hojeBrasil } from '@/lib/utils'
import { adicionarMeses, competenciaDe } from '@/lib/materiais/datas'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import type { ConsumoMes } from '@/lib/materiais/media'
import { escritaMateriaisOk } from './useMateriaisCatalogo'
import type { MatKitAlteracao, MatKitItem, StatusAlteracaoKit } from '@/types/materiais'

// Kit Mensal do contrato (mat_kit_itens) e solicitações de alteração
// (mat_kit_alteracoes). Edição direta: gestor (RLS pode_aprovar_materiais).
// Mesa/inspetoria pedem alteração; vale só depois da decisão do gestor (RPC
// decidir_alteracao_kit, que aplica no kit na mesma transação).

const COLUNAS_KIT = 'id, contrato_id, item_id, variacao_id, quantidade, periodicidade_meses, observacao, atualizado_por, updated_at'
const COLUNAS_ALTERACAO =
  'id, contrato_id, item_id, variacao_id, quantidade_nova, motivo, solicitado_por, solicitado_em, status, decidido_por, decidido_em, comentario_decisao'

export type LinhaKitInput = Pick<MatKitItem, 'item_id' | 'variacao_id' | 'quantidade' | 'periodicidade_meses' | 'observacao'>
export type SolicitacaoKitInput = Pick<MatKitAlteracao, 'contrato_id' | 'item_id' | 'variacao_id' | 'quantidade_nova' | 'motivo'>

export function useMateriaisKit() {
  const [kit, setKit] = useState<MatKitItem[]>([])
  const [consumos, setConsumos] = useState<ConsumoMes[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (contratoId: string) => {
    setLoading(true)
    // 12 meses fechados bastam para as médias de 6 e 12 meses
    const desde = adicionarMeses(competenciaDe(hojeBrasil()), -12)
    const [rk, rh] = await Promise.all([
      supabase.from('mat_kit_itens').select(COLUNAS_KIT).eq('contrato_id', contratoId),
      selecionarTudo<ConsumoMes>((de, ate) =>
        supabase
          .from('mat_historico_consumo')
          .select('competencia, item_id, variacao_id, quantidade')
          .eq('contrato_id', contratoId)
          .gte('competencia', desde)
          .order('id')
          .range(de, ate)
      ),
    ])
    const erro = rk.error ?? rh.error
    if (erro) {
      if (estruturaAusente(erro)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(erro, 'carregar o Kit Mensal'))
      setKit([])
      setConsumos([])
    } else {
      setEstruturaPendente(false)
      setKit(((rk.data as MatKitItem[]) ?? []).map((k) => ({ ...k, quantidade: Number(k.quantidade) })))
      setConsumos((rh.data ?? []).map((c) => ({ ...c, quantidade: Number(c.quantidade) })))
    }
    setLoading(false)
  }, [])

  const salvarLinha = useCallback(async (contratoId: string, dados: LinhaKitInput, id?: string | null) => {
    const resultado = id
      ? await supabase.from('mat_kit_itens').update(dados).eq('id', id).select('id')
      : await supabase.from('mat_kit_itens').insert({ ...dados, contrato_id: contratoId }).select('id')
    if (!escritaMateriaisOk(resultado, id ? 'atualizar o item do kit' : 'incluir o item no kit')) return false
    toast.success(id ? 'Kit atualizado' : 'Item incluído no kit')
    return true
  }, [])

  const removerLinha = useCallback(async (id: string) => {
    const resultado = await supabase.from('mat_kit_itens').delete().eq('id', id).select('id')
    if (!escritaMateriaisOk(resultado, 'retirar o item do kit')) return false
    toast.success('Item retirado do kit')
    return true
  }, [])

  const solicitarAlteracao = useCallback(async (dados: SolicitacaoKitInput) => {
    const resultado = await supabase
      .from('mat_kit_alteracoes')
      .insert({ ...dados, status: 'pendente' })
      .select('id')
    if (!escritaMateriaisOk(resultado, 'solicitar a alteração do kit')) return false
    toast.success('Solicitação enviada — vale depois da aprovação do gestor')
    return true
  }, [])

  return { kit, consumos, loading, estruturaPendente, carregar, salvarLinha, removerLinha, solicitarAlteracao }
}

export function useMateriaisAlteracoesKit() {
  const [alteracoes, setAlteracoes] = useState<MatKitAlteracao[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (status?: string) => {
    setLoading(true)
    let query = supabase.from('mat_kit_alteracoes').select(COLUNAS_ALTERACAO).order('solicitado_em', { ascending: false }).limit(500)
    if (status && status !== 'todos') query = query.eq('status', status as StatusAlteracaoKit)
    const { data, error } = await query
    if (error) {
      if (estruturaAusente(error)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(error, 'carregar as alterações de kit'))
    } else {
      setEstruturaPendente(false)
      setAlteracoes(((data as MatKitAlteracao[]) ?? []).map((a) => ({ ...a, quantidade_nova: Number(a.quantidade_nova) })))
    }
    setLoading(false)
  }, [])

  const decidir = useCallback(async (id: string, aprovar: boolean, comentario: string | null) => {
    const { error } = await supabase.rpc('decidir_alteracao_kit', { p_id: id, p_aprovar: aprovar, p_comentario: comentario })
    if (error) {
      toast.error(mensagemErroMateriais(error, 'decidir a alteração'))
      return false
    }
    toast.success(aprovar ? 'Alteração aprovada e aplicada no kit' : 'Alteração rejeitada')
    return true
  }, [])

  return { alteracoes, loading, estruturaPendente, carregar, decidir }
}
