import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { VRConfiguracao } from '@/types'

const CHAVE = 'vr_configuracao_padrao'

export function useConfiguracaoVR() {
  const [config, setConfig] = useState<VRConfiguracao | null>(null)

  const carregar = useCallback(async () => {
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
        } catch (err) {
          console.error('Erro ao parsear configuração VR:', err)
          setConfig(null)
        }
      }
    } catch (err) {
      console.error('Erro ao carregar configuração VR:', err)
    }
  }, [])

  return {
    config,
    carregar,
  }
}
