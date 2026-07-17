import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Empresa } from '@/types/database'

const COLUNAS_EMPRESA = 'id, nome, cnpj, codigo_alterdata, created_at'

export function useEmpresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('empresas')
      .select(COLUNAS_EMPRESA)
      .order('nome')

    if (error) {
      toast.error('Erro ao carregar empresas: ' + error.message)
    } else {
      setEmpresas((data || []) as Empresa[])
    }
    setLoading(false)
    return (data || []) as Empresa[]
  }, [])

  const criar = useCallback(async (empresa: Omit<Empresa, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('empresas')
      .insert(empresa as Partial<Empresa>)
      .select(COLUNAS_EMPRESA)
      .single()

    if (error) {
      toast.error('Erro ao criar empresa: ' + error.message)
      return null
    }
    toast.success('Empresa criada com sucesso')
    await listar()
    return data as Empresa
  }, [listar])

  const atualizar = useCallback(async (id: string, empresa: Partial<Omit<Empresa, 'id' | 'created_at'>>) => {
    const { error } = await supabase
      .from('empresas')
      .update(empresa as Partial<Empresa>)
      .eq('id', id)

    if (error) {
      toast.error('Erro ao atualizar empresa: ' + error.message)
      return false
    }
    toast.success('Empresa atualizada')
    await listar()
    return true
  }, [listar])

  const remover = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Erro ao remover empresa: ' + error.message)
      return false
    }
    toast.success('Empresa removida')
    await listar()
    return true
  }, [listar])

  return { empresas, loading, listar, criar, atualizar, remover }
}
