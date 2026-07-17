import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ProjetoVR } from '@/types'

const COLUNAS_PROJETO_VR = 'id, nome, data_corte, data_efetivacao, configuracao_json, usuario_id, created_at'

export function useProjetosVR() {
  const [projetos, setProjetos] = useState<ProjetoVR[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('projetos_vr')
        .select(COLUNAS_PROJETO_VR)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Erro ao carregar projetos VR: ' + error.message)
        return
      }

      setProjetos((data as ProjetoVR[]) || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const buscarPorId = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('projetos_vr')
      .select(COLUNAS_PROJETO_VR)
      .eq('id', id)
      .single()

    if (error) {
      toast.error('Erro ao carregar projeto VR: ' + error.message)
      return null
    }

    return data as ProjetoVR
  }, [])

  const criar = useCallback(async (payload: Partial<ProjetoVR>) => {
    const { data: user } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('projetos_vr')
      .insert({ ...payload, usuario_id: user.user?.id } as Partial<ProjetoVR>)
      .select(COLUNAS_PROJETO_VR)
      .single()

    if (error) {
      toast.error('Erro ao criar projeto VR: ' + error.message)
      return null
    }

    toast.success('Projeto VR criado')
    return data as ProjetoVR
  }, [])

  const atualizar = useCallback(async (id: string, payload: Partial<ProjetoVR>) => {
    const { data, error } = await supabase
      .from('projetos_vr')
      .update(payload)
      .eq('id', id)
      .select(COLUNAS_PROJETO_VR)
      .single()

    if (error) {
      toast.error('Erro ao atualizar projeto VR: ' + error.message)
      return null
    }

    toast.success('Projeto VR atualizado')
    return data as ProjetoVR
  }, [])

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase.from('projetos_vr').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir projeto VR: ' + error.message)
      return false
    }

    toast.success('Projeto VR removido')
    return true
  }, [])

  return {
    projetos,
    loading,
    listar,
    buscarPorId,
    criar,
    atualizar,
    excluir,
  }
}
