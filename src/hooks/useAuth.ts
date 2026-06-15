import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { loginComEmail, logout as logoutAuth, cadastrarComEmail } from '@/lib/auth'
import type { Perfil, NivelAcesso } from '@/types/database'

const PERFIL_STORAGE_KEY = 'plena_perfil'

function lerPerfilSalvo(): Perfil | null {
  const perfilSalvo = localStorage.getItem(PERFIL_STORAGE_KEY)
  if (!perfilSalvo) return null
  try {
    return JSON.parse(perfilSalvo) as Perfil
  } catch {
    localStorage.removeItem(PERFIL_STORAGE_KEY)
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState<Perfil | null>(lerPerfilSalvo)
  const [loading, setLoading] = useState(true)

  const carregarPerfil = useCallback(async (authUser: { id: string; email?: string | null }) => {
    const { data: perfil, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (perfil) {
      setUser(perfil as Perfil)
      localStorage.setItem(PERFIL_STORAGE_KEY, JSON.stringify(perfil))
    } else if (!error || error.code === 'PGRST116') {
      const novoPerfil: Omit<Perfil, 'created_at'> = {
        id: authUser.id,
        email: authUser.email || null,
        nome: authUser.email?.split('@')[0] || 'Usuário',
        nivel_acesso: 'admin',
        empresa_id: null,
      }
      const { data: criado, error: erroInsert } = await supabase
        .from('perfis')
        .insert(novoPerfil as Partial<Perfil>)
        .select()
        .single()

      if (erroInsert) {
        console.error('Erro ao criar perfil:', erroInsert)
        setUser(novoPerfil as Perfil)
      } else {
        setUser((criado || novoPerfil) as Perfil)
        localStorage.setItem(PERFIL_STORAGE_KEY, JSON.stringify(criado || novoPerfil))
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let ignore = false

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user?: { id: string; email?: string | null } } | null } }) => {
      if (ignore) return
      if (session?.user) {
        carregarPerfil(session.user)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { id: string; email?: string | null } } | null) => {
      if (session?.user) {
        carregarPerfil(session.user)
      } else {
        setUser(null)
        localStorage.removeItem(PERFIL_STORAGE_KEY)
        setLoading(false)
      }
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [carregarPerfil])

  const login = useCallback(async (email: string, senha: string) => {
    const { user: authUser } = await loginComEmail(email, senha)
    if (authUser) await carregarPerfil(authUser)
    return authUser
  }, [carregarPerfil])

  const signUp = useCallback(async (email: string, senha: string) => {
    const { user: authUser } = await cadastrarComEmail(email, senha)
    if (authUser) await carregarPerfil(authUser)
    return authUser
  }, [carregarPerfil])

  const logout = useCallback(async () => {
    await logoutAuth()
    setUser(null)
    localStorage.removeItem(PERFIL_STORAGE_KEY)
  }, [])

  const temAcesso = useCallback((nivelMinimo: NivelAcesso | NivelAcesso[]): boolean => {
    if (!user) return false
    const niveis = Array.isArray(nivelMinimo) ? nivelMinimo : [nivelMinimo]
    const hierarquia: Record<NivelAcesso, number> = {
      visualizador: 1,
      gestor: 2,
      rh: 3,
      admin: 4,
    }
    const nivelUsuario = hierarquia[user.nivel_acesso]
    return niveis.some((n) => hierarquia[n] <= nivelUsuario)
  }, [user])

  return { user, loading, login, signUp, logout, temAcesso }
}
