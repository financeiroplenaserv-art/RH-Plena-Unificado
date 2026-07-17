import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as econtadorApi from '@/services/econtadorApi'
import type { EContadorEmpresa, EContadorFuncionario, HistoricoImportacao } from '@/types/econtador'
import type { Colaborador, Departamento, StatusColaborador } from '@/types/database'
import { useColaboradores } from './useColaboradores'
import { useEmpresas } from './useEmpresas'

const COLUNAS_HISTORICO_IMPORTACAO = 'id, usuario_id, empresa_id, empresa_nome, quantidade, importados, atualizados, erros, detalhes_erros, created_at'

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
    try {
      return await econtadorApi.carregarToken()
    } catch (err: unknown) {
      console.error('Erro ao carregar token do e-Contador:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar token do e-Contador')
      return null
    }
  }, [])

  const salvarToken = useCallback(async (token: string) => {
    try {
      await econtadorApi.salvarToken(token)
      toast.success('Token salvo')
      return true
    } catch (err: unknown) {
      console.error('Erro ao salvar token do e-Contador:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar token do e-Contador')
      return false
    }
  }, [])

  const removerToken = useCallback(async () => {
    try {
      await econtadorApi.removerToken()
      toast.success('Token removido')
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover token do e-Contador:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover token do e-Contador')
      return false
    }
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
      console.error('Erro ao consultar empresas do e-Contador:', err)
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
      const lista = Array.isArray(todos)
        ? todos
            .filter((f): f is EContadorFuncionario => !!f && typeof f === 'object' && 'id' in f)
            .map((f) => ({
              ...f,
              nome: String(f.nome ?? ''),
              codigo: String(f.codigo ?? ''),
              cpf: String(f.cpf ?? ''),
              status: String(f.status ?? ''),
              departamento: typeof f.departamento === 'string' ? f.departamento : null,
            }))
        : []
      setFuncionarios(lista)
      toast.success(`${lista.length} funcionários carregados`)
      return todos
    } catch (err: unknown) {
      console.error('Erro ao consultar funcionários do e-Contador:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao consultar eContador')
      return []
    } finally {
      setLoading(false)
      setProgresso({ atual: 0, total: 0 })
    }
  }, [])

  const normalizarMatch = (texto: string): string => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  const sincronizarDepartamentos = useCallback(async (
    lista: EContadorFuncionario[],
    empresaId: string | null
  ) => {
    const nomesUnicos = Array.from(
      new Set(lista.map(f => f.departamento?.trim()).filter(Boolean))
    ) as string[]

    if (nomesUnicos.length === 0) return new Map<string, string>()

    // Busca todos os departamentos ativos da empresa (ou sem empresa)
    let query = supabase.from('departamentos').select('id, nome, nome_curto')
    if (empresaId) {
      query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    }
    query = query.eq('status', 'Ativo')

    const { data: existentes, error: erroBusca } = await query
    if (erroBusca) throw erroBusca

    const map = new Map<string, string>()
    const novos: string[] = []

    for (const nomeEContador of nomesUnicos) {
      const nomeChave = nomeEContador.toLowerCase()

      // 1. Tenta match exato pelo nome
      const matchExato = (existentes || []).find(
        d => d.nome.toLowerCase() === nomeChave
      )
      if (matchExato) {
        map.set(nomeChave, matchExato.id)
        continue
      }

      // 2. Tenta match pelo nome_curto contido no nome do e-contador (palavra inteira)
      const nomeNormalizado = normalizarMatch(nomeEContador)
      const matchCurto = (existentes || []).find((d) => {
        if (!d.nome_curto) return false
        const curtoNormalizado = normalizarMatch(d.nome_curto)
        if (curtoNormalizado.length < 2) return false
        const regex = new RegExp(`\\b${curtoNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
        return regex.test(nomeNormalizado)
      })
      if (matchCurto) {
        map.set(nomeChave, matchCurto.id)
        continue
      }

      // 3. Se não achou, vai criar novo
      novos.push(nomeEContador)
    }

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
      const { data: userData, error: erroAuth } = await supabase.auth.getUser()
      if (erroAuth) throw erroAuth

      const { data, error } = await supabase
        .from('historico_importacoes_econtador')
        .select(COLUNAS_HISTORICO_IMPORTACAO)
        .eq('usuario_id', userData.user?.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setHistorico(data || [])
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao listar histórico de importações'
      console.error('Erro ao listar histórico:', err)
      toast.error(mensagem)
    }
  }, [])

  const salvarHistorico = useCallback(async (item: Omit<HistoricoImportacao, 'id' | 'created_at' | 'usuario_id'>) => {
    try {
      const { data: userData, error: erroAuth } = await supabase.auth.getUser()
      if (erroAuth) throw erroAuth

      const { error } = await supabase.from('historico_importacoes_econtador').insert({
        usuario_id: userData.user?.id || null,
        empresa_id: item.empresa_id,
        empresa_nome: item.empresa_nome,
        quantidade: item.quantidade,
        importados: item.importados,
        atualizados: item.atualizados,
        erros: item.erros,
        detalhes_erros: item.detalhes_erros || [],
      })
      if (error) throw error
      await listarHistorico()
    } catch (err: unknown) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao salvar histórico de importação'
      console.error('Erro ao salvar histórico:', err)
      toast.error(mensagem)
    }
  }, [listarHistorico])

  const importarFuncionarios = useCallback(async (
    lista: EContadorFuncionario[],
    eContadorEmpresaId?: string,
    eContadorEmpresaNome?: string
  ): Promise<{ importados: number; atualizados: number; erros: number; detalhesErros: { nome: string; erro: string }[] }> => {
    setLoading(true)
    let importados = 0
    let atualizados = 0
    let erros = 0
    const detalhesErros: { nome: string; erro: string }[] = []

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
        .select('id')
        .single()

      if (erroEmpresa) {
        const msg = 'Erro ao criar empresa: ' + erroEmpresa.message
        console.error(msg, erroEmpresa)
        toast.error(msg)
        detalhesErros.push({ nome: eContadorEmpresaNome, erro: msg })
        erros++
      } else if (novaEmpresa) {
        empresaId = novaEmpresa.id
        await listarEmpresasDB()
      }
    }

    let departamentosMap = new Map<string, string>()
    try {
      departamentosMap = await sincronizarDepartamentos(lista, empresaId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao sincronizar departamentos'
      console.error('Erro ao sincronizar departamentos:', err)
      toast.error(msg)
      detalhesErros.push({ nome: 'Sincronização de departamentos', erro: msg })
      erros++
    }

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
        let mensagem = 'Erro desconhecido'
        let erroSerializado = String(err)
        if (err instanceof Error) {
          mensagem = err.message
          erroSerializado = JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
        } else if (typeof err === 'string') {
          mensagem = err
        } else if (err && typeof err === 'object') {
          try {
            erroSerializado = JSON.stringify(err, null, 2)
            mensagem = erroSerializado.slice(0, 500)
          } catch {
            erroSerializado = 'Erro não serializável'
            mensagem = erroSerializado
          }
        }
        detalhesErros.push({ nome: f.nome, erro: mensagem })
        console.error('Erro geral:', f.nome, '\n', erroSerializado, '\nDados do funcionário:', f)
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
      detalhes_erros: detalhesErros,
    })

    return { importados, atualizados, erros, detalhesErros }
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
    removerToken,
    listarEmpresas,
    listarFuncionarios,
    importarFuncionarios,
    listarHistorico,
    reimportar,
  }
}
