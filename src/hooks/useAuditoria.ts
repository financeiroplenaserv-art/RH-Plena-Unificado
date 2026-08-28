import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { AuditoriaLog } from '@/types/database'

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

type LinhaAuditoria = AuditoriaLog & { total_count: number }

export function useAuditoria() {
  const [logs, setLogs] = useState<AuditoriaLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(async (filtros: FiltrosAuditoria = {}) => {
    setLoading(true)
    const pagina = filtros.pagina ?? 0
    const porPagina = filtros.porPagina ?? 50

    // A listagem vai por RPC (migration 108): a busca com ILIKE sob RLS não usava
    // os índices (barreira de segurança das funções não-leakproof da policy) e a
    // query ORDER BY + LIMIT varria a tabela inteira — timeout de 8s do PostgREST.
    // SECURITY DEFINER + índices trigram (migration 107) → ~10ms.
    const termo = filtros.busca?.trim() || null

    const { data, error } = await supabase.rpc('buscar_log_auditoria', {
      p_tabela: filtros.tabela ?? null,
      p_registro_id: filtros.registroId ?? null,
      p_busca: termo,
      p_usuario_ids: filtros.idsUsuariosBusca?.length ? filtros.idsUsuariosBusca : null,
      p_data_inicio: filtros.dataInicio ? `${filtros.dataInicio}T00:00:00` : null,
      p_data_fim: filtros.dataFim ? `${filtros.dataFim}T23:59:59.999` : null,
      p_limite: porPagina,
      p_offset: pagina * porPagina,
    })

    if (error) {
      toast.error('Erro ao carregar auditoria: ' + error.message)
    } else {
      const linhas = (data as LinhaAuditoria[] | null) ?? []
      setLogs(linhas)
      setTotal(linhas[0]?.total_count ?? 0)
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
