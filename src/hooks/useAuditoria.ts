import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { AuditoriaLog } from '@/types/database'

export interface FiltrosAuditoria {
  tabela?: string
  registroId?: string
}

export function useAuditoria() {
  const [logs, setLogs] = useState<AuditoriaLog[]>([])
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(async (filtros: FiltrosAuditoria = {}) => {
    setLoading(true)
    let query = supabase
      .from('log_auditoria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (filtros.tabela) query = query.eq('tabela', filtros.tabela)
    if (filtros.registroId) query = query.eq('registro_id', filtros.registroId)

    const { data, error } = await query

    if (error) {
      toast.error('Erro ao carregar auditoria: ' + error.message)
    } else {
      setLogs((data as AuditoriaLog[]) || [])
    }
    setLoading(false)
  }, [])

  const registrar = useCallback(
    async (payload: Partial<AuditoriaLog>) => {
      const { error } = await supabase.from('log_auditoria').insert(payload)
      if (error) {
        console.warn('Erro ao registrar auditoria:', error.message)
      }
    },
    []
  )

  return { logs, loading, loadLogs, registrar }
}
