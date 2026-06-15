import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Colaborador, StatusColaborador } from '@/types/database'

interface FiltrosColaborador {
  empresaId?: string
  departamento?: string
  cargo?: string
  status?: StatusColaborador
  busca?: string
}

export function useColaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(false)

  const listar = useCallback(async (filtros?: FiltrosColaborador) => {
    setLoading(true)
    let query = supabase.from('colaboradores').select('*').order('nome_completo')

    if (filtros?.empresaId) query = query.eq('empresa_id', filtros.empresaId)
    if (filtros?.departamento) query = query.ilike('departamento', filtros.departamento)
    if (filtros?.cargo) query = query.ilike('cargo', filtros.cargo)
    if (filtros?.status) query = query.eq('status', filtros.status)
    if (filtros?.busca) {
      const termo = filtros.busca.trim()
      query = query.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,matricula.ilike.%${termo}%`)
    }

    const { data, error } = await query
    if (error) {
      toast.error('Erro ao carregar colaboradores: ' + error.message)
    } else {
      setColaboradores((data || []) as Colaborador[])
    }
    setLoading(false)
    return (data || []) as Colaborador[]
  }, [])

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
    let existente: { id: string; empresa_id: string | null } | null = null

    if (dados.cpf) {
      const { data } = await supabase
        .from('colaboradores')
        .select('id, empresa_id')
        .eq('cpf', dados.cpf)
        .maybeSingle()
      existente = data as { id: string; empresa_id: string | null } | null
    }

    if (!existente && dados.matricula) {
      const { data } = await supabase
        .from('colaboradores')
        .select('id, empresa_id')
        .eq('matricula', dados.matricula)
        .maybeSingle()
      existente = data as { id: string; empresa_id: string | null } | null
    }

    if (existente) {
      const dadosUpdate = { ...dados }
      if (existente.empresa_id) {
        delete (dadosUpdate as Partial<typeof dados>).empresa_id
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
    listar,
    buscarPorId,
    buscarPorCpf,
    buscarPorMatricula,
    criar,
    atualizar,
    remover,
    upsertPorMatricula,
  }
}
