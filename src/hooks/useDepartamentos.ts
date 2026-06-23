import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Departamento } from '@/types/database'

const MODO_MOCK = false

const STORAGE_KEY = 'mock_departamentos'

function gerarId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function lerMock(): Departamento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Departamento[]) : []
  } catch {
    return []
  }
}

function salvarMock(dados: Departamento[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dados))
}

export function useDepartamentos() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  const listar = useCallback(async (empresaId?: string) => {
    setLoading(true)
    try {
      if (MODO_MOCK) {
        const dados = lerMock()
        const filtrados = empresaId ? dados.filter(d => d.empresa_id === empresaId) : dados
        setDepartamentos(filtrados)
        return filtrados
      }
      let query = supabase.from('departamentos').select('*').order('nome')
      if (empresaId) query = query.eq('empresa_id', empresaId)
      const { data, error } = await query
      if (error) throw error
      setDepartamentos((data || []) as Departamento[])
      return (data || []) as Departamento[]
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar departamentos')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const criar = useCallback(async (departamento: Omit<Departamento, 'id' | 'created_at'>) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock()
        const novo: Departamento = { ...departamento, id: gerarId(), created_at: new Date().toISOString() }
        lista.push(novo)
        salvarMock(lista)
        setDepartamentos(prev => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)))
        toast.success('Departamento criado')
        return novo
      }
      const { data, error } = await supabase
        .from('departamentos')
        .insert(departamento as Partial<Departamento>)
        .select()
        .single()
      if (error) throw error
      toast.success('Departamento criado')
      await listar(departamento.empresa_id || undefined)
      return data as Departamento
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar departamento')
      return null
    }
  }, [listar])

  const atualizar = useCallback(async (id: string, departamento: Partial<Omit<Departamento, 'id' | 'created_at'>>, empresaId?: string) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock()
        const idx = lista.findIndex(d => d.id === id)
        if (idx >= 0) {
          lista[idx] = { ...lista[idx], ...departamento }
          salvarMock(lista)
          setDepartamentos(prev => prev.map(d => d.id === id ? { ...d, ...departamento } : d).sort((a, b) => a.nome.localeCompare(b.nome)))
        }
        toast.success('Departamento atualizado')
        return true
      }
      const { error } = await supabase
        .from('departamentos')
        .update(departamento as Partial<Departamento>)
        .eq('id', id)
      if (error) throw error
      toast.success('Departamento atualizado')
      await listar(empresaId)
      return true
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar departamento')
      return false
    }
  }, [listar])

  const remover = useCallback(async (id: string, empresaId?: string) => {
    try {
      if (MODO_MOCK) {
        const lista = lerMock().filter(d => d.id !== id)
        salvarMock(lista)
        setDepartamentos(prev => prev.filter(d => d.id !== id))
        toast.success('Departamento removido')
        return true
      }
      const { error } = await supabase.from('departamentos').delete().eq('id', id)
      if (error) throw error
      toast.success('Departamento removido')
      await listar(empresaId)
      return true
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover departamento')
      return false
    }
  }, [listar])

  const sincronizar = useCallback(async () => {
    if (!MODO_MOCK) {
      toast.info('Sincronização disponível apenas no modo mock')
      return { sucesso: 0, falha: 0 }
    }

    setSincronizando(true)
    const mock = lerMock()
    let sucesso = 0
    let falha = 0

    try {
      for (const d of mock) {
        const { data: existente } = await supabase
          .from('departamentos')
          .select('id')
          .eq('nome', d.nome)
          .eq('empresa_id', d.empresa_id || null)
          .maybeSingle()

        const payload = {
          nome: d.nome,
          nome_curto: d.nome_curto,
          contato_portaria: d.contato_portaria,
          empresa_id: d.empresa_id,
          endereco: d.endereco,
          bairro: d.bairro,
          cidade: d.cidade,
          estado: d.estado,
          cep: d.cep,
          nome_contato: d.nome_contato,
          telefone_contato: d.telefone_contato,
          email_contato: d.email_contato,
          nome_contato_2: d.nome_contato_2,
          telefone_contato_2: d.telefone_contato_2,
          email_contato_2: d.email_contato_2,
          status: d.status,
        }

        let error
        if (existente?.id) {
          const { error: e } = await supabase
            .from('departamentos')
            .update(payload)
            .eq('id', existente.id)
          error = e
        } else {
          const { error: e } = await supabase.from('departamentos').insert(payload)
          error = e
        }

        if (error) {
          console.error('Erro ao sincronizar departamento:', d.nome, error)
          falha++
        } else {
          sucesso++
        }
      }

      if (falha === 0) {
        toast.success(`${sucesso} departamento(s) sincronizado(s) com o Supabase`)
      } else {
        toast.warning(`${sucesso} sincronizados, ${falha} falhas`)
      }

      return { sucesso, falha }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar departamentos')
      return { sucesso, falha }
    } finally {
      setSincronizando(false)
    }
  }, [])

  return { departamentos, loading, sincronizando, listar, criar, atualizar, remover, sincronizar }
}
