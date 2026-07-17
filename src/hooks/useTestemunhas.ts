import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { OcorrenciaTestemunha } from '@/types/database'

const COLUNAS_TESTEMUNHA = 'id, ocorrencia_id, nome, cargo, departamento, cpf, usuario_id, created_at'

export function useTestemunhas() {
  const [testemunhas, setTestemunhas] = useState<OcorrenciaTestemunha[]>([])
  const [loading, setLoading] = useState(false)

  const loadTestemunhas = useCallback(async (ocorrenciaId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ocorrencia_testemunhas')
      .select(COLUNAS_TESTEMUNHA)
      .eq('ocorrencia_id', ocorrenciaId)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('Erro ao carregar testemunhas: ' + error.message)
    } else {
      setTestemunhas((data as OcorrenciaTestemunha[]) || [])
    }
    setLoading(false)
  }, [])

  const adicionarTestemunha = useCallback(
    async (payload: Partial<OcorrenciaTestemunha>) => {
      const { data, error } = await supabase
        .from('ocorrencia_testemunhas')
        .insert(payload)
        .select(COLUNAS_TESTEMUNHA)
        .single()

      if (error) {
        toast.error('Erro ao adicionar testemunha: ' + error.message)
        return null
      }

      setTestemunhas((prev) => [...prev, data as OcorrenciaTestemunha])
      toast.success('Testemunha adicionada')
      return data as OcorrenciaTestemunha
    },
    []
  )

  const removerTestemunha = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('ocorrencia_testemunhas')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Erro ao remover testemunha: ' + error.message)
      return false
    }

    setTestemunhas((prev) => prev.filter((t) => t.id !== id))
    toast.success('Testemunha removida')
    return true
  }, [])

  return {
    testemunhas,
    loading,
    loadTestemunhas,
    adicionarTestemunha,
    removerTestemunha,
  }
}
