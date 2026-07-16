import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ReciboExtra } from '@/types/extras'

export function useExtrasRecibos() {
  const [recibos, setRecibos] = useState<ReciboExtra[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (filtros?: { dataInicio?: string; dataFim?: string; colaboradorId?: string; status?: ReciboExtra['status'] }) => {
    setLoading(true)
    try {
      let query = supabase
        .from('recibos_extras')
        .select('*')
        .order('created_at', { ascending: false })

      if (filtros?.dataInicio) {
        query = query.gte('data_inicio', filtros.dataInicio)
      }
      if (filtros?.dataFim) {
        query = query.lte('data_fim', filtros.dataFim)
      }
      if (filtros?.colaboradorId) {
        query = query.eq('colaborador_id', filtros.colaboradorId)
      }
      if (filtros?.status) {
        query = query.eq('status', filtros.status)
      }

      const { data, error } = await query
      if (error) throw error
      setRecibos(data || [])
      return data || []
    } catch (err: unknown) {
      console.error('Erro ao carregar recibos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar recibos')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(async (dados: Omit<ReciboExtra, 'id' | 'created_at' | 'updated_at'>): Promise<ReciboExtra | null> => {
    try {
      const { data, error } = await supabase.from('recibos_extras').insert(dados).select().single()
      if (error) throw error

      toast.success('Recibo gerado com sucesso')
      setRecibos(prev => [data as ReciboExtra, ...prev])
      return data as ReciboExtra
    } catch (err: unknown) {
      console.error('Erro ao gerar recibo:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar recibo')
      return null
    }
  }, [])

  const assinar = useCallback(async (id: string, assinaturaBase64: string, marcarPago = false, extrasIds: string[] = []): Promise<ReciboExtra | null> => {
    try {
      const { data, error } = await supabase
        .from('recibos_extras')
        .update({
          assinatura_colaborador: assinaturaBase64,
          status: 'assinado',
          data_assinatura: new Date().toISOString(),
          marcar_pago: marcarPago,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (marcarPago && extrasIds.length > 0) {
        const { error: updateError } = await supabase
          .from('extras')
          .update({ status: 'Pago' })
          .in('id', extrasIds)
        if (updateError) throw updateError
      }

      toast.success('Recibo assinado com sucesso')
      setRecibos(prev => prev.map(r => r.id === id ? (data as ReciboExtra) : r))
      return data as ReciboExtra
    } catch (err: unknown) {
      console.error('Erro ao assinar recibo:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao assinar recibo')
      return null
    }
  }, [])

  const remover = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('recibos_extras').delete().eq('id', id)
      if (error) throw error
      toast.success('Recibo removido')
      setRecibos(prev => prev.filter(r => r.id !== id))
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover recibo:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover recibo')
      return false
    }
  }, [])

  return {
    recibos,
    loading,
    listar,
    criar,
    assinar,
    remover,
  }
}
