import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ModeloOcorrencia } from '@/types/database'

export function useModelos() {
  const [modelos, setModelos] = useState<ModeloOcorrencia[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('modelos_ocorrencia')
      .select('*')
      .order('tipo')

    if (error) {
      toast.error('Erro ao carregar modelos: ' + error.message)
    } else {
      setModelos((data as ModeloOcorrencia[]) || [])
    }
    setLoading(false)
  }, [])

  const criar = useCallback(async (payload: Partial<ModeloOcorrencia>) => {
    const { data, error } = await supabase
      .from('modelos_ocorrencia')
      .insert(payload)
      .select()
      .single()

    if (error) {
      toast.error('Erro ao criar modelo: ' + error.message)
      return null
    }

    setModelos((prev) => [...prev, data as ModeloOcorrencia])
    return data as ModeloOcorrencia
  }, [])

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('modelos_ocorrencia')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Erro ao excluir modelo: ' + error.message)
      return false
    }

    setModelos((prev) => prev.filter((m) => m.id !== id))
    return true
  }, [])

  return { modelos, loading, listar, criar, excluir }
}
