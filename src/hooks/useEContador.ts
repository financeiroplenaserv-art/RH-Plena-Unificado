import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as econtadorApi from '@/services/econtadorApi'
import type { EContadorEmpresa, EContadorFuncionario, HistoricoImportacao } from '@/types/econtador'
import type { Colaborador, Departamento, StatusColaborador } from '@/types/database'
import { useColaboradores } from './useColaboradores'
import { useEmpresas } from './useEmpresas'

export function useEContador() {
  const [empresas, setEmpresas] = useState<EContadorEmpresa[]>([])
  const [funcionarios, setFuncionarios] = useState<EContadorFuncionario[]>([])
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 })
  const [historico, setHistorico] = useState<HistoricoImportacao[]>([])

  const { upsertPorMatricula } = useColaboradores()
  const { empresas: empresasDB, listar: listarEmpresasDB } = useEmpresas()

  useEffect(() => {
    listarEmpresasDB()
  }, [listarEmpresasDB])

  const carregarToken = useCallback(async () => {
    return econtadorApi.carregarToken()
  }, [])

  const salvarToken = useCallback(async (token: string) => {
    await econtadorApi.salvarToken(token)
  }, [])

  const listarEmpresas = useCallback(async () => {
    try {
      const filtradas = await econtadorApi.listarEmpresas()
      setEmpresas(filtradas)
      if (filtradas.length === 0) {
        toast.warning('Nenhuma empresa Plena encontrada no e-Contador com este token.')
      }
      return filtradas
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao consultar empresas')
      return []
    }
  }, [])

  const listarFuncionarios = useCallback(async (empresaId: string, status?: string) => {
    setLoading(true)
    setProgresso({ atual: 0, total: 0 })

    try {
      const todos = await econtadorApi.listarFuncionarios(empresaId, {
        status,
        onProgress: (atual, total) => setProgresso({ atual, total }),
      })
      setFuncionarios(todos)
      toast.success(`${todos.length} funcionários carregados`)
      return todos
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao consultar eContador')
      return []
    } finally {
      setLoading(false)
      setProgresso({ atual: 0, total: 0 })
    }
  }, [])

  const sincronizarDepartamentos = useCallback(async (
    lista: EContadorFuncionario[],
    empresaId: string | null
  ) => {
    const nomesUnicos = Array.from(
      new Set(lista.map(f => f.departamento?.trim()).filter(Boolean))
    ) as string[]

    if (nomesUnicos.length === 0) return new Map<string, string>()

    let query = supabase.from('departamentos').select('id, nome')
    if (empresaId) {
      query = query.eq('empresa_id', empresaId)
    } else {
      query = query.is('empresa_id', null)
    }

    const { data: existentes, error: erroBusca } = await query
    if (erroBusca) throw erroBusca

    const map = new Map<string, string>()
    const existentesSet = new Set<string>()

    for (const d of (existentes || []) as Pick<Departamento, 'id' | 'nome'>[]) {
      const chave = d.nome.toLowerCase()
      map.set(chave, d.id)
      existentesSet.add(chave)
    }

    const novos = nomesUnicos.filter(n => !existentesSet.has(n.toLowerCase()))
    if (novos.length > 0) {
      const { data: inseridos, error: erroInsert } = await supabase
        .from('departamentos')
        .insert(
          novos.map(nome => ({
            nome,
            empresa_id: empresaId,
            status: 'Ativo' as const,
          }))
        )
        .select('id, nome')

      if (erroInsert) throw erroInsert

      for (const d of (inseridos || []) as Pick<Departamento, 'id' | 'nome'>[]) {
        map.set(d.nome.toLowerCase(), d.id)
      }
    }

    return map
  }, [])

  const listarHistorico = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('historico_importacoes_econtador')
        .select('*')
        .eq('usuario_id', userData.user?.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Erro ao listar histórico:', error)
        return
      }
      setHistorico(data || [])
    } catch (err) {
      console.error('Erro ao listar histórico:', err)
    }
  }, [])

  const salvarHistorico = useCallback(async (item: Omit<HistoricoImportacao, 'id' | 'created_at' | 'usuario_id'>) => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const { error } = await supabase.from('historico_importacoes_econtador').insert({
        usuario_id: userData.user?.id || null,
        empresa_id: item.empresa_id,
        empresa_nome: item.empresa_nome,
        quantidade: item.quantidade,
        importados: item.importados,
        atualizados: item.atualizados,
        erros: item.erros,
      })
      if (error) {
        console.error('Erro ao salvar histórico:', error)
      } else {
        await listarHistorico()
      }
    } catch (err) {
      console.error('Erro ao salvar histórico:', err)
    }
  }, [listarHistorico])

  const importarFuncionarios = useCallback(async (
    lista: EContadorFuncionario[],
    eContadorEmpresaId?: string,
    eContadorEmpresaNome?: string
  ) => {
    setLoading(true)
    let importados = 0
    let atualizados = 0
    let erros = 0

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const mapEmpresaPorCodigo = new Map<string, string>()
    const mapEmpresaPorNome = new Map<string, string>()

    empresasDB.forEach((e) => {
      if (e.codigo_alterdata) mapEmpresaPorCodigo.set(e.codigo_alterdata, e.id)
      if (e.nome) {
        const nomeLower = e.nome.toLowerCase().trim()
        mapEmpresaPorNome.set(nomeLower, e.id)
        if (nomeLower.includes('tech')) mapEmpresaPorNome.set('tech', e.id)
        if (nomeLower.includes('ea')) mapEmpresaPorNome.set('ea', e.id)
      }
    })

    const empresaIdPorCodigoOuNome = (codigo?: string, nome?: string): string | null => {
      if (codigo) {
        const id = mapEmpresaPorCodigo.get(codigo)
        if (id) return id
      }
      if (nome) {
        const nomeLower = nome.toLowerCase()
        const idPorNome = mapEmpresaPorNome.get(nomeLower.trim())
        if (idPorNome) return idPorNome
        if (nomeLower.includes('tech')) return mapEmpresaPorNome.get('tech') || null
        if (nomeLower.includes('ea')) return mapEmpresaPorNome.get('ea') || null
        const parcial = empresasDB.find((e) => {
          if (!e.nome) return false
          const n = e.nome.toLowerCase()
          return nomeLower.includes(n) || n.includes(nomeLower)
        })
        if (parcial) return parcial.id
      }
      return null
    }

    let empresaId = empresaIdPorCodigoOuNome(eContadorEmpresaId, eContadorEmpresaNome)

    // Se a empresa ainda não existe no banco, cria automaticamente para vincular os colaboradores
    if (!empresaId && eContadorEmpresaNome) {
      const { data: novaEmpresa, error: erroEmpresa } = await supabase
        .from('empresas')
        .insert({
          nome: eContadorEmpresaNome,
          codigo_alterdata: eContadorEmpresaId || null,
          cnpj: null,
        })
        .select()
        .single()

      if (erroEmpresa) {
        console.error('Erro ao criar empresa:', erroEmpresa)
      } else if (novaEmpresa) {
        empresaId = novaEmpresa.id
        await listarEmpresasDB()
      }
    }

    const departamentosMap = await sincronizarDepartamentos(lista, empresaId)

    for (const f of lista) {
      try {
        let status: StatusColaborador = 'Ativo'
        let afastamentoMotivo = f.afastamentodescricao || null
        let afastamentoDataInicio = f.afastamento ? f.afastamento.split('T')[0] : null
        let afastamentoDataFim = f.retorno ? f.retorno.split('T')[0] : null

        if (f.demissao) {
          status = 'Inativo'
        } else if (f.status === 'Inativo') {
          status = 'Inativo'
        } else if (afastamentoMotivo && afastamentoMotivo !== '' && afastamentoMotivo !== 'Férias') {
          if (afastamentoDataFim) {
            const dataRetorno = new Date(afastamentoDataFim + 'T00:00:00')
            if (dataRetorno < hoje) {
              status = 'Ativo'
              afastamentoMotivo = null
              afastamentoDataInicio = null
              afastamentoDataFim = null
            } else {
              status = 'Afastado'
            }
          } else {
            status = 'Afastado'
          }
        }

        const cargo = f.nomefuncao ? f.nomefuncao.split(' - ').pop() || f.nomefuncao : null
        const partesEnd = [f.rua, f.numero, f.complemento, f.bairro].filter(Boolean)
        const endereco = partesEnd.length > 0 ? partesEnd.join(', ') : null

        const dadosCompletos: Record<string, unknown> = {}
        Object.entries(f).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== '') dadosCompletos[k] = v
        })

        if (empresaId) {
          const empresa = empresasDB.find((e) => e.id === empresaId)
          if (empresa) {
            dadosCompletos.codigoEmpresa = empresa.codigo_alterdata
            dadosCompletos.nomeEmpresa = empresa.nome
          }
        }

        const dados: Omit<Colaborador, 'id' | 'created_at' | 'updated_at'> = {
          matricula: f.codigo || f.id,
          nome_completo: f.nome,
          cpf: f.cpf || null,
          rg: f.identidade || null,
          ctps: f.carteiradetrabalho || null,
          pis_pasep: f.pis || null,
          data_admissao: f.admissao ? f.admissao.split('T')[0] : null,
          data_demissao: f.demissao ? f.demissao.split('T')[0] : null,
          data_nascimento: f.nascimento ? f.nascimento.split('T')[0] : null,
          cargo,
          departamento: f.departamento,
          departamento_id: f.departamento
            ? departamentosMap.get(f.departamento.toLowerCase()) || null
            : null,
          email: f.email || null,
          telefone: f.telefone || null,
          celular: f.telefonecelular || null,
          cidade: f.cidade || null,
          estado: f.estado || null,
          cep: f.cep || null,
          endereco,
          status,
          tipo_contrato: 'CLT',
          empresa_id: empresaId,
          afastamento_motivo: afastamentoMotivo,
          afastamento_data_inicio: afastamentoDataInicio,
          afastamento_data_fim: afastamentoDataFim,
          dados_completos: dadosCompletos,
        }

        const resultado = await upsertPorMatricula(dados)
        if (resultado.acao === 'criado') importados++
        else atualizados++
      } catch (err: unknown) {
        erros++
        console.error('Erro geral:', f.nome, err)
      }
    }

    setLoading(false)
    const msg = `${importados} novos | ${atualizados} atualizados${erros > 0 ? ` | ${erros} erros` : ''}`
    toast.success(`Importação: ${msg}`)

    await salvarHistorico({
      empresa_id: eContadorEmpresaId || null,
      empresa_nome: eContadorEmpresaNome || null,
      quantidade: lista.length,
      importados,
      atualizados,
      erros,
    })

    return { importados, atualizados, erros }
  }, [empresasDB, upsertPorMatricula, sincronizarDepartamentos, listarEmpresasDB, salvarHistorico])

  const reimportar = useCallback(async (item: HistoricoImportacao) => {
    if (!item.empresa_id) {
      toast.error('Empresa não identificada no histórico')
      return null
    }
    const lista = await listarFuncionarios(item.empresa_id)
    if (lista.length === 0) return null
    return importarFuncionarios(lista, item.empresa_id, item.empresa_nome || undefined)
  }, [listarFuncionarios, importarFuncionarios])

  return {
    empresas,
    funcionarios,
    loading,
    progresso,
    historico,
    token: carregarToken,
    salvarToken,
    listarEmpresas,
    listarFuncionarios,
    importarFuncionarios,
    listarHistorico,
    reimportar,
  }
}
