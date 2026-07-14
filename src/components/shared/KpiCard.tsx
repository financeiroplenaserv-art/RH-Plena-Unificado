import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  variant?: 'primary' | 'positive' | 'attention' | 'complement' | 'default'
  className?: string
}

const variantStyles = {
  primary: { icon: 'var(--primary-600)', border: 'var(--primary-600)' },
  positive: { icon: 'var(--success)', border: 'var(--success)' },
  attention: { icon: 'var(--warning)', border: 'var(--warning)' },
  complement: { icon: 'var(--kpi-complement)', border: 'var(--kpi-complement)' },
  default: { icon: 'var(--text-secondary)', border: 'var(--border-color)' },
}

export function KpiCard({ title, value, description, icon: Icon, variant = 'default', className }: KpiCardProps) {
  const styles = variantStyles[variant]

  return (
    <Card
      className={cn('border-0 shadow-sm', className)}
      style={{
        backgroundColor: 'var(--surface)',
        boxShadow: '0 1px 3px rgba(31, 41, 55, 0.06)',
        borderLeft: `3px solid ${styles.border}`,
      }}
    >
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)] mt-1 truncate">{value}</p>
          {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
        </div>
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-page-soft)' }}
        >
          <Icon className="w-5 h-5" style={{ color: styles.icon }} />
        </div>
      </CardContent>
    </Card>
  )
}
