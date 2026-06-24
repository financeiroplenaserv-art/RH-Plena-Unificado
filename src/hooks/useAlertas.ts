import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Alerta, Ocorrencia, Colaborador } from '@/types/database'

export function useAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(false)

  const loadAlertas = useCallback(async (status?: string) => {
    setLoading(true)
    let query = supabase
      .from('alertas')
      .select('*, colaborador:colaborador_id(*)')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status as Alerta['status'])

    const { data, error } = await query

    if (error) {
      toast.error('Erro ao carregar alertas: ' + error.message)
    } else {
      setAlertas((data as Alerta[]) || [])
    }
    setLoading(false)
  }, [])

  const marcarComoLido = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('alertas')
      .update({ status: 'lido' })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao atualizar alerta: ' + error.message)
      return false
    }

    setAlertas((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'lido' as const } : a))
    )
    return true
  }, [])

  const arquivar = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('alertas')
      .update({ status: 'arquivado' })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao arquivar alerta: ' + error.message)
      return false
    }

    setAlertas((prev) => prev.filter((a) => a.id !== id))
    return true
  }, [])

  const gerarAlertasAutomaticos = useCallback(async () => {
    setLoading(true)
    try {
      const { data: ocorrencias } = await supabase
        .from('ocorrencias')
        .select('*, colaborador:colaborador_id(*)')
        .in('status', ['Pendente', 'Ativa'])

      const { data: colaboradores } = await supabase
        .from('colaboradores')
        .select('*, ocorrencias(*)')

      const novosAlertas: Partial<Alerta>[] = []

      // Ocorrências pendentes de anexo
      ;(ocorrencias || []).forEach((o: Ocorrencia) => {
        if (o.status === 'Pendente') {
          novosAlertas.push({
            tipo: 'OCORRENCIA_PENDENTE',
            titulo: 'Ocorrência pendente de documentos',
            descricao: `${o.colaborador?.nome_completo || o.colaborador_nome} — ${o.tipo_ocorrencia}`,
            severidade: 'alta',
            status: 'ativo',
            colaborador_id: o.colaborador_id,
            empresa_id: o.empresa_id,
          })
        }
      })

      // Progressão disciplinar: 3+ ocorrências ativas
      ;(colaboradores || []).forEach((c) => {
        const colab = c as unknown as Colaborador & { ocorrencias?: Ocorrencia[] }
        const ativas = (colab.ocorrencias || []).filter((o: Ocorrencia) => o.status === 'Ativa').length
        if (ativas >= 3) {
          novosAlertas.push({
            tipo: 'PROGRESSAO_DISCIPLINAR',
            titulo: 'Progressão disciplinar atingida',
            descricao: `${colab.nome_completo} possui ${ativas} ocorrências ativas.`,
            severidade: 'critica',
            status: 'ativo',
            colaborador_id: colab.id,
            empresa_id: colab.empresa_id,
          })
        }
      })

      if (novosAlertas.length > 0) {
        const { error } = await supabase.from('alertas').insert(novosAlertas)
        if (error) {
          toast.error('Erro ao gerar alertas: ' + error.message)
        } else {
          toast.success(`${novosAlertas.length} alerta(s) gerado(s)`)
        }
      } else {
        toast.info('Nenhum alerta novo encontrado')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    alertas,
    loading,
    loadAlertas,
    marcarComoLido,
    arquivar,
    gerarAlertasAutomaticos,
  }
}
