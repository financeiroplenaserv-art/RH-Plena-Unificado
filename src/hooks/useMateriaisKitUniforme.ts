import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import type { ItemCeuCadastro } from '@/lib/materiais/pecasCeu'
import type { MatContratoCeuItem } from '@/types/materiais'
import { escritaMateriaisOk } from './useMateriaisCatalogo'

// Kit de uniforme/EPI do contrato (mat_contrato_ceu_itens, migration 129):
// as peças que o líder vê no link, com a função a que se destinam. É
// referência para o líder escolher, não limite de quantidade. Escrita:
// pode_editar_kit_uniforme() (admin, adm, gestor, dp2) — sempre .select('id').

const COLUNAS = 'id, contrato_id, item_id, rotulo, funcoes, ordem, ativo, origem, observacao, updated_at'

export type PecaContratoInput = Pick<MatContratoCeuItem, 'item_id' | 'rotulo' | 'funcoes' | 'ordem' | 'ativo'>

export function useMateriaisKitUniforme() {
  const [linhas, setLinhas] = useState<MatContratoCeuItem[]>([])
  const [itensCeu, setItensCeu] = useState<ItemCeuCadastro[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async (contratoId: string) => {
    setLoading(true)
    const [rl, ri] = await Promise.all([
      supabase.from('mat_contrato_ceu_itens').select(COLUNAS).eq('contrato_id', contratoId).order('ordem', { nullsFirst: false }),
      supabase.from('itens').select('id, nome, tipo, situacao').in('tipo', ['Uniforme', 'EPI']).order('nome'),
    ])
    if (rl.error) {
      if (estruturaAusente(rl.error)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(rl.error, 'carregar as peças de uniforme do contrato'))
      setLinhas([])
    } else {
      setEstruturaPendente(false)
      setLinhas(((rl.data as MatContratoCeuItem[]) ?? []).map((l) => ({ ...l, funcoes: l.funcoes ?? [] })))
    }
    if (ri.error) toast.error(mensagemErroMateriais(ri.error, 'carregar os itens do CEU'))
    setItensCeu(
      ((ri.data as { id: string; nome: string; tipo: string; situacao: string | null }[]) ?? []).map((i) => ({
        id: i.id,
        nome: i.nome,
        tipo: i.tipo === 'EPI' ? 'epi' : 'uniforme',
        ativo: !i.situacao || i.situacao.toUpperCase() === 'A',
      }))
    )
    setLoading(false)
  }, [])

  const salvar = useCallback(async (contratoId: string, dados: PecaContratoInput, id?: string | null) => {
    const resultado = id
      ? await supabase.from('mat_contrato_ceu_itens').update(dados).eq('id', id).select('id')
      : await supabase.from('mat_contrato_ceu_itens').insert({ ...dados, contrato_id: contratoId, origem: 'manual' }).select('id')
    if (!escritaMateriaisOk(resultado, id ? 'atualizar a peça' : 'incluir a peça')) return false
    toast.success(id ? 'Peça atualizada' : 'Peça incluída')
    return true
  }, [])

  const remover = useCallback(async (id: string) => {
    const resultado = await supabase.from('mat_contrato_ceu_itens').delete().eq('id', id).select('id')
    if (!escritaMateriaisOk(resultado, 'retirar a peça')) return false
    toast.success('Peça retirada do contrato')
    return true
  }, [])

  return { linhas, itensCeu, loading, estruturaPendente, carregar, salvar, remover }
}
