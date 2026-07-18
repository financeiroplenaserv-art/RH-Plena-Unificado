import { cn } from '@/lib/utils'
import { Button } from './Button'

interface FiltersProps {
  children: React.ReactNode
  onApply: () => void
  onClear: () => void
  loading?: boolean
  className?: string
}

export function Filters({ children, onApply, onClear, loading = false, className }: FiltersProps) {
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 shadow-sm', className)}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-border mt-3">
        <Button variant="ghost" size="sm" onClick={onClear} disabled={loading}>
          Limpar
        </Button>
        <Button variant="primary" size="sm" onClick={onApply} disabled={loading}>
          Aplicar
        </Button>
      </div>
    </div>
  )
}
