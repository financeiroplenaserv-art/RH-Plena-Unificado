import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type CeuCardGradient = 'blue' | 'orange' | 'green' | 'dark-blue' | 'none'

interface CeuCardProps {
  children: React.ReactNode
  title?: React.ReactNode
  icon?: React.ReactNode
  gradient?: CeuCardGradient
  className?: string
  headerClassName?: string
  contentClassName?: string
}

const gradients: Record<CeuCardGradient, string> = {
  blue: 'bg-gradient-to-r from-[#3B82F6] to-[#1E40AF]',
  'dark-blue': 'bg-gradient-to-r from-[#1E3A5F] to-[#1E40AF]',
  orange: 'bg-gradient-to-r from-[#F97316] to-[#EA580C]',
  green: 'bg-gradient-to-r from-[#16A34A] to-[#15803D]',
  none: '',
}

export function CeuCard({
  children,
  title,
  icon,
  gradient = 'none',
  className,
  headerClassName,
  contentClassName,
}: CeuCardProps) {
  const hasGradient = gradient !== 'none'

  return (
    <Card
      className={cn(
        'overflow-hidden border-0 shadow-md',
        className
      )}
      style={{ boxShadow: '0 4px 6px -1px rgba(30, 58, 95, 0.08), 0 2px 4px -2px rgba(30, 58, 95, 0.06)' }}
    >
      {title && (
        <CardHeader
          className={cn(
            'pb-3',
            hasGradient && gradients[gradient],
            hasGradient && 'text-white',
            headerClassName
          )}
        >
          <CardTitle
            className={cn(
              'text-base flex items-center gap-2',
              hasGradient ? 'text-white' : 'text-slate-900'
            )}
          >
            {icon && <span>{icon}</span>}
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn('bg-white', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
