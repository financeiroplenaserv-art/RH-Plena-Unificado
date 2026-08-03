import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { AuditoriaLog } from '@/types/database'

const COLUNAS_AUDITORIA = 'id, tabela, registro_id, operacao, dados_anteriores, dados_novos, usuario_id, created_at'

export interface FiltrosAuditoria {
  tabela?: string
  registroId?: string
  /** Busca global (server-side) em tabela, ação, ID do registro e usuário. */
  busca?: string
  /** IDs de perfis cujo nome/e-mail bate com a busca (resolvido na página). */
  idsUsuariosBusca?: string[]
  /** yyyy-mm-dd (inclusive) */
  dataInicio?: string
  /** yyyy-mm-dd (inclusive) */
  dataFim?: string
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
    if (filtros.dataInicio) query = query.gte('created_at', `${filtros.dataInicio}T00:00:00`)
    if (filtros.dataFim) query = query.lte('created_at', `${filtros.dataFim}T23:59:59.999`)
    if (filtros.busca?.trim()) {
      // Remove caracteres especiais do PostgREST para não quebrar a expressão .or()
      const termo = filtros.busca.trim().replace(/[%(),.]/g, ' ').replace(/\s+/g, ' ')
      const condicoes = [
        `tabela.ilike.%${termo}%`,
        `operacao.ilike.%${termo}%`,
        `registro_id.ilike.%${termo}%`,
      ]
      if (filtros.idsUsuariosBusca?.length) {
        condicoes.push(`usuario_id.in.(${filtros.idsUsuariosBusca.join(',')})`)
      }
      query = query.or(condicoes.join(','))
    }

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
