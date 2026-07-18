import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ResultadoVR } from '@/types'

const COLUNAS_RESULTADO_VR = 'id, projeto_id, colaborador_id, nome, cpf, matricula, dias_elegiveis, dias_pdf, dias_escala, dias_abatimento, valor_bruto, extra, detalhes_json, created_at, updated_at'

export function useResultadosVR() {
  const [resultados, setResultados] = useState<ResultadoVR[]>([])
  const [loading, setLoading] = useState(false)

  const listarPorProjeto = useCallback(async (projetoId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('resultados_vr')
        .select(COLUNAS_RESULTADO_VR)
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
    // RPC transacional: delete + insert atômicos. Se algo falhar, nada é
    // perdido (antes o delete acontecia mesmo com insert quebrado).
    const { error } = await supabase.rpc('salvar_resultados_vr_lote', {
      p_projeto_id: projetoId,
      p_itens: items,
    })

    if (error) {
      toast.error('Erro ao salvar resultados: ' + error.message)
      return false
    }

    toast.success('Resultados salvos')
    return true
  }, [])

  return {
    resultados,
    loading,
    listarPorProjeto,
    salvarLote,
  }
}
