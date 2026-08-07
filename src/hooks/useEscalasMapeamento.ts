import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { MapeamentoFlitLocalTrabalho } from '@/types/database'

const COLUNAS_MAPEAMENTO = 'id, local_trabalho_id, tipo_match, valor_flit, prioridade, ativo, created_at, updated_at'
const COLUNAS_LOCAL_TRABALHO = 'id, nome, nome_curto, status, observacao'

export function useEscalasMapeamento() {
  const [mapeamentos, setMapeamentos] = useState<MapeamentoFlitLocalTrabalho[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mapeamento_flit_local_trabalho')
        .select(`${COLUNAS_MAPEAMENTO}, local_trabalho:locais_trabalho(${COLUNAS_LOCAL_TRABALHO})`)
        .eq('ativo', true)
        .order('tipo_match')
        .order('valor_flit')
      if (error) throw error
      setMapeamentos((data || []) as unknown as MapeamentoFlitLocalTrabalho[])
      return (data || []) as unknown as MapeamentoFlitLocalTrabalho[]
    } catch (err: unknown) {
      console.error('Erro ao carregar mapeamentos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar mapeamentos')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(async (mapeamento: Omit<MapeamentoFlitLocalTrabalho, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('mapeamento_flit_local_trabalho')
        .insert(mapeamento as Partial<MapeamentoFlitLocalTrabalho>)
        .select(COLUNAS_MAPEAMENTO)
        .single()
      if (error) throw error
      toast.success('Mapeamento criado')
      await listar()
      return data as unknown as MapeamentoFlitLocalTrabalho
    } catch (err: unknown) {
      console.error('Erro ao criar mapeamento:', err)
      // 23505 = violação da UNIQUE (tipo_match, valor_flit): traduz para o usuário
      const codigo = (err as { code?: string } | null)?.code
      toast.error(
        codigo === '23505'
          ? 'Este mapeamento já existe (mesmo tipo e valor no Flit)'
          : err instanceof Error
            ? err.message
            : 'Erro ao criar mapeamento'
      )
      return null
    }
  }, [listar])

  const atualizar = useCallback(async (
    id: string,
    dados: { local_trabalho_id: string; tipo_match: MapeamentoFlitLocalTrabalho['tipo_match']; valor_flit: string }
  ) => {
    try {
      // .select('id') após o update: UPDATE bloqueado por RLS retorna 0 linhas
      // SEM erro — sem essa checagem o toast fingiria sucesso.
      const { data, error } = await supabase
        .from('mapeamento_flit_local_trabalho')
        .update(dados as Partial<MapeamentoFlitLocalTrabalho>)
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        toast.error('Sem permissão para atualizar este mapeamento')
        return false
      }
      toast.success('Mapeamento atualizado')
      await listar()
      return true
    } catch (err: unknown) {
      console.error('Erro ao atualizar mapeamento:', err)
      // 23505 = violação da UNIQUE (tipo_match, valor_flit): traduz para o usuário
      const codigo = (err as { code?: string } | null)?.code
      toast.error(
        codigo === '23505'
          ? 'Já existe outro mapeamento com este tipo e valor no Flit'
          : err instanceof Error
            ? err.message
            : 'Erro ao atualizar mapeamento'
      )
      return false
    }
  }, [listar])

  const remover = useCallback(async (id: string) => {
    try {
      // .select('id') após o delete: DELETE bloqueado por RLS retorna 0 linhas
      // SEM erro — sem essa checagem o toast fingiria sucesso.
      const { data, error } = await supabase
        .from('mapeamento_flit_local_trabalho')
        .delete()
        .eq('id', id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        toast.error('Sem permissão para remover este mapeamento')
        return false
      }
      toast.success('Mapeamento removido')
      await listar()
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover mapeamento:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover mapeamento')
      return false
    }
  }, [listar])

  return { mapeamentos, loading, listar, criar, atualizar, remover }
}
