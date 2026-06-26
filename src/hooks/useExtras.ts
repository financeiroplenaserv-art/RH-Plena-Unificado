import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Extra, CategoriaExtra, ExtrasFiltros } from '@/types/extras'

export function useExtras() {
  const [extras, setExtras] = useState<Extra[]>([])
  const [categorias, setCategorias] = useState<CategoriaExtra[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (filtros?: ExtrasFiltros) => {
    setLoading(true)
    try {
      let query = supabase
        .from('extras')
        .select('*')
        .order('data_ocorrencia', { ascending: false })

      if (filtros?.dataInicio) {
        query = query.gte('data_ocorrencia', filtros.dataInicio)
      }
      if (filtros?.dataFim) {
        query = query.lte('data_ocorrencia', filtros.dataFim)
      }
      if (filtros?.categoria) {
        query = query.eq('categoria', filtros.categoria)
      }
      if (filtros?.posto) {
        query = query.ilike('posto', `%${filtros.posto}%`)
      }
      if (filtros?.status) {
        query = query.eq('status', filtros.status)
      }
      if (filtros?.colaboradorId) {
        query = query.or(`colaborador_ausente_id.eq.${filtros.colaboradorId},substituto_id.eq.${filtros.colaboradorId}`)
      }

      const { data, error } = await query
      if (error) throw error
      setExtras(data || [])
      return data || []
    } catch (err: unknown) {
      console.error('Erro ao carregar extras:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar extras')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const listarCategorias = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_extras')
        .select('*')
        .order('nome')
      if (error) throw error
      setCategorias(data || [])
      return data || []
    } catch (err: unknown) {
      console.error('Erro ao carregar categorias:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar categorias')
      return []
    }
  }, [])

  const criarCategoria = useCallback(async (dados: Omit<CategoriaExtra, 'id' | 'created_at' | 'updated_at'>): Promise<CategoriaExtra | null> => {
    try {
      const { data, error } = await supabase.from('categorias_extras').insert(dados).select().single()
      if (error) throw error
      toast.success('Categoria criada')
      setCategorias(prev => [...prev, data as CategoriaExtra].sort((a, b) => a.nome.localeCompare(b.nome)))
      return data as CategoriaExtra
    } catch (err: unknown) {
      console.error('Erro ao criar categoria:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao criar categoria')
      return null
    }
  }, [])

  const atualizarCategoria = useCallback(async (id: string, dados: Partial<Omit<CategoriaExtra, 'id' | 'created_at' | 'updated_at'>>): Promise<boolean> => {
    try {
      const { error } = await supabase.from('categorias_extras').update(dados).eq('id', id)
      if (error) throw error
      toast.success('Categoria atualizada')
      setCategorias(prev => prev.map(c => c.id === id ? { ...c, ...dados } : c).sort((a, b) => a.nome.localeCompare(b.nome)))
      return true
    } catch (err: unknown) {
      console.error('Erro ao atualizar categoria:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar categoria')
      return false
    }
  }, [])

  const removerCategoria = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('categorias_extras').delete().eq('id', id)
      if (error) throw error
      toast.success('Categoria removida')
      setCategorias(prev => prev.filter(c => c.id !== id))
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover categoria:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover categoria')
      return false
    }
  }, [])

  const buscarPorId = useCallback(async (id: string): Promise<Extra | null> => {
    try {
      const { data, error } = await supabase.from('extras').select('*').eq('id', id).single()
      if (error) throw error
      return data as Extra
    } catch (err: unknown) {
      console.error('Erro ao buscar extra:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar extra')
      return null
    }
  }, [])

  const verificarDuplicado = useCallback(async (dataOcorrencia: string, departamentoId: string | null, colaboradorAusenteId: string | null, colaboradorAusenteNome: string | null): Promise<Extra | null> => {
    if (!dataOcorrencia || !departamentoId) return null
    try {
      let query = supabase
        .from('extras')
        .select('*')
        .eq('data_ocorrencia', dataOcorrencia)
        .eq('departamento_id', departamentoId)
        .neq('status', 'Cancelado')

      if (colaboradorAusenteId) {
        query = query.eq('colaborador_ausente_id', colaboradorAusenteId)
      } else if (colaboradorAusenteNome) {
        query = query.eq('colaborador_ausente_nome', colaboradorAusenteNome)
      } else {
        // Sem colaborador ausente: considera duplicado se já houver registro no mesmo dia/depto sem ausente
        query = query.is('colaborador_ausente_id', null)
      }

      const { data, error } = await query.limit(1).single()
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw error
      }
      return (data as Extra) || null
    } catch (err: unknown) {
      console.error('Erro ao verificar duplicidade:', err)
      return null
    }
  }, [])

  const criar = useCallback(async (dados: Omit<Extra, 'id' | 'created_at' | 'updated_at'>): Promise<Extra | null> => {
    try {
      const { data, error } = await supabase.from('extras').insert(dados).select().single()
      if (error) throw error
      toast.success('Extra registrado com sucesso')
      setExtras(prev => [data as Extra, ...prev])
      return data as Extra
    } catch (err: unknown) {
      console.error('Erro ao registrar extra:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar extra')
      return null
    }
  }, [])

  const atualizar = useCallback(async (id: string, dados: Partial<Omit<Extra, 'id' | 'created_at' | 'updated_at'>>): Promise<boolean> => {
    try {
      const { error } = await supabase.from('extras').update(dados).eq('id', id)
      if (error) throw error
      toast.success('Extra atualizado com sucesso')
      setExtras(prev => prev.map(e => e.id === id ? { ...e, ...dados } : e))
      return true
    } catch (err: unknown) {
      console.error('Erro ao atualizar extra:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar extra')
      return false
    }
  }, [])

  const remover = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('extras').delete().eq('id', id)
      if (error) throw error
      toast.success('Extra removido com sucesso')
      setExtras(prev => prev.filter(e => e.id !== id))
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover extra:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover extra')
      return false
    }
  }, [])

  return {
    extras,
    categorias,
    loading,
    listar,
    listarCategorias,
    criarCategoria,
    atualizarCategoria,
    removerCategoria,
    buscarPorId,
    verificarDuplicado,
    criar,
    atualizar,
    remover,
  }
}
