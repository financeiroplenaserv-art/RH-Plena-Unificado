import { Filter, X } from 'lucide-react'
import { ModuleCard, ModuleButton } from '@/components/layout/ModuleShell'
import { cn } from '@/lib/utils'

interface FilterCardProps {
  children: React.ReactNode
  title?: string
  onFilter: () => void
  onClear: () => void
  disabled?: boolean
  extraActions?: React.ReactNode
  className?: string
}

export function FilterCard({
  children,
  title = 'Filtros',
  onFilter,
  onClear,
  disabled,
  extraActions,
  className,
}: FilterCardProps) {
  return (
    <ModuleCard title={title} className={className}>
      <div className="space-y-4">
        <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3')}>
          {children}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--bg-page-soft)' }}>
          <ModuleButton size="sm" onClick={onFilter} disabled={disabled}>
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filtrar
          </ModuleButton>
          <ModuleButton variant="outline" size="sm" onClick={onClear} disabled={disabled}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            Limpar
          </ModuleButton>
          {extraActions && <div className="flex flex-wrap items-center gap-2 ml-auto">{extraActions}</div>}
        </div>
      </div>
    </ModuleCard>
  )
}
