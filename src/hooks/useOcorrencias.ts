import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Ocorrencia, StatusOcorrencia } from '@/types/database'

export interface FiltrosOcorrencia {
  colaborador_id?: string
  status?: string
  tipo?: string
  empresa_id?: string
  macro_grupo?: string
  gravidade?: string
  data_inicio?: string
  data_fim?: string
  busca?: string
}

export interface Paginacao {
  pagina: number
  tamanho: number
}

export interface ResultadoPaginado<T> {
  dados: T[]
  total: number
  pagina: number
  tamanho: number
  totalPaginas: number
}

const TAMANHO_PADRAO = 50

export function useOcorrencias() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [loading, setLoading] = useState(false)
  const [paginacao, setPaginacao] = useState<ResultadoPaginado<Ocorrencia> | null>(null)

  const aplicarFiltros = useCallback((query: ReturnType<typeof supabase.from>, filtros?: FiltrosOcorrencia) => {
    if (filtros?.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id)
    if (filtros?.status) query = query.eq('status', filtros.status as StatusOcorrencia)
    if (filtros?.tipo) query = query.eq('tipo_ocorrencia', filtros.tipo)
    if (filtros?.empresa_id) query = query.eq('empresa_id', filtros.empresa_id)
    if (filtros?.macro_grupo) query = query.eq('macro_grupo', filtros.macro_grupo)
    if (filtros?.gravidade) query = query.eq('gravidade', filtros.gravidade)
    if (filtros?.data_inicio) query = query.gte('data_ocorrencia', filtros.data_inicio)
    if (filtros?.data_fim) query = query.lte('data_ocorrencia', filtros.data_fim)
    return query
  }, [])

  const listar = useCallback(async (filtros: FiltrosOcorrencia = {}) => {
    setLoading(true)
    setPaginacao(null)
    try {
      let query = supabase
        .from('ocorrencias')
        .select('*, colaborador:colaborador_id(*), total_anexos:ocorrencia_anexos(count)')
        .order('data_ocorrencia', { ascending: false })

      query = aplicarFiltros(query, filtros)

      let colaboradorIds: string[] | undefined
      if (filtros.busca) {
        const termo = filtros.busca.trim()
        const { data: colaboradores } = await supabase
          .from('colaboradores')
          .select('id')
          .or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,matricula.ilike.%${termo}%`)
        colaboradorIds = (colaboradores || []).map((c) => c.id)
      }

      if (colaboradorIds) {
        query = query.or(
          `colaborador_id.in.(${colaboradorIds.join(',')}),tipo_ocorrencia.ilike.%${filtros.busca}%,titulo.ilike.%${filtros.busca}%`
        )
      }

      const { data, error } = await query

      if (error) {
        toast.error('Erro ao carregar ocorrências: ' + error.message)
        return
      }

      setOcorrencias((data as Ocorrencia[]) || [])
    } finally {
      setLoading(false)
    }
  }, [aplicarFiltros])

  const listarPaginado = useCallback(async (
    filtros: FiltrosOcorrencia = {},
    paginacaoReq?: Paginacao
  ): Promise<ResultadoPaginado<Ocorrencia>> => {
    setLoading(true)

    const tamanho = paginacaoReq?.tamanho ?? TAMANHO_PADRAO
    const pagina = paginacaoReq?.pagina ?? 0
    const inicio = pagina * tamanho
    const fim = inicio + tamanho - 1

    let colaboradorIds: string[] | undefined
    if (filtros.busca) {
      const termo = filtros.busca.trim()
      const { data: colaboradores } = await supabase
        .from('colaboradores')
        .select('id')
        .or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,matricula.ilike.%${termo}%`)
      colaboradorIds = (colaboradores || []).map((c) => c.id)
    }

    let baseQuery = supabase
      .from('ocorrencias')
      .select('*, colaborador:colaborador_id(*), total_anexos:ocorrencia_anexos(count)')
      .order('data_ocorrencia', { ascending: false })

    baseQuery = aplicarFiltros(baseQuery, filtros)

    if (colaboradorIds) {
      const termo = filtros.busca!.trim()
      baseQuery = baseQuery.or(
        `colaborador_id.in.(${colaboradorIds.join(',')}),tipo_ocorrencia.ilike.%${termo}%,titulo.ilike.%${termo}%`
      )
    }

    const countQuery = supabase
      .from('ocorrencias')
      .select('*', { count: 'exact', head: true })
    const countQueryComFiltros = aplicarFiltros(countQuery, filtros)
    if (colaboradorIds) {
      const termo = filtros.busca!.trim()
      countQueryComFiltros.or(
        `colaborador_id.in.(${colaboradorIds.join(',')}),tipo_ocorrencia.ilike.%${termo}%,titulo.ilike.%${termo}%`
      )
    }

    const [{ count, error: erroCount }, { data, error }] = await Promise.all([
      countQueryComFiltros,
      baseQuery.range(inicio, fim),
    ])

    if (error) {
      toast.error('Erro ao carregar ocorrências: ' + error.message)
      setLoading(false)
      return { dados: [], total: 0, pagina, tamanho, totalPaginas: 0 }
    }

    if (erroCount) {
      console.error('Erro ao contar ocorrências:', erroCount)
    }

    const total = count ?? 0
    const resultado = {
      dados: (data as Ocorrencia[]) || [],
      total,
      pagina,
      tamanho,
      totalPaginas: Math.ceil(total / tamanho),
    }

    setOcorrencias(resultado.dados)
    setPaginacao(resultado)
    setLoading(false)
    return resultado
  }, [aplicarFiltros])

  const buscarPorId = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('ocorrencias')
      .select('*, colaborador:colaborador_id(*)')
      .eq('id', id)
      .single()

    if (error) {
      toast.error('Erro ao carregar ocorrência: ' + error.message)
      return null
    }

    return data as Ocorrencia
  }, [])

  const criar = useCallback(async (payload: Partial<Ocorrencia>) => {
    const { data, error } = await supabase
      .from('ocorrencias')
      .insert(payload)
      .select()
      .single()

    if (error) {
      toast.error('Erro ao registrar ocorrência: ' + error.message)
      return null
    }

    return data as Ocorrencia
  }, [])

  const atualizar = useCallback(async (id: string, payload: Partial<Ocorrencia>) => {
    const { data, error } = await supabase
      .from('ocorrencias')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      toast.error('Erro ao atualizar ocorrência: ' + error.message)
      return null
    }

    return data as Ocorrencia
  }, [])

  const cancelar = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('ocorrencias')
      .update({ status: 'Cancelada' as StatusOcorrencia })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao cancelar ocorrência: ' + error.message)
      return false
    }

    toast.success('Ocorrência cancelada')
    return true
  }, [])

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase.from('ocorrencias').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir ocorrência: ' + error.message)
      return false
    }

    toast.success('Ocorrência removida')
    return true
  }, [])

  return {
    ocorrencias,
    loading,
    paginacao,
    listar,
    listarPaginado,
    buscarPorId,
    criar,
    atualizar,
    cancelar,
    excluir,
  }
}
