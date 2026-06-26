import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { setPermissoesCache } from '@/lib/permissoes'
import type { PermissaoPerfil, NivelAcesso } from '@/types/database'

export function usePermissoes() {
  const [permissoes, setPermissoes] = useState<PermissaoPerfil[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregarPermissoes = useCallback(async (perfil?: NivelAcesso) => {
    setLoading(true)
    try {
      let query = supabase
        .from('permissoes_perfil')
        .select('*')
        .order('perfil', { ascending: true })
        .order('recurso', { ascending: true })
        .order('acao', { ascending: true })

      if (perfil) {
        query = query.eq('perfil', perfil)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao carregar permissões:', error)
        toast.error('Erro ao carregar permissões')
        setPermissoes([])
        setPermissoesCache([])
      } else {
        const lista = (data as PermissaoPerfil[]) || []
        setPermissoes(lista)
        setPermissoesCache(lista)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const salvarPermissoes = useCallback(async (novasPermissoes: PermissaoPerfil[]) => {
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('permissoes_perfil')
        .upsert(
          novasPermissoes.map((p) => ({
            perfil: p.perfil,
            recurso: p.recurso,
            acao: p.acao,
            permitido: p.permitido,
          })),
          { onConflict: 'perfil,recurso,acao' }
        )

      if (error) {
        console.error('Erro ao salvar permissões:', error)
        toast.error('Erro ao salvar permissões: ' + error.message)
        return false
      }

      toast.success('Permissões salvas com sucesso')
      const atualizadas = novasPermissoes.map((p) => ({ ...p }))
      setPermissoesCache(atualizadas)
      await carregarPermissoes()
      return true
    } catch (err: unknown) {
      console.error('Erro ao salvar permissões:', err)
      toast.error('Erro ao salvar permissões')
      return false
    } finally {
      setSalvando(false)
    }
  }, [carregarPermissoes])

  const temPermissao = useCallback(
    (perfil: NivelAcesso, recurso: string, acao: string): boolean => {
      // Admin/ADM sempre tem permissão
      if (perfil === 'admin' || perfil === 'adm') return true

      // Permissão genérica "todos"
      const permissaoTodos = permissoes.find(
        (p) => p.perfil === perfil && p.recurso === 'todos' && p.acao === 'todos'
      )
      if (permissaoTodos?.permitido) return true

      const permissao = permissoes.find(
        (p) => p.perfil === perfil && p.recurso === recurso && p.acao === acao
      )
      return permissao?.permitido ?? false
    },
    [permissoes]
  )

  return {
    permissoes,
    loading,
    salvando,
    carregarPermissoes,
    salvarPermissoes,
    temPermissao,
  }
}
