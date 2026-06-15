import { cn } from '@/lib/utils'

interface CeuPageProps {
  children: React.ReactNode
  className?: string
}

export function CeuPage({ children, className }: CeuPageProps) {
  return (
    <div
      className={cn(
        '-m-6 min-h-[calc(100%+3rem)] space-y-6 p-6',
        className
      )}
      style={{ backgroundColor: '#F1F5F9' }}
    >
      {children}
    </div>
  )
}
