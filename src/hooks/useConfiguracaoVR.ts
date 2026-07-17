import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { safeJsonParse } from '@/lib/utils'
import type { VRConfiguracao } from '@/types'

const COLUNAS_CONFIGURACAO = 'chave, valor, descricao, created_at, updated_at'

const CHAVE = 'vr_configuracao_padrao'

export function useConfiguracaoVR() {
  const [config, setConfig] = useState<VRConfiguracao | null>(null)

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select(COLUNAS_CONFIGURACAO)
        .eq('chave', CHAVE)
        .single()

      if (error && error.code !== 'PGRST116') {
        toast.error('Erro ao carregar configuração VR: ' + error.message)
        return
      }

      if (data?.valor) {
        try {
          setConfig(safeJsonParse<VRConfiguracao>(data.valor, null))
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
