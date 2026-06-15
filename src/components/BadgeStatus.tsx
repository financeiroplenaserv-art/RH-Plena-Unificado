import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusVariant = 'Ativo' | 'Inativo' | 'Afastado' | 'Pendente' | 'Ativa' | 'Resolvida' | 'Cancelada' | string

interface BadgeStatusProps {
  status: StatusVariant
  className?: string
}

const STATUS_STYLES: Record<string, string> = {
  Ativo: 'bg-green-100 text-green-700 hover:bg-green-100',
  Inativo: 'bg-slate-100 text-slate-600 hover:bg-slate-100',
  Afastado: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  Pendente: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  Ativa: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  Resolvida: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  Cancelada: 'bg-slate-100 text-slate-500 hover:bg-slate-100',
}

export function BadgeStatus({ status, className }: BadgeStatusProps) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 hover:bg-slate-100'

  return <Badge className={cn(style, className)}>{status || '—'}</Badge>
}
