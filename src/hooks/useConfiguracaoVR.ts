import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { VRConfiguracao } from '@/types'

const CHAVE = 'vr_configuracao_padrao'

export function useConfiguracaoVR() {
  const [config, setConfig] = useState<VRConfiguracao | null>(null)
  const [loading, setLoading] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('chave', CHAVE)
        .single()

      if (error && error.code !== 'PGRST116') {
        toast.error('Erro ao carregar configuração VR: ' + error.message)
        return
      }

      if (data?.valor) {
        try {
          setConfig(JSON.parse(data.valor) as VRConfiguracao)
        } catch {
          setConfig(null)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const salvar = useCallback(async (novaConfig: VRConfiguracao) => {
    const { error } = await supabase
      .from('configuracoes')
      .upsert({
        chave: CHAVE,
        valor: JSON.stringify(novaConfig),
        descricao: 'Configuração padrão do módulo Vale Refeição'
      })

    if (error) {
      toast.error('Erro ao salvar configuração VR: ' + error.message)
      return false
    }

    setConfig(novaConfig)
    toast.success('Configuração VR salva')
    return true
  }, [])

  return {
    config,
    loading,
    carregar,
    salvar,
  }
}
