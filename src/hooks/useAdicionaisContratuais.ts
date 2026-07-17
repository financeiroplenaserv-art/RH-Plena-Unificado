import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { safeJsonParse } from '@/lib/utils'
import type {
  ContratoAdicional,
  VinculoAdicional,
  DiaCalendarioAdicional,
  AdicionalTipo,
  StatusDiaAdicional,
} from '@/types/adicionais'

const MODO_MOCK = false

const COLUNAS_CONTRATO = 'id, nome, departamento_id, quantidade_colaboradores, regime_trabalho, adicionais, dias_intrajornada, created_at, updated_at'
const COLUNAS_VINCULO = 'id, contrato_id, colaborador_id, data_inicio, data_fim, created_at'
const COLUNAS_CALENDARIO = 'id, vinculo_id, data, status, intrajornada, substituto_colaborador_id, substituto_colaborador_nome, created_at, updated_at'

function mockKey(tabela: string) {
  return `mock_${tabela}_adicionais`
}

function lerMock<T>(tabela: string): T[] {
  try {
    const raw = localStorage.getItem(mockKey(tabela))
    return raw ? safeJsonParse<T[]>(raw, []) : []
  } catch (err) {
    console.error(`Erro ao ler mock de ${tabela}:`, err)
    return []
  }
}

function salvarMock<T>(tabela: string, dados: T[]) {
  localStorage.setItem(mockKey(tabela), JSON.stringify(dados))
}

function lerMockRaw(tabela: string): unknown[] {
  try {
    const raw = localStorage.getItem(mockKey(tabela))
    return raw ? safeJsonParse<unknown[]>(raw, []) : []
  } catch (err) {
    console.error(`Erro ao ler mock raw de ${tabela}:`, err)
    return []
  }
}

function buscarColaboradorMock(id: string): { nome_completo: string; matricula: string } | undefined {
  const lista = lerMockRaw('colaboradores') as Array<Record<string, unknown>>
  const c = lista.find(x => x.id === id)
  if (!c) return undefined
  return {
    nome_completo: String(c.nome_completo || ''),
    matricula: String(c.matricula || ''),
  }
}

function buscarContratoMock(id: string): ContratoAdicional | undefined {
  const lista = lerMockRaw('contratos_adicionais') as ContratoAdicional[]
  return lista.find(c => c.id === id)
}

function enriquecerVinculoMock(v: VinculoAdicional): VinculoAdicional {
  const atualizado = { ...v }
  const colaborador = buscarColaboradorMock(v.colaborador_id)
  const contrato = buscarContratoMock(v.contrato_id)

  if (colaborador && !atualizado.colaborador_nome) {
    atualizado.colaborador_nome = colaborador.nome_completo
  }
  if (colaborador && !atualizado.colaborador_matricula) {
    atualizado.colaborador_matricula = colaborador.matricula
  }
  if (contrato && !atualizado.contrato_nome) {
    atualizado.contrato_nome = contrato.nome
  }
  if (contrato && (!atualizado.adicionais || atualizado.adicionais.length === 0)) {
    atualizado.adicionais = extrairAdicionaisAtivos(contrato)
  }

  return atualizado
}

function gerarId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function normalizarStatusDia(status: unknown): StatusDiaAdicional {
  if (
    status === 'trabalhou' ||
    status === 'falta' ||
    status === 'ferias' ||
    status === 'afastado' ||
    status === 'folga' ||
    status === 'folga_substituicao'
  ) {
    return status
  }
  return 'trabalhou'
}

function extrairAdicionaisAtivos(contrato: ContratoAdicional | undefined): AdicionalTipo[] {
  if (!contrato) return []
  return Object.entries(contrato.adicionais)
    .filter(([, ativo]) => ativo)
    .map(([key]) => key as AdicionalTipo)
}

