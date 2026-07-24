import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { gerarNumeroRecibo } from '@/lib/ceuRecibos'
import type { EntregaCEU } from '@/types/database'
import type { Paginacao, ResultadoPaginado } from '@/types'

export interface FiltrosEntrega {
  colaboradorId?: string
  itemId?: string
  dataInicio?: string
  dataFim?: string
  emAberto?: boolean
  devolvido?: boolean
  buscaColaborador?: string
  departamento?: string
}

const TAMANHO_PADRAO = 50

const COLUNAS_ENTREGA = 'id, colaborador_id, item_id, data_entrega, data_devolucao, quantidade, observacao, usuario_id, snapshot_item, recibo_emitido, numero_recibo, situacao, created_at'
const COLUNAS_COLABORADOR_CEU = 'id, nome_completo, matricula, departamento, cargo, cpf, data_admissao, empresa_id'
const COLUNAS_ITEM_CEU_RESUMIDO = 'id, nome, tipo, ca, subgrupo, prazo_uso_dias'

export function useCEUEntregas() {
  const [entregas, setEntregas] = useState<EntregaCEU[]>([])
  const [loading, setLoading] = useState(false)
  const [paginacao, setPaginacao] = useState<ResultadoPaginado<EntregaCEU> | null>(null)

  const aplicarFiltros = useCallback((query: ReturnType<typeof supabase.from>, filtros?: FiltrosEntrega) => {
    if (filtros?.colaboradorId && filtros.colaboradorId.trim() !== '' && filtros.colaboradorId !== ' ') {
      query = query.eq('colaborador_id', filtros.colaboradorId)
    }
    if (filtros?.itemId && filtros.itemId.trim() !== '' && filtros.itemId !== 'todos') {
      query = query.eq('item_id', filtros.itemId)
    }
    if (filtros?.dataInicio && filtros.dataInicio.trim() !== '' && filtros.dataInicio !== ' ') {
      query = query.gte('data_entrega', filtros.dataInicio)
    }
    if (filtros?.dataFim && filtros.dataFim.trim() !== '' && filtros.dataFim !== ' ') {
      query = query.lte('data_entrega', filtros.dataFim)
    }
    if (filtros?.emAberto) {
      query = query.is('data_devolucao', null)
    }
    if (filtros?.devolvido) {
      query = query.not('data_devolucao', 'is', null)
    }
    return query
  }, [])

  const listar = useCallback(async (filtros?: FiltrosEntrega) => {
    setLoading(true)
    setPaginacao(null)

    const TAMANHO_PAGINA = 1000
    let todos: EntregaCEU[] = []
    let pagina = 0
    let continuar = true

    while (continuar) {
      let query = supabase
        .from('entregas')
        .select(`${COLUNAS_ENTREGA}, colaborador:colaborador_id(${COLUNAS_COLABORADOR_CEU}), item:item_id(${COLUNAS_ITEM_CEU_RESUMIDO})`)
        .order('data_entrega', { ascending: false })
        .range(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA - 1)

      query = aplicarFiltros(query, filtros)

      const { data, error } = await query
      if (error) {
        toast.error('Erro ao carregar entregas: ' + error.message)
        setLoading(false)
        return todos
      }

      const paginaAtual = ((data as unknown) as EntregaCEU[]) || []
      todos = [...todos, ...paginaAtual]
      continuar = paginaAtual.length === TAMANHO_PAGINA
      pagina++
    }

    setEntregas(todos)
    setLoading(false)
    return todos
  }, [aplicarFiltros])

  const listarPaginado = useCallback(async (
    filtros?: FiltrosEntrega,
    paginacaoReq?: Paginacao
  ): Promise<ResultadoPaginado<EntregaCEU>> => {
    setLoading(true)

    const tamanho = paginacaoReq?.tamanho ?? TAMANHO_PADRAO
    const pagina = paginacaoReq?.pagina ?? 0
    const inicio = pagina * tamanho
    const fim = inicio + tamanho - 1

    let colaboradorIds: string[] | undefined
    if (filtros?.buscaColaborador || filtros?.departamento) {
      let queryColab = supabase.from('colaboradores').select('id')
      if (filtros.buscaColaborador) {
        const termo = filtros.buscaColaborador.trim()
        queryColab = queryColab.or(`nome_completo.ilike.%${termo}%,matricula.ilike.%${termo}%`)
      }
      if (filtros.departamento && filtros.departamento !== 'todos') {
        const nomeCurto = filtros.departamento.trim()
        const { data: deptData } = await supabase
          .from('departamentos')
          .select('id, nome, nome_curto')
          .or(`nome_curto.ilike.%${nomeCurto}%,nome.ilike.%${nomeCurto}%`)

        if (deptData && deptData.length > 0) {
          const ids = new Set<string>()
          const filtrosDepto: string[] = []
          deptData.forEach((dept) => {
            ids.add(dept.id)
            if (dept.nome) filtrosDepto.push(`departamento.ilike.%${dept.nome}%`)
            if (dept.nome_curto && dept.nome_curto !== dept.nome) {
              filtrosDepto.push(`departamento.ilike.%${dept.nome_curto}%`)
            }
          })
          filtrosDepto.unshift(`departamento_id.in.(${Array.from(ids).join(',')})`)
          queryColab = queryColab.or(filtrosDepto.join(','))
        } else {
          queryColab = queryColab.ilike('departamento', `%${nomeCurto}%`)
        }
      }
      const { data } = await queryColab
      colaboradorIds = (data || []).map((c) => c.id)
      if (colaboradorIds.length === 0) {
        const vazio = { dados: [], total: 0, pagina, tamanho, totalPaginas: 0 }
        setEntregas([])
        setPaginacao(vazio)
        setLoading(false)
        return vazio
      }
    }

    let baseQuery = supabase
      .from('entregas')
      .select(`${COLUNAS_ENTREGA}, colaborador:colaborador_id(${COLUNAS_COLABORADOR_CEU}), item:item_id(${COLUNAS_ITEM_CEU_RESUMIDO})`)
      .order('data_entrega', { ascending: false })

    baseQuery = aplicarFiltros(baseQuery, filtros)
    if (colaboradorIds) {
      baseQuery = baseQuery.in('colaborador_id', colaboradorIds)
    }

    const countQuery = supabase
      .from('entregas')
      .select('id', { count: 'exact', head: true })
    const countQueryComFiltros = aplicarFiltros(countQuery, filtros)
    if (colaboradorIds) {
      countQueryComFiltros.in('colaborador_id', colaboradorIds)
    }

    const [{ count, error: erroCount }, { data, error }] = await Promise.all([
      countQueryComFiltros,
      baseQuery.range(inicio, fim),
    ])

    if (error) {
      toast.error('Erro ao carregar entregas: ' + error.message)
      setLoading(false)
      return { dados: [], total: 0, pagina, tamanho, totalPaginas: 0 }
    }

    if (erroCount) {
      console.error('Erro ao contar entregas:', erroCount)
    }

    const total = count ?? 0
    const resultado = {
      dados: ((data as unknown) as EntregaCEU[]) || [],
      total,
      pagina,
      tamanho,
      totalPaginas: Math.ceil(total / tamanho),
    }

    setEntregas(resultado.dados)
    setPaginacao(resultado)
    setLoading(false)
    return resultado
  }, [aplicarFiltros])

  const criar = useCallback(async (entrega: Partial<EntregaCEU>) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      toast.error('Usuário não autenticado')
      return null
    }

    const { data, error } = await supabase
      .from('entregas')
      .insert({ ...entrega, usuario_id: userData.user.id })
      .select(COLUNAS_ENTREGA)
      .single()
    if (error) {
      toast.error('Erro ao registrar entrega: ' + error.message)
      return null
    }
    toast.success('Entrega registrada com sucesso')
    return data as EntregaCEU
  }, [])

  /** Insere várias entregas em uma única chamada. Retorna null em caso de erro. */
  const criarLote = useCallback(async (entregasLote: Partial<EntregaCEU>[]) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      toast.error('Usuário não autenticado')
      return null
    }

    const payloads = entregasLote.map((e) => ({ ...e, usuario_id: userData.user.id }))
    const { data, error } = await supabase
      .from('entregas')
      .insert(payloads)
      .select(COLUNAS_ENTREGA)
    if (error) {
      toast.error('Erro ao registrar entregas: ' + error.message)
      return null
    }
    return data as EntregaCEU[]
  }, [])

  const devolver = useCallback(async (id: string, dataDevolucao: string) => {
    const { error } = await supabase
      .from('entregas')
      .update({ data_devolucao: dataDevolucao })
      .eq('id', id)
    if (error) {
      toast.error('Erro ao registrar devolução: ' + error.message)
      return false
    }
    toast.success('Devolução registrada com sucesso')
    return true
  }, [])

  const marcarReciboEmitido = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('entregas')
      .update({ recibo_emitido: true })
      .eq('id', id)
    if (error) {
      toast.error('Erro ao marcar recibo: ' + error.message)
      return false
    }
    return true
  }, [])

  const marcarLoteReciboEmitido = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return true
    const { error } = await supabase
      .from('entregas')
      .update({ recibo_emitido: true })
      .in('id', ids)
    if (error) {
      toast.error('Erro ao marcar recibos em lote: ' + error.message)
      return false
    }
    return true
  }, [])

  /**
   * Próximo número de recibo sequencial (REC-AAAA-NNNNN) via função do banco
   * (migration 073). Se a migration ainda não foi aplicada, cai no formato
   * aleatório antigo para não travar a emissão.
   */
  const proximoNumeroRecibo = useCallback(async (): Promise<string> => {
    const { data, error } = await supabase.rpc('proximo_numero_recibo')
    if (error || !data) {
      console.warn('proximo_numero_recibo indisponível (migration 073 aplicada?) — usando número aleatório.', error)
      return gerarNumeroRecibo()
    }
    return data as string
  }, [])

  /**
   * Registra a emissão de um recibo: grava o número nas entregas e as marca
   * como recibo_emitido (o que bloqueia a exclusão — regra de negócio).
   */
  const registrarEmissaoRecibo = useCallback(async (ids: string[], numeroRecibo: string) => {
    if (ids.length === 0) return true
    const { error } = await supabase
      .from('entregas')
      .update({ recibo_emitido: true, numero_recibo: numeroRecibo })
      .in('id', ids)
    if (error) {
      toast.error('Erro ao registrar número do recibo: ' + error.message)
      return false
    }
    return true
  }, [])

  const remover = useCallback(async (id: string) => {
    const { error } = await supabase.from('entregas').delete().eq('id', id)
    if (error) {
      toast.error('Erro ao remover entrega: ' + error.message)
      return false
    }
    toast.success('Entrega removida com sucesso')
    return true
  }, [])

  return { entregas, loading, paginacao, listar, listarPaginado, criar, criarLote, devolver, marcarReciboEmitido, marcarLoteReciboEmitido, proximoNumeroRecibo, registrarEmissaoRecibo, remover }
}
