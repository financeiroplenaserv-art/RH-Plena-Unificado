import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'danger' | 'info' | 'default'
  children: React.ReactNode
  className?: string
}

const statusStyles = {
  success: { bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success)' },
  warning: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning)' },
  danger: { bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger)' },
  info: { bg: 'var(--info-bg)', color: 'var(--info)', border: 'var(--info)' },
  default: { bg: 'var(--bg-page-soft)', color: 'var(--text-secondary)', border: 'var(--border-color)' },
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const style = statusStyles[status]

  return (
    <Badge
      variant="outline"
      className={cn('font-medium text-xs px-2 py-0.5', className)}
      style={{
        backgroundColor: style.bg,
        color: style.color,
        borderColor: style.border,
      }}
    >
      {children}
    </Badge>
  )
}
