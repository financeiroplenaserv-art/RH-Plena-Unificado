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
  const hierarquia: Record<NivelAcesso, number> = {
    visualizador: 1,
    gestor: 2,
    rh: 3,
    admin: 4,
  }

  const nivelUsuario = hierarquia[user.nivel_acesso]
  const permitido = niveis.some((n) => hierarquia[n] <= nivelUsuario)

  if (!permitido) {
    if (fallback) return <>{fallback}</>
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