export function useAdicionaisContratuais() {
  const [contratos, setContratos] = useState<ContratoAdicional[]>([])
  const [vinculos, setVinculos] = useState<VinculoAdicional[]>([])
  const [calendario, setCalendario] = useState<DiaCalendarioAdicional[]>([])
  const [loading, setLoading] = useState(false)

  // Recarrega dados do mock quando outra aba/página alterar o localStorage
  useEffect(() => {
    if (!MODO_MOCK) return

    const recarregar = () => {
      setContratos(lerMock<ContratoAdicional>('contratos'))
      setVinculos(lerMock<VinculoAdicional>('vinculos'))
      setCalendario(lerMock<DiaCalendarioAdicional>('calendario'))
    }

    window.addEventListener('storage', recarregar)
    window.addEventListener('focus', recarregar)

    return () => {
      window.removeEventListener('storage', recarregar)
      window.removeEventListener('focus', recarregar)
    }
  }, [])

  // Contratos
  const listarContratos = useCallback(async () => {
    setLoading(true)
    try {
      if (MODO_MOCK) {
        const dados = lerMock<ContratoAdicional>('contratos')
        setContratos(dados)
        return dados
      }
      const { data, error } = await supabase
        .from('contratos_adicionais')
        .select(`${COLUNAS_CONTRATO}, departamentos(nome)`)
        .order('nome')
      if (error) throw error
      const normalizado = (data || []).map((c: Record<string, unknown>) => ({
        ...c,
        departamento_nome: (c.departamentos as { nome?: string } | undefined)?.nome,
      })) as ContratoAdicional[]
      setContratos(normalizado)
      return normalizado
    } catch (err: unknown) {
      console.error('Erro ao carregar contratos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar contratos')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const criarContrato = useCallback(async (dados: Omit<ContratoAdicional, 'id' | 'created_at' | 'updated_at' | 'departamento_nome'>) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<ContratoAdicional>('contratos')
        const novo: ContratoAdicional = { ...dados, id: gerarId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        const atualizada = [...lista, novo]
        salvarMock('contratos', atualizada)
        setContratos(atualizada)
        toast.success('Contrato criado')
        return novo
      }
      const { data, error } = await supabase.from('contratos_adicionais').insert(dados).select(COLUNAS_CONTRATO).single()
      if (error) throw error
      toast.success('Contrato criado')
      await listarContratos()
      return data as ContratoAdicional
    } catch (err: unknown) {
      console.error('Erro ao criar contrato:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao criar contrato')
      return null
    }
  }, [listarContratos])

  const atualizarContrato = useCallback(async (id: string, dados: Partial<Omit<ContratoAdicional, 'id' | 'created_at' | 'updated_at' | 'departamento_nome'>>) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<ContratoAdicional>('contratos')
        const atualizada = lista.map(c => c.id === id ? { ...c, ...dados, updated_at: new Date().toISOString() } : c)
        if (atualizada.some(c => c.id === id)) {
          salvarMock('contratos', atualizada)
          setContratos(atualizada)
        }
        toast.success('Contrato atualizado')
        return true
      }
      const { error } = await supabase.from('contratos_adicionais').update(dados).eq('id', id)
      if (error) throw error
      toast.success('Contrato atualizado')
      await listarContratos()
      return true
    } catch (err: unknown) {
      console.error('Erro ao atualizar contrato:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar contrato')
      return false
    }
  }, [listarContratos])

  const removerContrato = useCallback(async (id: string) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<ContratoAdicional>('contratos').filter(c => c.id !== id)
        salvarMock('contratos', lista)
        setContratos(lista)
        toast.success('Contrato removido')
        return true
      }
      const { error } = await supabase.from('contratos_adicionais').delete().eq('id', id)
      if (error) throw error
      toast.success('Contrato removido')
      await listarContratos()
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover contrato:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover contrato')
      return false
    }
  }, [listarContratos])

  // Vínculos
  const listarVinculos = useCallback(async () => {
    setLoading(true)
    try {
      if (MODO_MOCK) {
        const dados = lerMock<VinculoAdicional>('vinculos').map(enriquecerVinculoMock)
        setVinculos(dados)
        return dados
      }
      const { data, error } = await supabase
        .from('vinculos_adicionais')
        .select(`${COLUNAS_VINCULO}, contratos_adicionais(nome, adicionais), colaboradores(nome_completo, matricula)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      const normalizado = (data || []).map((v: Record<string, unknown>) => {
        const contrato = v.contratos_adicionais as { nome?: string; adicionais?: Record<string, boolean> } | undefined
        const colaborador = v.colaboradores as { nome_completo?: string; matricula?: string } | undefined
        return {
          ...v,
          contrato_nome: contrato?.nome,
          colaborador_nome: colaborador?.nome_completo,
          colaborador_matricula: colaborador?.matricula,
          adicionais: contrato?.adicionais
            ? Object.entries(contrato.adicionais).filter(([, ativo]) => ativo).map(([key]) => key as AdicionalTipo)
            : [],
        }
      }) as VinculoAdicional[]
      setVinculos(normalizado)
      return normalizado
    } catch (err: unknown) {
      console.error('Erro ao carregar vínculos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar vínculos')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const criarVinculo = useCallback(async (dados: Omit<VinculoAdicional, 'id' | 'created_at'>) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<VinculoAdicional>('vinculos')
        const enriquecido = enriquecerVinculoMock({ ...dados, id: gerarId() } as VinculoAdicional)
        const novo: VinculoAdicional = { ...enriquecido, id: gerarId(), created_at: new Date().toISOString() }
        const atualizada = [...lista, novo]
        salvarMock('vinculos', atualizada)
        setVinculos(atualizada)
        toast.success('Vínculo criado')
        return novo
      }
      const payload = {
        contrato_id: dados.contrato_id,
        colaborador_id: dados.colaborador_id,
        data_inicio: dados.data_inicio,
        data_fim: dados.data_fim,
      }
      const { data, error } = await supabase.from('vinculos_adicionais').insert(payload).select(COLUNAS_VINCULO).single()
      if (error) throw error
      toast.success('Vínculo criado')
      await listarVinculos()
      return data as VinculoAdicional
    } catch (err: unknown) {
      console.error('Erro ao criar vínculo:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao criar vínculo')
      return null
    }
  }, [listarVinculos])

  const atualizarVinculo = useCallback(async (id: string, dados: Partial<Omit<VinculoAdicional, 'id' | 'created_at'>>) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<VinculoAdicional>('vinculos')
        const atualizada = lista.map(v => v.id === id ? { ...v, ...dados } : v)
        if (atualizada.some(v => v.id === id)) {
          salvarMock('vinculos', atualizada)
          setVinculos(atualizada)
        }
        toast.success('Vínculo atualizado')
        return true
      }
      const payload: Partial<Pick<VinculoAdicional, 'contrato_id' | 'data_inicio' | 'data_fim'>> = {}
      if (dados.contrato_id !== undefined) payload.contrato_id = dados.contrato_id
      if (dados.data_inicio !== undefined) payload.data_inicio = dados.data_inicio
      if (dados.data_fim !== undefined) payload.data_fim = dados.data_fim
      const { error } = await supabase.from('vinculos_adicionais').update(payload).eq('id', id)
      if (error) throw error
      toast.success('Vínculo atualizado')
      await listarVinculos()
      return true
    } catch (err: unknown) {
      console.error('Erro ao atualizar vínculo:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar vínculo')
      return false
    }
  }, [listarVinculos])

  const corrigirVinculosExistentes = useCallback(async (contratosDisponiveis: ContratoAdicional[], colaboradoresDisponiveis: { id: string; nome_completo: string; matricula: string }[]) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<VinculoAdicional>('vinculos')
        let alterados = 0
        const corrigida = lista.map(v => {
          const contrato = contratosDisponiveis.find(c => c.id === v.contrato_id)
          const colaborador = colaboradoresDisponiveis.find(c => c.id === v.colaborador_id)
          const atualizado = { ...v }
          let mudou = false

          if (colaborador && !atualizado.colaborador_nome) {
            atualizado.colaborador_nome = colaborador.nome_completo
            mudou = true
          }
          if (colaborador && !atualizado.colaborador_matricula) {
            atualizado.colaborador_matricula = colaborador.matricula
            mudou = true
          }
          if (contrato && !atualizado.contrato_nome) {
            atualizado.contrato_nome = contrato.nome
            mudou = true
          }
          if (contrato && (!atualizado.adicionais || atualizado.adicionais.length === 0)) {
            atualizado.adicionais = extrairAdicionaisAtivos(contrato)
            mudou = true
          }

          if (mudou) alterados++
          return atualizado
        })
        salvarMock('vinculos', corrigida)
        setVinculos(corrigida)
        toast.success(`${alterados} vínculo(s) corrigido(s)`)
        return { ok: true, alterados }
      }
      toast.info('Correção disponível apenas no modo mock')
      return { ok: true, alterados: 0 }
    } catch (err: unknown) {
      console.error('Erro ao corrigir vínculos:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao corrigir vínculos')
      return { ok: false, alterados: 0 }
    }
  }, [])

  const removerVinculo = useCallback(async (id: string) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<VinculoAdicional>('vinculos').filter(v => v.id !== id)
        salvarMock('vinculos', lista)
        setVinculos(lista)
        toast.success('Vínculo removido')
        return true
      }
      const { error } = await supabase.from('vinculos_adicionais').delete().eq('id', id)
      if (error) throw error
      toast.success('Vínculo removido')
      await listarVinculos()
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover vínculo:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover vínculo')
      return false
    }
  }, [listarVinculos])

  // Calendário
  const listarCalendario = useCallback(async (filtro?: { dataInicio: string; dataFim: string }) => {
    setLoading(true)
    try {
      if (MODO_MOCK) {
        const dados = lerMock<DiaCalendarioAdicional>('calendario').map(d => ({
          ...d,
          status: normalizarStatusDia(d.status),
        }))
        // Carrega todos os dados do mock; o filtro de período é aplicado na renderização.
        // Isso evita que o state fique vazio quando o usuário navega entre períodos.
        setCalendario(dados)
        return dados
      }
      let query = supabase.from('calendario_adicionais').select(COLUNAS_CALENDARIO)
      if (filtro) query = query.gte('data', filtro.dataInicio).lte('data', filtro.dataFim)
      const { data, error } = await query
      if (error) throw error
      setCalendario(data || [])
      return data || []
    } catch (err: unknown) {
      console.error('Erro ao carregar calendário:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar calendário')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const salvarDiaCalendario = useCallback(async (dados: Omit<DiaCalendarioAdicional, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<DiaCalendarioAdicional>('calendario')
        const payload = { ...dados, status: normalizarStatusDia(dados.status), intrajornada: dados.intrajornada ?? false }
        const existe = lista.some(d => d.vinculo_id === payload.vinculo_id && d.data === payload.data)
        const atualizada: DiaCalendarioAdicional[] = existe
          ? lista.map(d => d.vinculo_id === payload.vinculo_id && d.data === payload.data
              ? { ...d, ...payload, updated_at: new Date().toISOString() }
              : d)
          : [...lista, { ...payload, id: gerarId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]
        salvarMock('calendario', atualizada)
        setCalendario(atualizada)
        return true
      }
      const { error } = await supabase
        .from('calendario_adicionais')
        .upsert(dados, { onConflict: 'vinculo_id,data' })
      if (error) throw error
      await listarCalendario({ dataInicio: dados.data, dataFim: dados.data })
      return true
    } catch (err: unknown) {
      console.error('Erro ao salvar dia no calendário:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar dia')
      return false
    }
  }, [listarCalendario])

  const salvarSubstituicao = useCallback(async (
    vinculoOriginalId: string,
    data: string,
    substitutoColaboradorId: string,
    substitutoColaboradorNome: string,
    statusAtual: StatusDiaAdicional = 'falta'
  ) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<DiaCalendarioAdicional>('calendario')
        const existe = lista.some(d => d.vinculo_id === vinculoOriginalId && d.data === data)
        const atualizada: DiaCalendarioAdicional[] = existe
          ? lista.map(d => d.vinculo_id === vinculoOriginalId && d.data === data
              ? {
                  ...d,
                  status: statusAtual,
                  substituto_colaborador_id: substitutoColaboradorId,
                  substituto_colaborador_nome: substitutoColaboradorNome,
                  updated_at: new Date().toISOString(),
                }
              : d)
          : [
              ...lista,
              {
                vinculo_id: vinculoOriginalId,
                data,
                status: statusAtual,
                intrajornada: false,
                substituto_colaborador_id: substitutoColaboradorId,
                substituto_colaborador_nome: substitutoColaboradorNome,
                id: gerarId(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ]
        salvarMock('calendario', atualizada)
        setCalendario(atualizada)
        toast.success('Substituto registrado')
        return true
      }
      const { error } = await supabase
        .from('calendario_adicionais')
        .upsert(
          {
            vinculo_id: vinculoOriginalId,
            data,
            status: statusAtual,
            intrajornada: false,
            substituto_colaborador_id: substitutoColaboradorId,
            substituto_colaborador_nome: substitutoColaboradorNome,
          },
          { onConflict: 'vinculo_id,data' }
        )
      if (error) throw error
      toast.success('Substituto registrado')
      return true
    } catch (err: unknown) {
      console.error('Erro ao salvar substituto:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar substituto')
      return false
    }
  }, [])

  const removerSubstituicao = useCallback(async (vinculoOriginalId: string, data: string) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<DiaCalendarioAdicional>('calendario').map(d => {
          if (d.vinculo_id === vinculoOriginalId && d.data === data) {
            return { ...d, substituto_colaborador_id: null, substituto_colaborador_nome: null }
          }
          return d
        })
        salvarMock('calendario', lista)
        setCalendario(lista)
        toast.success('Substituição removida')
        return true
      }
      const { error } = await supabase
        .from('calendario_adicionais')
        .update({ substituto_colaborador_id: null, substituto_colaborador_nome: null })
        .eq('vinculo_id', vinculoOriginalId)
        .eq('data', data)
      if (error) throw error
      toast.success('Substituição removida')
      return true
    } catch (err: unknown) {
      console.error('Erro ao remover substituição:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao remover substituição')
      return false
    }
  }, [])

  const excluirDiaCalendario = useCallback(async (vinculoId: string, data: string) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock<DiaCalendarioAdicional>('calendario').filter(d => !(d.vinculo_id === vinculoId && d.data === data))
        salvarMock('calendario', lista)
        setCalendario(lista)
        return true
      }
      const { error } = await supabase.from('calendario_adicionais').delete().eq('vinculo_id', vinculoId).eq('data', data)
      if (error) throw error
      await listarCalendario({ dataInicio: data, dataFim: data })
      return true
    } catch (err: unknown) {
      console.error('Erro ao excluir dia do calendário:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir dia')
      return false
    }
  }, [listarCalendario])

  // Helpers
  const diaIntrajornada = useCallback((contrato: ContratoAdicional | undefined, dataStr: string) => {
    if (!contrato || !contrato.adicionais.intrajornada) return false
    const dia = new Date(dataStr + 'T00:00:00').getDay()
    return contrato.dias_intrajornada.includes(dia)
  }, [])

  return {
    contratos,
    vinculos,
    calendario,
    loading,
    listarContratos,
    criarContrato,
    atualizarContrato,
    removerContrato,
    listarVinculos,
    criarVinculo,
    atualizarVinculo,
    corrigirVinculosExistentes,
    removerVinculo,
    listarCalendario,
    salvarDiaCalendario,
    salvarSubstituicao,
    removerSubstituicao,
    excluirDiaCalendario,
    diaIntrajornada,
  }
}
