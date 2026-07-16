import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Ocorrencia, StatusOcorrencia } from '@/types/database'
import type { Paginacao, ResultadoPaginado } from '@/types'

export interface FiltrosOcorrencia {
  colaborador_id?: string
  status?: string
  tipo?: string | string[]
  empresa_id?: string
  macro_grupo?: string
  gravidade?: string
  data_inicio?: string
  data_fim?: string
  busca?: string
  incluir_nao_identificados?: boolean
  status_colaborador?: 'todos' | 'ativo' | 'inativo'
}

const TAMANHO_PADRAO = 50
const PLACEHOLDER_MATRICULA = '999999'

export function useOcorrencias() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [loading, setLoading] = useState(false)
  const [paginacao, setPaginacao] = useState<ResultadoPaginado<Ocorrencia> | null>(null)
  const [placeholderId, setPlaceholderId] = useState<string | null>(null)

  const aplicarFiltros = useCallback((query: ReturnType<typeof supabase.from>, filtros?: FiltrosOcorrencia) => {
    if (filtros?.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id)
    if (filtros?.status) query = query.eq('status', filtros.status as StatusOcorrencia)
    if (filtros?.tipo) {
      const tipos = Array.isArray(filtros.tipo) ? filtros.tipo : [filtros.tipo]
      if (tipos.length === 1) {
        query = query.eq('tipo_ocorrencia', tipos[0])
      } else if (tipos.length > 1) {
        query = query.in('tipo_ocorrencia', tipos)
      }
    }
    if (filtros?.empresa_id) query = query.eq('empresa_id', filtros.empresa_id)
    if (filtros?.macro_grupo) query = query.eq('macro_grupo', filtros.macro_grupo)
    if (filtros?.gravidade) query = query.eq('gravidade', filtros.gravidade)
    if (filtros?.data_inicio) query = query.gte('data_ocorrencia', filtros.data_inicio)
    if (filtros?.data_fim) query = query.lte('data_ocorrencia', filtros.data_fim)
    if (filtros?.status_colaborador && filtros.status_colaborador !== 'todos') {
      if (filtros.status_colaborador === 'ativo') {
        query = query.eq('colaborador.status', 'Ativo')
      } else {
        query = query.not('colaborador.status', 'eq', 'Ativo')
      }
    }
    return query
  }, [])

  const listarPaginado = useCallback(async (
    filtros: FiltrosOcorrencia = {},
    paginacaoReq?: Paginacao
  ): Promise<ResultadoPaginado<Ocorrencia>> => {
    setLoading(true)

    const tamanho = paginacaoReq?.tamanho ?? TAMANHO_PADRAO
    const pagina = paginacaoReq?.pagina ?? 0
    const inicio = pagina * tamanho
    const fim = inicio + tamanho - 1

    let placeholderIdAtual: string | null = null
    if (!filtros.incluir_nao_identificados) {
      if (!placeholderId) {
        const { data } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('matricula', PLACEHOLDER_MATRICULA)
          .single()
        if (data?.id) {
          setPlaceholderId(data.id)
          placeholderIdAtual = data.id
        }
      } else {
        placeholderIdAtual = placeholderId
      }
    }

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
    if (placeholderIdAtual) {
      baseQuery = baseQuery.neq('colaborador_id', placeholderIdAtual)
    }

    if (colaboradorIds) {
      const termo = filtros.busca!.trim()
      baseQuery = baseQuery.or(
        `colaborador_id.in.(${colaboradorIds.join(',')}),tipo_ocorrencia.ilike.%${termo}%,titulo.ilike.%${termo}%,colaborador_nome.ilike.%${termo}%,descricao.ilike.%${termo}%`
      )
    }

    const countQuery = supabase
      .from('ocorrencias')
      .select(
        filtros.status_colaborador && filtros.status_colaborador !== 'todos'
          ? 'colaborador:colaborador_id(*)'
          : '*',
        { count: 'exact', head: true }
      )
    const countQueryComFiltros = aplicarFiltros(countQuery, filtros)
    if (placeholderIdAtual) {
      countQueryComFiltros.neq('colaborador_id', placeholderIdAtual)
    }
    if (colaboradorIds) {
      const termo = filtros.busca!.trim()
      countQueryComFiltros.or(
        `colaborador_id.in.(${colaboradorIds.join(',')}),tipo_ocorrencia.ilike.%${termo}%,titulo.ilike.%${termo}%,colaborador_nome.ilike.%${termo}%,descricao.ilike.%${termo}%`
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
  }, [aplicarFiltros, placeholderId])

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
    listarPaginado,
    excluir,
  }
}
