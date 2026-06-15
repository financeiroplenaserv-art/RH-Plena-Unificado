import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Ocorrencia, StatusOcorrencia } from '@/types/database'

export interface FiltrosOcorrencia {
  colaborador_id?: string
  status?: string
  tipo?: string
  empresa_id?: string
  macro_grupo?: string
  busca?: string
}

export function useOcorrencias() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (filtros: FiltrosOcorrencia = {}) => {
    setLoading(true)
    try {
      let query = supabase
        .from('ocorrencias')
        .select('*, colaborador:colaborador_id(*), total_anexos:ocorrencia_anexos(count)')
        .order('data_ocorrencia', { ascending: false })

      if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id)
      if (filtros.status) query = query.eq('status', filtros.status)
      if (filtros.tipo) query = query.eq('tipo_ocorrencia', filtros.tipo)
      if (filtros.empresa_id) query = query.eq('empresa_id', filtros.empresa_id)
      if (filtros.macro_grupo) query = query.eq('macro_grupo', filtros.macro_grupo)

      const { data, error } = await query

      if (error) {
        toast.error('Erro ao carregar ocorrências: ' + error.message)
        return
      }

      let resultado = (data as Ocorrencia[]) || []

      if (filtros.busca) {
        const termo = filtros.busca.toLowerCase()
        resultado = resultado.filter(
          (o) =>
            o.colaborador?.nome_completo?.toLowerCase().includes(termo) ||
            o.tipo_ocorrencia?.toLowerCase().includes(termo) ||
            o.titulo?.toLowerCase().includes(termo)
        )
      }

      setOcorrencias(resultado)
    } finally {
      setLoading(false)
    }
  }, [])

  const buscarPorId = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('ocorrencias')
      .select('*, colaborador:colaborador_id(*)')
      .eq('id', id)
      .single()

    if (error) {
      toast.error('Erro ao carregar ocorrência: ' + error.message)
      return null
    }

    return data as Ocorrencia
  }, [])

  const criar = useCallback(async (payload: Partial<Ocorrencia>) => {
    const { data, error } = await supabase
      .from('ocorrencias')
      .insert(payload)
      .select()
      .single()

    if (error) {
      toast.error('Erro ao registrar ocorrência: ' + error.message)
      return null
    }

    return data as Ocorrencia
  }, [])

  const atualizar = useCallback(async (id: string, payload: Partial<Ocorrencia>) => {
    const { data, error } = await supabase
      .from('ocorrencias')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      toast.error('Erro ao atualizar ocorrência: ' + error.message)
      return null
    }

    return data as Ocorrencia
  }, [])

  const cancelar = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('ocorrencias')
      .update({ status: 'Cancelada' as StatusOcorrencia })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao cancelar ocorrência: ' + error.message)
      return false
    }

    toast.success('Ocorrência cancelada')
    return true
  }, [])

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase.from('ocorrencias').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir ocorrência: ' + error.message)
      return false
    }

    toast.success('Ocorrência removida')
    return true
  }, [])

  return {
    ocorrencias,
    loading,
    listar,
    buscarPorId,
    criar,
    atualizar,
    cancelar,
    excluir,
  }
}
