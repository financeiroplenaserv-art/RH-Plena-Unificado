import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ResultadoVR } from '@/types'

export function useResultadosVR() {
  const [resultados, setResultados] = useState<ResultadoVR[]>([])
  const [loading, setLoading] = useState(false)

  const listarPorProjeto = useCallback(async (projetoId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('resultados_vr')
        .select('*, colaborador:colaborador_id(*)')
        .eq('projeto_id', projetoId)
        .order('created_at', { ascending: true })

      if (error) {
        toast.error('Erro ao carregar resultados: ' + error.message)
        return
      }

      setResultados((data as ResultadoVR[]) || [])
    } catch (err: unknown) {
      console.error('Erro inesperado ao carregar resultados VR:', err)
      toast.error(err instanceof Error ? err.message : 'Erro inesperado ao carregar resultados')
    } finally {
      setLoading(false)
    }
  }, [])

  const salvarLote = useCallback(async (projetoId: string, items: Partial<ResultadoVR>[]) => {
    // Remove resultados antigos do projeto
    const { error: erroDelete } = await supabase.from('resultados_vr').delete().eq('projeto_id', projetoId)
    if (erroDelete) {
      toast.error('Erro ao limpar resultados anteriores: ' + erroDelete.message)
      return false
    }

    if (items.length === 0) return true

    const { error } = await supabase.from('resultados_vr').insert(items as Partial<ResultadoVR>[])

    if (error) {
      toast.error('Erro ao salvar resultados: ' + error.message)
      return false
    }

    toast.success('Resultados salvos')
    return true
  }, [])

  const atualizar = useCallback(async (id: string, payload: Partial<ResultadoVR>) => {
    const { data, error } = await supabase
      .from('resultados_vr')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      toast.error('Erro ao atualizar resultado: ' + error.message)
      return null
    }

    return data as ResultadoVR
  }, [])

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase.from('resultados_vr').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao remover resultado: ' + error.message)
      return false
    }

    return true
  }, [])

  return {
    resultados,
    loading,
    listarPorProjeto,
    salvarLote,
    atualizar,
    excluir,
  }
}
