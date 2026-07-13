import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      <div
        className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-page-soft)' }}
      >
        <Icon className="w-6 h-6" style={{ color: 'var(--text-secondary)' }} />
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      {description && <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">{description}</p>}
    </div>
  )
}
