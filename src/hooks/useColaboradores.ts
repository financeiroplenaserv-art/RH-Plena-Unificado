import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Colaborador, StatusColaborador } from '@/types/database'

interface FiltrosColaborador {
  empresaId?: string
  departamento?: string
  departamentoNomeCurto?: string
  cargo?: string
  status?: StatusColaborador
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

export function useColaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(false)
  const [paginacao, setPaginacao] = useState<ResultadoPaginado<Colaborador> | null>(null)

  const montarQuery = useCallback(async (filtros?: FiltrosColaborador) => {
    // Se houver filtro por nome curto do departamento, busca os IDs correspondentes primeiro
    const departamentoIds: string[] = []
    if (filtros?.departamentoNomeCurto && filtros.departamentoNomeCurto !== 'todos') {
      const { data: depts, error: erroDepts } = await supabase
        .from('departamentos')
        .select('id')
        .ilike('nome_curto', `%${filtros.departamentoNomeCurto}%`)

      if (erroDepts) {
        toast.error('Erro ao carregar departamentos: ' + erroDepts.message)
        return null
      }

      const ids = (depts || []).map((d: { id: string }) => d.id)
      if (ids.length === 0) {
        return { query: null, vazio: true as const }
      }
      departamentoIds.push(...ids)
    }

    let query = supabase.from('colaboradores').select('*').order('nome_completo')

    if (filtros?.empresaId) query = query.eq('empresa_id', filtros.empresaId)
    if (filtros?.departamento) query = query.ilike('departamento', filtros.departamento)
    if (departamentoIds.length > 0) query = query.in('departamento_id', departamentoIds)
    if (filtros?.cargo) query = query.ilike('cargo', filtros.cargo)
    if (filtros?.status) query = query.eq('status', filtros.status)
    if (filtros?.busca) {
      const termo = filtros.busca.trim()
      query = query.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,matricula.ilike.%${termo}%`)
    }

    return { query, vazio: false }
  }, [])

  const listar = useCallback(async (filtros?: FiltrosColaborador) => {
    setLoading(true)
    setPaginacao(null)

    const montada = await montarQuery(filtros)
    if (!montada) {
      setLoading(false)
      return []
    }
    if (montada.vazio) {
      setColaboradores([])
      setLoading(false)
      return []
    }

    const { data, error } = await montada.query
    if (error) {
      toast.error('Erro ao carregar colaboradores: ' + error.message)
    } else {
      setColaboradores((data || []) as Colaborador[])
    }
    setLoading(false)
    return (data || []) as Colaborador[]
  }, [montarQuery])

  const listarPaginado = useCallback(async (
    filtros?: FiltrosColaborador,
    paginacaoReq?: Paginacao
  ): Promise<ResultadoPaginado<Colaborador>> => {
    setLoading(true)

    const tamanho = paginacaoReq?.tamanho ?? TAMANHO_PADRAO
    const pagina = paginacaoReq?.pagina ?? 0
    const inicio = pagina * tamanho
    const fim = inicio + tamanho - 1

    const montada = await montarQuery(filtros)
    if (!montada) {
      setLoading(false)
      return { dados: [], total: 0, pagina, tamanho, totalPaginas: 0 }
    }
    if (montada.vazio) {
      setColaboradores([])
      setPaginacao({ dados: [], total: 0, pagina, tamanho, totalPaginas: 0 })
      setLoading(false)
      return { dados: [], total: 0, pagina, tamanho, totalPaginas: 0 }
    }

    const countQuery = supabase
      .from('colaboradores')
      .select('*', { count: 'exact', head: true })

    // Reaplica os mesmos filtros na contagem
    if (filtros?.empresaId) countQuery.eq('empresa_id', filtros.empresaId)
    if (filtros?.departamento) countQuery.ilike('departamento', filtros.departamento)
    if (filtros?.cargo) countQuery.ilike('cargo', filtros.cargo)
    if (filtros?.status) countQuery.eq('status', filtros.status)
    if (filtros?.busca) {
      const termo = filtros.busca.trim()
      countQuery.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,matricula.ilike.%${termo}%`)
    }

    const [{ count, error: erroCount }, { data, error }] = await Promise.all([
      countQuery,
      montada.query.range(inicio, fim),
    ])

    if (error) {
      toast.error('Erro ao carregar colaboradores: ' + error.message)
      setLoading(false)
      return { dados: [], total: 0, pagina, tamanho, totalPaginas: 0 }
    }

    if (erroCount) {
      console.error('Erro ao contar colaboradores:', erroCount)
    }

    const total = count ?? 0
    const resultado = {
      dados: (data || []) as Colaborador[],
      total,
      pagina,
      tamanho,
      totalPaginas: Math.ceil(total / tamanho),
    }

    setColaboradores(resultado.dados)
    setPaginacao(resultado)
    setLoading(false)
    return resultado
  }, [montarQuery])

  const buscarPorId = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Erro ao buscar colaborador:', error)
      return null
    }
    return data as Colaborador
  }, [])

  const buscarPorCpf = useCallback(async (cpf: string) => {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('cpf', cpf)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar por CPF:', error)
      return null
    }
    return data as Colaborador | null
  }, [])

  const buscarPorMatricula = useCallback(async (matricula: string) => {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('matricula', matricula)
      .maybeSingle()

    if (error) {
      console.error('Erro ao buscar por matrícula:', error)
      return null
    }
    return data as Colaborador | null
  }, [])

  const criar = useCallback(async (colaborador: Omit<Colaborador, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('colaboradores')
      .insert(colaborador as Partial<Colaborador>)
      .select()
      .single()

    if (error) {
      toast.error('Erro ao criar colaborador: ' + error.message)
      return null
    }
    toast.success('Colaborador criado')
    return data as Colaborador
  }, [])

  const atualizar = useCallback(async (id: string, colaborador: Partial<Omit<Colaborador, 'id' | 'created_at' | 'updated_at'>>) => {
    const { error } = await supabase
      .from('colaboradores')
      .update(colaborador as Partial<Colaborador>)
      .eq('id', id)

    if (error) {
      toast.error('Erro ao atualizar colaborador: ' + error.message)
      return false
    }
    toast.success('Colaborador atualizado')
    return true
  }, [])

  const remover = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('colaboradores')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Erro ao remover colaborador: ' + error.message)
      return false
    }
    toast.success('Colaborador removido')
    return true
  }, [])

  const upsertPorMatricula = useCallback(async (dados: Omit<Colaborador, 'id' | 'created_at' | 'updated_at'>) => {
    // Busca por CPF e por matrícula separadamente para detectar conflitos
    let porCpf: { id: string; empresa_id: string | null; matricula: string | null } | null = null
    let porMatricula: { id: string; empresa_id: string | null; cpf: string | null } | null = null

    if (dados.cpf) {
      let query = supabase
        .from('colaboradores')
        .select('id, empresa_id, matricula')
        .eq('cpf', dados.cpf)
      if (dados.empresa_id) query = query.eq('empresa_id', dados.empresa_id)
      const { data } = await query.maybeSingle()
      porCpf = data as { id: string; empresa_id: string | null; matricula: string | null } | null
    }

    if (dados.matricula) {
      let query = supabase
        .from('colaboradores')
        .select('id, empresa_id, cpf')
        .eq('matricula', dados.matricula)
      if (dados.empresa_id) query = query.eq('empresa_id', dados.empresa_id)
      const { data } = await query.maybeSingle()
      porMatricula = data as { id: string; empresa_id: string | null; cpf: string | null } | null
    }

    // Conflito grave: CPF e matrícula apontam para registros diferentes
    if (porCpf && porMatricula && porCpf.id !== porMatricula.id) {
      throw new Error(
        `Conflito de dados na empresa ${dados.empresa_id}: CPF ${dados.cpf} pertence a um registro e matrícula ${dados.matricula} pertence a outro. Verifique duplicatas no cadastro.`
      )
    }

    const existente = porCpf || porMatricula

    if (existente) {
      const dadosUpdate = { ...dados }
      if (existente.empresa_id) {
        delete (dadosUpdate as Partial<typeof dados>).empresa_id
      }

      // Se achou por CPF e a matrícula nova já existe em outro registro (da mesma empresa), não sobrescreve
      if (porCpf && dados.matricula && porCpf.matricula !== dados.matricula) {
        let query = supabase
          .from('colaboradores')
          .select('id')
          .eq('matricula', dados.matricula)
          .neq('id', porCpf.id)
        if (dados.empresa_id) query = query.eq('empresa_id', dados.empresa_id)
        const { data: matriculaOutro } = await query.maybeSingle()
        if (matriculaOutro) {
          delete (dadosUpdate as Partial<typeof dados>).matricula
        }
      }

      // Se achou por matrícula e o CPF novo já existe em outro registro (da mesma empresa), não sobrescreve
      if (porMatricula && dados.cpf && porMatricula.cpf !== dados.cpf) {
        let query = supabase
          .from('colaboradores')
          .select('id')
          .eq('cpf', dados.cpf)
          .neq('id', porMatricula.id)
        if (dados.empresa_id) query = query.eq('empresa_id', dados.empresa_id)
        const { data: cpfOutro } = await query.maybeSingle()
        if (cpfOutro) {
          delete (dadosUpdate as Partial<typeof dados>).cpf
        }
      }

      const { error } = await supabase.from('colaboradores').update(dadosUpdate as Partial<Colaborador>).eq('id', existente.id)
      if (error) throw error
      return { acao: 'atualizado', id: existente.id } as const
    }

    const { data, error } = await supabase.from('colaboradores').insert(dados).select().single()
    if (error) throw error
    return { acao: 'criado', id: data.id } as const
  }, [])

  return {
    colaboradores,
    loading,
    paginacao,
    listar,
    listarPaginado,
    buscarPorId,
    buscarPorCpf,
    buscarPorMatricula,
    criar,
    atualizar,
    remover,
    upsertPorMatricula,
  }
}
