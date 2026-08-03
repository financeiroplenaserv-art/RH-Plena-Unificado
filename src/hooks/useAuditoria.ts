import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { AuditoriaLog } from '@/types/database'

const COLUNAS_AUDITORIA = 'id, tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id, created_at'

export interface FiltrosAuditoria {
  tabela?: string
  registroId?: string
  pagina?: number
  porPagina?: number
}

export function useAuditoria() {
  const [logs, setLogs] = useState<AuditoriaLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(async (filtros: FiltrosAuditoria = {}) => {
    setLoading(true)
    const pagina = filtros.pagina ?? 0
    const porPagina = filtros.porPagina ?? 50
    let query = supabase
      .from('log_auditoria')
      .select(COLUNAS_AUDITORIA, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagina * porPagina, (pagina + 1) * porPagina - 1)

    if (filtros.tabela) query = query.eq('tabela', filtros.tabela)
    if (filtros.registroId) query = query.eq('registro_id', filtros.registroId)

    const { data, error, count } = await query

    if (error) {
      toast.error('Erro ao carregar auditoria: ' + error.message)
    } else {
      setLogs((data as AuditoriaLog[]) || [])
      setTotal(count ?? 0)
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

  return { logs, total, loading, loadLogs, registrar }
}
