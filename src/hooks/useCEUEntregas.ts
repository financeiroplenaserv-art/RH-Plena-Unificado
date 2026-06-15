import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { EntregaCEU } from '@/types/database'

export function useCEUEntregas() {
  const [entregas, setEntregas] = useState<EntregaCEU[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (filtros?: {
    colaboradorId?: string
    itemId?: string
    dataInicio?: string
    dataFim?: string
    emAberto?: boolean
  }) => {
    setLoading(true)
    let query = supabase
      .from('entregas')
      .select('*, colaborador:colaborador_id(*), item:item_id(*)')
      .order('data_entrega', { ascending: false })

    if (filtros?.colaboradorId && filtros.colaboradorId.trim() !== '' && filtros.colaboradorId !== ' ') {
      query = query.eq('colaborador_id', filtros.colaboradorId)
    }
    if (filtros?.itemId && filtros.itemId.trim() !== '' && filtros.itemId !== 'todos') {
      query = query.eq('item_id', filtros.itemId)
    }
    if (filtros?.dataInicio && filtros.dataInicio.trim() !== '' && filtros.dataInicio !== ' ') {
      query = query.gte('data_entrega', filtros.dataInicio)
    }
    if (filtros?.dataFim && filtros.dataFim.trim() !== '' && filtros.dataFim !== ' ') {
      query = query.lte('data_entrega', filtros.dataFim)
    }
    if (filtros?.emAberto) {
      query = query.is('data_devolucao', null)
    }

    const { data, error } = await query
    if (error) {
      toast.error('Erro ao carregar entregas: ' + error.message)
    } else {
      setEntregas((data as EntregaCEU[]) || [])
    }
    setLoading(false)
    return (data as EntregaCEU[]) || []
  }, [])

  const criar = useCallback(async (entrega: Partial<EntregaCEU>) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      toast.error('Usuário não autenticado')
      return null
    }

    const { data, error } = await supabase
      .from('entregas')
      .insert({ ...entrega, usuario_id: userData.user.id })
      .select()
      .single()
    if (error) {
      toast.error('Erro ao registrar entrega: ' + error.message)
      return null
    }
    toast.success('Entrega registrada com sucesso')
    return data as EntregaCEU
  }, [])

  const devolver = useCallback(async (id: string, dataDevolucao: string) => {
    const { error } = await supabase
      .from('entregas')
      .update({ data_devolucao: dataDevolucao })
      .eq('id', id)
    if (error) {
      toast.error('Erro ao registrar devolução: ' + error.message)
      return false
    }
    toast.success('Devolução registrada com sucesso')
    return true
  }, [])

  const marcarReciboEmitido = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('entregas')
      .update({ recibo_emitido: true })
      .eq('id', id)
    if (error) {
      toast.error('Erro ao marcar recibo: ' + error.message)
      return false
    }
    return true
  }, [])

  const marcarLoteReciboEmitido = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return true
    const { error } = await supabase
      .from('entregas')
      .update({ recibo_emitido: true })
      .in('id', ids)
    if (error) {
      toast.error('Erro ao marcar recibos em lote: ' + error.message)
      return false
    }
    return true
  }, [])

  const remover = useCallback(async (id: string) => {
    const { error } = await supabase.from('entregas').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao remover entrega: ' + error.message)
      return false
    }
    toast.success('Entrega removida com sucesso')
    return true
  }, [])

  return { entregas, loading, listar, criar, devolver, marcarReciboEmitido, marcarLoteReciboEmitido, remover }
}
