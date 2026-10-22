import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { VtCobertura } from '@/types/vt'

// Coberturas de férias do VT (migration 158 — decisão da gestora, 21/10/2026):
// o ferista cobre FÉRIAS e o Flit não mostra o destino, então é registro
// manual; a carga mensal usa o posto da cobertura com prioridade sobre a
// escala. Sem embed no listar: os nomes (ferista/posto) são resolvidos na tela
// a partir das listas já carregadas — o tipo Database não declara os
// relacionamentos de vt_coberturas. Toda escrita termina em .select('id') e
// confere as linhas afetadas (anti-falso-sucesso, AGENTS.md §12).

export interface NovaCoberturaVT {
  /** O ferista (quem cobre). NULL = declaração "sem cobertura" (migration 159). */
  colaborador_id: string | null
  /** De quem são as férias cobertas. NULL/ausente = cobertura avulsa. */
  ferias_colaborador_id?: string | null
  departamento_id: string
  data_inicio: string // 'AAAA-MM-DD'
  data_fim: string // 'AAAA-MM-DD'
  observacao?: string | null
}

export function useVtCoberturas() {
  const [coberturas, setCoberturas] = useState<VtCobertura[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vt_coberturas')
      .select('*')
      .order('data_inicio', { ascending: false })
    setLoading(false)
    if (error) {
      console.error('Erro ao listar coberturas do VT:', error.message)
      toast.error('Erro ao carregar as coberturas de férias')
      return false
    }
    setCoberturas((data as VtCobertura[]) ?? [])
    return true
  }, [])

  const registrar = useCallback(
    async (dados: NovaCoberturaVT, usuarioId: string): Promise<boolean> => {
      if (dados.data_fim < dados.data_inicio) {
        toast.error('A data final não pode ser antes da inicial')
        return false
      }
      if (!dados.colaborador_id && !dados.ferias_colaborador_id) {
        toast.error('Informe o ferista ou as férias cobertas')
        return false
      }
      const { data, error } = await supabase
        .from('vt_coberturas')
        .insert({
          ...dados,
          colaborador_id: dados.colaborador_id || null,
          ferias_colaborador_id: dados.ferias_colaborador_id || null,
          observacao: dados.observacao ?? null,
          registrado_por: usuarioId,
        })
        .select('id')
      if (error) {
        console.error('Erro ao registrar cobertura do VT:', error.message)
        toast.error('Erro ao registrar a cobertura')
        return false
      }
      if (!data || data.length === 0) {
        toast.error('Não foi possível registrar: cobertura não gravada (permissão)')
        return false
      }
      toast.success(dados.colaborador_id ? 'Cobertura de férias registrada' : '"Sem cobertura" registrado')
      return true
    },
    []
  )

  const remover = useCallback(async (id: string): Promise<boolean> => {
    const { data, error } = await supabase.from('vt_coberturas').delete().eq('id', id).select('id')
    if (error) {
      console.error('Erro ao remover cobertura do VT:', error.message)
      toast.error('Erro ao remover a cobertura')
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Não foi possível remover: cobertura não excluída (permissão)')
      return false
    }
    toast.success('Cobertura removida')
    return true
  }, [])

  return { coberturas, loading, listar, registrar, remover }
}
