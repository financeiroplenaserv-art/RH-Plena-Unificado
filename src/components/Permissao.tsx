import { useAuth } from '@/hooks/useAuth'
import type { NivelAcesso } from '@/types/database'

interface PermissaoProps {
  /** Um ou mais perfis permitidos para renderizar children. */
  perfis: NivelAcesso[]
  children: React.ReactNode
  /** Conteúdo exibido quando o perfil não tem permissão. Padrão: null. */
  fallback?: React.ReactNode
}

/**
 * Componente de renderização condicional por perfil.
 * Renderiza children apenas se o usuário logado possuir um dos perfis informados.
 */
export function Permissao({ perfis, children, fallback = null }: PermissaoProps) {
  const { user } = useAuth()

  if (!user) return fallback
  if (perfis.includes(user.nivel_acesso)) return children
  return fallback
}
