import { cn } from '@/lib/utils'

interface CeuBadgeProps {
  children: React.ReactNode
  type?: 'epi' | 'uniforme' | 'cracha' | 'equipamento' | 'outros' | 'default' | 'inativo'
  className?: string
}

const styles = {
  epi: 'bg-orange-100 text-orange-700 border-orange-200',
  uniforme: 'bg-green-100 text-green-700 border-green-200',
  cracha: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  equipamento: 'bg-blue-100 text-blue-700 border-blue-200',
  outros: 'bg-slate-100 text-slate-700 border-slate-200',
  default: 'bg-blue-100 text-blue-700 border-blue-200',
  inativo: 'bg-red-100 text-red-700 border-red-200',
}

export function CeuBadge({ children, type = 'default', className }: CeuBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        styles[type],
        className
      )}
    >
      {children}
    </span>
  )
}
