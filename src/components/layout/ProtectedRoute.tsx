import { Navigate } from 'react-router-dom'
import type { Perfil, NivelAcesso } from '@/types/database'

interface ProtectedRouteProps {
  user: Perfil
  nivelMinimo?: NivelAcesso | NivelAcesso[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function ProtectedRoute({ user, nivelMinimo, children, fallback }: ProtectedRouteProps) {
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
