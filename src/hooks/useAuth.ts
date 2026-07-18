import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { loginComEmail, logout as logoutAuth, cadastrarComEmail } from '@/lib/auth'
import { setPermissoesCache } from '@/lib/permissoes'
import type { Perfil, NivelAcesso } from '@/types/database'

const COLUNAS_PERMISSOES_PERFIL = 'perfil, recurso, acao, permitido'
const COLUNAS_PERFIL = 'id, email, nome, nivel_acesso, empresa_id, consentimento_lgpd, consentimento_lgpd_data, consentimento_lgpd_versao, consentimento_lgpd_finalidades, created_at'

const PERFIL_STORAGE_KEY = 'plena_perfil'

// Perfis legados mantidos para compatibilidade
const PERFIS_ADMIN: NivelAcesso[] = ['admin', 'adm']
const PERFIS_EDITOR: NivelAcesso[] = [
  'admin',
  'adm',
  'gestor',
  'rh',
  'dp1',
  'dp2',
  'mesa',
  'inspetoria',
  'financeiro',
]

export function useAuth() {
  // Nunca inicializa o usuario a partir do localStorage para evitar bypass de autenticacao.
  // O perfil so e definido apos validacao da sessao no Supabase.
  const [user, setUser] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  const carregarPermissoesDoPerfil = useCallback(async (perfil: NivelAcesso) => {
    try {
      const { data, error } = await supabase
        .from('permissoes_perfil')
        .select(COLUNAS_PERMISSOES_PERFIL)
        .eq('perfil', perfil)
      if (error) {
        console.error('Erro ao carregar permissões do perfil:', error)
        setPermissoesCache([])
      } else {
        setPermissoesCache((data as { perfil: NivelAcesso; recurso: string; acao: string; permitido: boolean }[]) || [])
      }
    } catch (err) {
      console.error('Erro ao carregar permissões do perfil:', err)
      setPermissoesCache([])
    }
  }, [])

  const carregarPerfil = useCallback(async (
    authUser: { id: string; email?: string | null },
    nivelPadrao: NivelAcesso = 'visualizador'
  ) => {
    // Marca o início do carregamento: no login (quando loading já era false),
    // sem isso o App renderiza o layout assim que setUser roda — ANTES das
    // permissões do perfil chegarem — e a sidebar fica vazia até o F5,
    // pois o cache de permissões não é reativo.
    setLoading(true)
    const { data: perfil, error } = await supabase
      .from('perfis')
      .select(COLUNAS_PERFIL)
      .eq('id', authUser.id)
      .single()

    if (perfil) {
      setUser(perfil as Perfil)
      // Carrega permissões dinâmicas do perfil
      await carregarPermissoesDoPerfil((perfil as Perfil).nivel_acesso)
    } else if (!error || error.code === 'PGRST116') {
      // CORREÇÃO DE SEGURANÇA: nunca criar admin automaticamente.
      // O nível padrão é 'visualizador'. Apenas fluxos explícitos (ex: primeiro acesso)
      // devem passar outro nível.
      const novoPerfil: Omit<Perfil, 'created_at'> = {
        id: authUser.id,
        email: authUser.email || null,
        nome: authUser.email?.split('@')[0] || 'Usuário',
        nivel_acesso: nivelPadrao,
        empresa_id: null,
        consentimento_lgpd: false,
        consentimento_lgpd_data: null,
        consentimento_lgpd_versao: null,
        consentimento_lgpd_finalidades: null,
      }
      const { data: criado, error: erroInsert } = await supabase
        .from('perfis')
        .insert(novoPerfil as Partial<Perfil>)
        .select(COLUNAS_PERFIL)
        .single()

      if (erroInsert) {
        console.error('Erro ao criar perfil:', erroInsert)
        setUser(novoPerfil as Perfil)
      } else {
        setUser((criado || novoPerfil) as Perfil)
      }
      await carregarPermissoesDoPerfil(nivelPadrao)
    }
    setLoading(false)
  }, [carregarPermissoesDoPerfil])

  useEffect(() => {
    // onAuthStateChange dispara INITIAL_SESSION imediatamente ao registrar,
    // com a sessão atual — o getSession separado carregava o perfil duas vezes
    // no boot (perfil + permissões em duplicidade).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { id: string; email?: string | null } } | null) => {
      if (session?.user) {
        carregarPerfil(session.user)
      } else {
        // Sem sessao valida: descarta qualquer perfil em cache e forca tela de login.
        setUser(null)
        setPermissoesCache([])
        localStorage.removeItem(PERFIL_STORAGE_KEY)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [carregarPerfil])

  const login = useCallback(async (email: string, senha: string) => {
    const { user: authUser } = await loginComEmail(email, senha)
    if (authUser) await carregarPerfil(authUser)
    return authUser
  }, [carregarPerfil])

  const signUp = useCallback(async (email: string, senha: string, nivelPadrao: NivelAcesso = 'visualizador') => {
    const { user: authUser } = await cadastrarComEmail(email, senha)
    if (authUser) await carregarPerfil(authUser, nivelPadrao)
    return authUser
  }, [carregarPerfil])

  const logout = useCallback(async () => {
    await logoutAuth()
    setUser(null)
    setPermissoesCache([])
    localStorage.removeItem(PERFIL_STORAGE_KEY)
  }, [])

  /**
   * Verifica se o usuário possui um dos perfis permitidos.
   * Aceita um único perfil ou um array de perfis.
   * Perfis vazios ou undefined significam "qualquer usuário autenticado".
   */
  const temAcesso = useCallback((perfisPermitidos?: NivelAcesso | NivelAcesso[]): boolean => {
    if (!user) return false
    if (!perfisPermitidos) return true
    const perfis = Array.isArray(perfisPermitidos) ? perfisPermitidos : [perfisPermitidos]
    if (perfis.length === 0) return true
    return perfis.includes(user.nivel_acesso)
  }, [user])

  const ehAdmin = useCallback(() => {
    return user ? PERFIS_ADMIN.includes(user.nivel_acesso) : false
  }, [user])

  const ehEditor = useCallback(() => {
    return user ? PERFIS_EDITOR.includes(user.nivel_acesso) : false
  }, [user])

  return { user, loading, login, signUp, logout, temAcesso, carregarPerfil, ehAdmin, ehEditor }
}
