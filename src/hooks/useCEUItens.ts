import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ItemCEU } from '@/types/database'

export function useCEUItens() {
  const [itens, setItens] = useState<ItemCEU[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (filtros?: { busca?: string; tipo?: string; fornecedorId?: string }) => {
    setLoading(true)
    let query = supabase
      .from('itens')
      .select('*, fornecedor:fornecedor_id(*)')
      .order('nome')

    if (filtros?.busca) {
      query = query.or(`nome.ilike.%${filtros.busca}%,ca.ilike.%${filtros.busca}%`)
    }
    if (filtros?.tipo && filtros.tipo !== 'todos') {
      query = query.eq('tipo', filtros.tipo)
    }
    if (filtros?.fornecedorId && filtros.fornecedorId !== 'todos') {
      query = query.eq('fornecedor_id', filtros.fornecedorId)
    }

    const { data, error } = await query
    if (error) {
      toast.error('Erro ao carregar itens: ' + error.message)
    } else {
      setItens((data as ItemCEU[]) || [])
    }
    setLoading(false)
  }, [])

  const criar = useCallback(async (item: Partial<ItemCEU>) => {
    const { data, error } = await supabase.from('itens').insert(item).select().single()
    if (error) {
      toast.error('Erro ao criar item: ' + error.message)
      return null
    }
    toast.success('Item criado com sucesso')
    return data as ItemCEU
  }, [])

  const atualizar = useCallback(async (id: string, item: Partial<ItemCEU>) => {
    const { error } = await supabase.from('itens').update(item).eq('id', id)
    if (error) {
      toast.error('Erro ao atualizar item: ' + error.message)
      return false
    }
    toast.success('Item atualizado com sucesso')
    return true
  }, [])

  const remover = useCallback(async (id: string) => {
    const { error } = await supabase.from('itens').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao remover item: ' + error.message)
      return false
    }
    toast.success('Item removido com sucesso')
    return true
  }, [])

  const buscarPorId = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('itens')
      .select('*, fornecedor:fornecedor_id(*)')
      .eq('id', id)
      .single()
    if (error) {
      toast.error('Erro ao buscar item: ' + error.message)
      return null
    }
    return data as ItemCEU
  }, [])

  return { itens, loading, listar, criar, atualizar, remover, buscarPorId }
}
