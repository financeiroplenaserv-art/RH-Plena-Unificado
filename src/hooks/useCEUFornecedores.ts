import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Fornecedor } from '@/types/database'

const COLUNAS_FORNECEDOR = 'id, nome, cnpj, telefone, email, created_at'

export function useCEUFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (busca?: string) => {
    setLoading(true)
    let query = supabase.from('fornecedores').select(COLUNAS_FORNECEDOR).order('nome')
    if (busca) {
      query = query.or(`nome.ilike.%${busca}%,cnpj.ilike.%${busca}%`)
    }
    const { data, error } = await query
    if (error) {
      toast.error('Erro ao carregar fornecedores: ' + error.message)
    } else {
      setFornecedores((data as Fornecedor[]) || [])
    }
    setLoading(false)
  }, [])

  const criar = useCallback(async (fornecedor: Partial<Fornecedor>) => {
    const { data, error } = await supabase.from('fornecedores').insert(fornecedor).select(COLUNAS_FORNECEDOR).single()
    if (error) {
      toast.error('Erro ao criar fornecedor: ' + error.message)
      return null
    }
    toast.success('Fornecedor criado com sucesso')
    return data as Fornecedor
  }, [])

  const atualizar = useCallback(async (id: string, fornecedor: Partial<Fornecedor>) => {
    const { error } = await supabase.from('fornecedores').update(fornecedor).eq('id', id)
    if (error) {
      toast.error('Erro ao atualizar fornecedor: ' + error.message)
      return false
    }
    toast.success('Fornecedor atualizado com sucesso')
    return true
  }, [])

  const remover = useCallback(async (id: string) => {
    const { error } = await supabase.from('fornecedores').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao remover fornecedor: ' + error.message)
      return false
    }
    toast.success('Fornecedor removido com sucesso')
    return true
  }, [])

  return { fornecedores, loading, listar, criar, atualizar, remover }
}
