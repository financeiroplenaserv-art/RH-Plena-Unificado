import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { MapeamentoFlitLocalTrabalho } from '@/types/database'

export function useEscalasMapeamento() {
  const [mapeamentos, setMapeamentos] = useState<MapeamentoFlitLocalTrabalho[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mapeamento_flit_local_trabalho')
        .select('*, local_trabalho:locais_trabalho(*)')
        .eq('ativo', true)
        .order('tipo_match')
        .order('valor_flit')
      if (error) throw error
      setMapeamentos((data || []) as unknown as MapeamentoFlitLocalTrabalho[])
      return (data || []) as unknown as MapeamentoFlitLocalTrabalho[]
    } catch (err: unknown) {
      console.error('Erro ao carregar mapeamentos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar mapeamentos')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(async (mapeamento: Omit<MapeamentoFlitLocalTrabalho, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('mapeamento_flit_local_trabalho')
        .insert(mapeamento as Partial<MapeamentoFlitLocalTrabalho>)
        .select()
        .single()
      if (error) throw error
      toast.success('Mapeamento criado')
      await listar()
      return data as MapeamentoFlitLocalTrabalho
    } catch (err: unknown) {
      console.error('Erro ao criar mapeamento:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao criar mapeamento')
      return null
    }
  }, [listar])

  const remover = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('mapeamento_flit_local_trabalho')
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Mapeamento removido')
      await listar()
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover mapeamento:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover mapeamento')
      return false
    }
  }, [listar])

  return { mapeamentos, loading, listar, criar, remover }
}
