import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ReciboExtra } from '@/types/extras'

const COLUNAS_RECIBO_EXTRA = 'id, colaborador_id, colaborador_nome, data_inicio, data_fim, valor_total, quantidade_extras, assinatura_colaborador, extras_ids, marcar_pago, status, data_assinatura, usuario_id, created_at, updated_at'

export function useExtrasRecibos() {
  const [recibos, setRecibos] = useState<ReciboExtra[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (filtros?: { dataInicio?: string; dataFim?: string; colaboradorId?: string; status?: ReciboExtra['status'] }) => {
    setLoading(true)
    try {
      let query = supabase
        .from('recibos_extras')
        .select(COLUNAS_RECIBO_EXTRA)
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
      const { data, error } = await supabase.from('recibos_extras').insert(dados).select(COLUNAS_RECIBO_EXTRA).single()
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

  const assinar = useCallback(async (id: string, assinaturaBase64: string, marcarPago = false): Promise<ReciboExtra | null> => {
    try {
      // RPC transacional: atualiza o recibo e marca os extras como Pago na
      // mesma operação — nunca fica "recibo pago com extras pendentes".
      const { error: rpcError } = await supabase.rpc('assinar_recibo_extras', {
        p_recibo_id: id,
        p_assinatura_base64: assinaturaBase64,
        p_marcar_pago: marcarPago,
      })
      if (rpcError) throw rpcError

      const { data, error } = await supabase
        .from('recibos_extras')
        .select(COLUNAS_RECIBO_EXTRA)
        .eq('id', id)
        .single()

      if (error) throw error

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
      // Cancela o recibo e reverte os extras para Pendente na mesma transação,
      // preservando a trilha de auditoria (antes era delete sem reversão).
      const { error } = await supabase.rpc('cancelar_recibo_extras', { p_recibo_id: id })
      if (error) throw error
      toast.success('Recibo cancelado e extras revertidos para pendente')
      setRecibos(prev => prev.filter(r => r.id !== id))
      return true
    } catch (err: unknown) {
      console.error('Erro ao cancelar recibo:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar recibo')
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
