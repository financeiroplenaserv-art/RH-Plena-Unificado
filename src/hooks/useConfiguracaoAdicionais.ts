import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { safeJsonParse } from '@/lib/utils'

const COLUNAS_CONFIGURACAO = 'chave, valor, descricao, created_at, updated_at'

const CHAVE = 'adicionais_insalubridade_config'

/** Configuração compartilhada do TXT de insalubridade (salário único — decisão da gestão: todos que recebem insalubridade têm o mesmo salário base, reajustado 1x/ano no dissídio). */
export interface ConfigInsalubridade {
  salarioBase: number
  codigoEvento: string
}

export const CONFIG_INSALUBRIDADE_PADRAO: ConfigInsalubridade = {
  salarioBase: 0,
  codigoEvento: '012',
}

export function useConfiguracaoAdicionais() {
  const [config, setConfig] = useState<ConfigInsalubridade | null>(null)

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select(COLUNAS_CONFIGURACAO)
        .eq('chave', CHAVE)
        .single()

      if (error && error.code !== 'PGRST116') {
        toast.error('Erro ao carregar configuração de insalubridade: ' + error.message)
        return
      }

      if (data?.valor) {
        setConfig(safeJsonParse<ConfigInsalubridade>(data.valor, CONFIG_INSALUBRIDADE_PADRAO))
      }
    } catch (err) {
      console.error('Erro ao carregar configuração de insalubridade:', err)
    }
  }, [])

  const salvar = useCallback(async (nova: ConfigInsalubridade): Promise<boolean> => {
    // .select('chave') para detectar escrita bloqueada por RLS (não-editor):
    // sem o select, o PostgREST retorna sucesso com 0 linhas e o toast fingiria sucesso.
    const { data, error } = await supabase
      .from('configuracoes')
      .upsert(
        {
          chave: CHAVE,
          valor: JSON.stringify(nova),
          descricao: 'Salário base único e código do evento para o TXT de insalubridade (Alterdata)',
        },
        { onConflict: 'chave' }
      )
      .select('chave')

    if (error) {
      toast.error('Erro ao salvar configuração: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para salvar a configuração (perfil sem edição)')
      return false
    }
    setConfig(nova)
    toast.success('Configuração salva como padrão')
    return true
  }, [])

  return { config, carregar, salvar }
}
