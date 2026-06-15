import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type VrCardColor = 'blue' | 'red' | 'green' | 'purple' | 'yellow' | 'white'

interface VrCardProps {
  children: React.ReactNode
  title?: React.ReactNode
  icon?: React.ReactNode
  color?: VrCardColor
  className?: string
  headerClassName?: string
}

const colorStyles: Record<VrCardColor, { header: string; border: string }> = {
  blue: { header: 'bg-blue-600 text-white', border: 'border-blue-200' },
  red: { header: 'bg-red-600 text-white', border: 'border-red-200' },
  green: { header: 'bg-green-600 text-white', border: 'border-green-200' },
  purple: { header: 'bg-purple-600 text-white', border: 'border-purple-200' },
  yellow: { header: 'bg-amber-500 text-white', border: 'border-amber-200' },
  white: { header: 'bg-white text-slate-800', border: 'border-slate-200' },
}

export function VrCard({
  children,
  title,
  icon,
  color = 'white',
  className,
  headerClassName,
}: VrCardProps) {
  const style = colorStyles[color]

  return (
    <Card
      className={cn(
        'overflow-hidden border-2 shadow-md',
        style.border,
        className
      )}
    >
      {title && (
        <CardHeader className={cn('pb-3', style.header, headerClassName)}>
          <CardTitle className="text-base flex items-center gap-2">
            {icon && <span>{icon}</span>}
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="bg-white">{children}</CardContent>
    </Card>
  )
}
