import { Navigate } from 'react-router-dom'
import { verificarPermissao } from '@/lib/permissoes'
import type { Perfil, NivelAcesso } from '@/types/database'

interface PermissaoRoute {
  recurso: string
  acao: string
}

interface ProtectedRouteProps {
  user: Perfil
  nivelMinimo?: NivelAcesso | NivelAcesso[]
  permissao?: PermissaoRoute
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ProtectedRoute({ user, nivelMinimo, permissao, children, fallback }: ProtectedRouteProps) {
  // Se houver permissão dinâmica configurada, ela tem prioridade
  if (permissao) {
    const permitido = verificarPermissao(user.nivel_acesso, permissao.recurso, permissao.acao)
    if (!permitido) {
      if (fallback) return <>{fallback}</>
      return <Navigate to="/" replace />
    }
    return <>{children}</>
  }

  if (!nivelMinimo) return <>{children}</>

  const niveis = Array.isArray(nivelMinimo) ? nivelMinimo : [nivelMinimo]

  // Nível vazio significa "qualquer usuário autenticado"
  if (niveis.length === 0) return <>{children}</>

  const permitido = niveis.includes(user.nivel_acesso)

  if (!permitido) {
    if (fallback) return <>{fallback}</>
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
