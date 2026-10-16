import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { estruturaAusente, mensagemErroMateriais } from '@/lib/materiais/erros'
import { selecionarTudo } from '@/lib/materiais/paginar'
import type { MatItem, MatItemVariacao, MatPreco } from '@/types/materiais'

// Catálogo de materiais (migration 121): itens, variações e histórico de
// preços. Preço nunca é alterado — cada mudança é uma linha nova.

const COLUNAS_ITEM =
  'id, nome, categoria, unidade_pedido, fornecedor_id, validade_meses, tem_variacao, ativo, ordem, created_at, nome_lider, contratos_exclusivos'
const COLUNAS_VARIACAO = 'id, item_id, rotulo, ativo, ordem, created_at, oculta_lider'
const COLUNAS_PRECO = 'id, item_id, variacao_id, fornecedor_id, preco, vigente_desde, criado_por, created_at'

export type ItemMaterialInput = Pick<
  MatItem,
  'nome' | 'categoria' | 'unidade_pedido' | 'fornecedor_id' | 'validade_meses' | 'tem_variacao' | 'ativo'
>

/** Visão do líder do item (migration 136). */
export interface VisaoLiderInput {
  nome_lider: string | null
  contratos_exclusivos: string[] | null
}

/** Contrato de pedido (só o necessário para o seletor "Exclusivo dos contratos"). */
export interface ContratoResumo {
  id: string
  nome: string
  ativo: boolean
}

export type NovoPrecoInput = Pick<MatPreco, 'item_id' | 'variacao_id' | 'fornecedor_id' | 'preco' | 'vigente_desde'>

/** Confere a escrita: erro → toast; 0 linhas (RLS) → toast de permissão. */
function escritaOk(
  resultado: { data: unknown[] | null; error: { code?: string; message?: string } | null },
  acao: string
): boolean {
  if (resultado.error) {
    toast.error(mensagemErroMateriais(resultado.error, acao))
    return false
  }
  if (!resultado.data || resultado.data.length === 0) {
    toast.error(`Sem permissão para ${acao}.`)
    return false
  }
  return true
}

export function useMateriaisCatalogo() {
  const [itens, setItens] = useState<MatItem[]>([])
  const [variacoes, setVariacoes] = useState<MatItemVariacao[]>([])
  const [precos, setPrecos] = useState<MatPreco[]>([])
  const [contratos, setContratos] = useState<ContratoResumo[]>([])
  const [loading, setLoading] = useState(false)
  const [estruturaPendente, setEstruturaPendente] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const [ri, rv, rp, rc] = await Promise.all([
      supabase.from('mat_itens').select(COLUNAS_ITEM).order('nome'),
      supabase.from('mat_item_variacoes').select(COLUNAS_VARIACAO).order('ordem', { nullsFirst: false }).order('rotulo'),
      selecionarTudo<MatPreco>((de, ate) =>
        supabase.from('mat_precos').select(COLUNAS_PRECO).order('id').range(de, ate)
      ),
      supabase.from('mat_contratos').select('id, nome, ativo').order('nome'),
    ])
    const erro = ri.error ?? rv.error ?? rp.error
    if (erro) {
      if (estruturaAusente(erro)) setEstruturaPendente(true)
      else toast.error(mensagemErroMateriais(erro, 'carregar o catálogo'))
    } else {
      setEstruturaPendente(false)
      setItens((ri.data as MatItem[]) ?? [])
      setVariacoes((rv.data as MatItemVariacao[]) ?? [])
      setPrecos((rp.data ?? []).map((p) => ({ ...p, preco: Number(p.preco) })))
      setContratos(rc.error ? [] : ((rc.data as ContratoResumo[]) ?? []))
    }
    setLoading(false)
  }, [])

  const salvarItem = useCallback(async (dados: ItemMaterialInput, id?: string | null) => {
    const resultado = id
      ? await supabase.from('mat_itens').update(dados).eq('id', id).select('id')
      : await supabase.from('mat_itens').insert(dados).select('id')
    if (!escritaOk(resultado, id ? 'atualizar o item' : 'cadastrar o item')) return null
    toast.success(id ? 'Item atualizado' : 'Item cadastrado')
    return (resultado.data?.[0] as { id: string } | undefined)?.id ?? null
  }, [])

  const salvarVariacao = useCallback(async (itemId: string, rotulo: string, id?: string | null) => {
    const resultado = id
      ? await supabase.from('mat_item_variacoes').update({ rotulo }).eq('id', id).select('id')
      : await supabase.from('mat_item_variacoes').insert({ item_id: itemId, rotulo }).select('id')
    if (!escritaOk(resultado, id ? 'atualizar a variação' : 'cadastrar a variação')) return false
    toast.success(id ? 'Variação atualizada' : 'Variação cadastrada')
    return true
  }, [])

  const alternarVariacao = useCallback(async (id: string, ativo: boolean) => {
    const resultado = await supabase.from('mat_item_variacoes').update({ ativo }).eq('id', id).select('id')
    if (!escritaOk(resultado, ativo ? 'reativar a variação' : 'inativar a variação')) return false
    toast.success(ativo ? 'Variação reativada' : 'Variação inativada')
    return true
  }, [])

  /** Nome para o líder e contratos exclusivos (migration 136). */
  const salvarVisaoLider = useCallback(async (id: string, dados: VisaoLiderInput) => {
    const nome = dados.nome_lider?.trim() || null
    const lista = dados.contratos_exclusivos?.length ? dados.contratos_exclusivos : null
    const resultado = await supabase
      .from('mat_itens')
      .update({ nome_lider: nome, contratos_exclusivos: lista })
      .eq('id', id)
      .select('id')
    if (!escritaOk(resultado, 'salvar o que o líder vê')) return false
    toast.success('Link do líder atualizado')
    return true
  }, [])

  /** "Esconder do líder (é marca)" na variação (migration 136). */
  const alternarOcultaLider = useCallback(async (id: string, oculta: boolean) => {
    const resultado = await supabase.from('mat_item_variacoes').update({ oculta_lider: oculta }).eq('id', id).select('id')
    if (!escritaOk(resultado, 'alterar a variação no link do líder')) return false
    toast.success(oculta ? 'Variação escondida do líder' : 'Variação visível para o líder')
    return true
  }, [])

  const registrarPreco = useCallback(async (dados: NovoPrecoInput) => {
    const resultado = await supabase.from('mat_precos').insert(dados).select('id')
    if (!escritaOk(resultado, 'registrar o preço')) return false
    toast.success('Novo preço registrado')
    return true
  }, [])

  return {
    itens,
    variacoes,
    precos,
    contratos,
    loading,
    estruturaPendente,
    carregar,
    salvarItem,
    salvarVariacao,
    alternarVariacao,
    salvarVisaoLider,
    alternarOcultaLider,
    registrarPreco,
  }
}

export { escritaOk as escritaMateriaisOk }
