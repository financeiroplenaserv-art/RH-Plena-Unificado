import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { encontrarDepartamentoFuzzy, idsColaboradoresDoDepartamento, type DepartamentoFuzzy } from '@/lib/departamentos'
import type { Colaborador, StatusColaborador } from '@/types/database'
import type { Paginacao, ResultadoPaginado } from '@/types'

interface FiltrosColaborador {
  empresaId?: string
  departamento?: string
  departamentoId?: string
  departamentoNomeCurto?: string
  cargo?: string
  status?: StatusColaborador
  busca?: string
}

const COLUNAS_LISTAGEM = 'id, matricula, nome_completo, cpf, rg, ctps, pis_pasep, data_admissao, data_demissao, data_nascimento, cargo, departamento, departamento_id, email, telefone, celular, cidade, estado, cep, endereco, status, tipo_contrato, empresa_id, afastamento_motivo, afastamento_data_inicio, afastamento_data_fim, tamanho_camisa, tamanho_calca, tamanho_calcado, created_at, updated_at'

// Subconjunto leve para dropdowns/autocompletes (sem documentos, contato,
// endereço e tamanhos — ~70% menos bytes por linha).
const COLUNAS_RESUMIDO = 'id, matricula, nome_completo, status, cargo, departamento, departamento_id, empresa_id, cpf, data_admissao'

const TAMANHO_PADRAO = 50

export function useColaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(false)
  const [paginacao, setPaginacao] = useState<ResultadoPaginado<Colaborador> | null>(null)

  /** Lista resumida para selects/autocompletes. Use `listar`/`listarPaginado` quando precisar da ficha completa. */
  const listarResumido = useCallback(async (filtros?: { status?: StatusColaborador }) => {
    setLoading(true)
    let query = supabase.from('colaboradores').select(COLUNAS_RESUMIDO).order('nome_completo')
    if (filtros?.status) query = query.eq('status', filtros.status)
    const { data, error } = await query
    if (error) {
      toast.error('Erro ao carregar colaboradores: ' + error.message)
      setLoading(false)
      return []
    }
    setColaboradores((data || []) as Colaborador[])
    setLoading(false)
    return (data || []) as Colaborador[]
  }, [])

  const montarQuery = useCallback(async (filtros?: FiltrosColaborador) => {
    // Filtro por departamento resolve os IDs dos colaboradores NO CLIENTE
    // (encontrarDepartamentoFuzzy): o texto legado de colaboradores.departamento
    // não bate com o cadastro por acentos/pontuação ("ALIANCA S A INDUSTRIA..."
    // vs "Aliança S.A. Indústria...") e o ILIKE do banco voltava vazio.
    let idsPorDepartamento: Set<string> | null = null

    if (filtros?.departamentoId && filtros.departamentoId !== 'todos') {
      const [{ data: deptData }, { data: colabData }] = await Promise.all([
        supabase.from('departamentos').select('id, nome, nome_curto, empresa_id'),
        supabase.from('colaboradores').select('id, departamento_id, departamento, empresa_id'),
      ])
      const departamentos = (deptData || []) as DepartamentoFuzzy[]
      idsPorDepartamento = new Set(
        (colabData || [])
          .filter(
            (c) =>
              encontrarDepartamentoFuzzy(departamentos, c.departamento_id, c.departamento, c.empresa_id)?.id ===
              filtros.departamentoId
          )
          .map((c) => c.id)
      )
    } else if (filtros?.departamentoNomeCurto && filtros.departamentoNomeCurto !== 'todos') {
      const [{ data: deptData }, { data: colabData }] = await Promise.all([
        supabase.from('departamentos').select('id, nome, nome_curto, empresa_id'),
        supabase.from('colaboradores').select('id, departamento_id, departamento, empresa_id'),
      ])
      idsPorDepartamento = idsColaboradoresDoDepartamento(
        (deptData || []) as DepartamentoFuzzy[],
        colabData || [],
        filtros.departamentoNomeCurto
      )
    }

    if (idsPorDepartamento && idsPorDepartamento.size === 0) {
      return { query: null, idsPorDepartamento, vazio: true as const }
    }

    let query = supabase.from('colaboradores').select(COLUNAS_LISTAGEM).order('nome_completo')

    if (filtros?.empresaId) query = query.eq('empresa_id', filtros.empresaId)
    if (filtros?.departamento) query = query.ilike('departamento', filtros.departamento)
    if (idsPorDepartamento) query = query.in('id', [...idsPorDepartamento])
    if (filtros?.cargo) query = query.ilike('cargo', filtros.cargo)
    if (filtros?.status) query = query.eq('status', filtros.status)
    if (filtros?.busca) {
      const termo = filtros.busca.trim()
      query = query.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,matricula.ilike.%${termo}%`)
    }

    return { query, idsPorDepartamento, vazio: false }
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
      .select('id', { count: 'exact', head: true })

    // Reaplica os mesmos filtros na contagem
    if (filtros?.empresaId) countQuery.eq('empresa_id', filtros.empresaId)
    if (filtros?.departamento) countQuery.ilike('departamento', filtros.departamento)
    if (montada.idsPorDepartamento) countQuery.in('id', [...montada.idsPorDepartamento])
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

  const atualizar = useCallback(async (id: string, colaborador: Partial<Omit<Colaborador, 'id' | 'created_at' | 'updated_at'>>) => {
    // .select('id') para detectar UPDATE bloqueado por RLS: sem o select,
    // o PostgREST retorna sucesso com 0 linhas afetadas e a tela mostraria
    // o toast de sucesso sem nada ter mudado.
    const { data, error } = await supabase
      .from('colaboradores')
      .update(colaborador as Partial<Colaborador>)
      .eq('id', id)
      .select('id')

    if (error) {
      toast.error('Erro ao atualizar colaborador: ' + error.message)
      return false
    }
    if (!data || data.length === 0) {
      toast.error('Sem permissão para atualizar este colaborador')
      return false
    }
    toast.success('Colaborador atualizado')
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

      // .select('id') para detectar UPDATE bloqueado por RLS: sem o select,
      // o PostgREST retorna sucesso com 0 linhas afetadas e o retorno fingiria sucesso.
      const { data: atualizado, error } = await supabase
        .from('colaboradores')
        .update(dadosUpdate as Partial<Colaborador>)
        .eq('id', existente.id)
        .select('id')
      if (error) throw error
      if (!atualizado || atualizado.length === 0) {
        throw new Error('Sem permissão para atualizar este colaborador')
      }
      return { acao: 'atualizado', id: existente.id } as const
    }

    const { data, error } = await supabase.from('colaboradores').insert(dados).select(COLUNAS_LISTAGEM).single()
    if (error) throw error
    return { acao: 'criado', id: data.id } as const
  }, [])

  return {
    colaboradores,
    loading,
    paginacao,
    listar,
    listarResumido,
    listarPaginado,
    atualizar,
    upsertPorMatricula,
  }
}
