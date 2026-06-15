import { cn } from '@/lib/utils'

interface VrPageProps {
  children: React.ReactNode
  className?: string
}

export function VrPage({ children, className }: VrPageProps) {
  return (
    <div
      className={cn(
        '-m-6 min-h-[calc(100%+3rem)] space-y-6 p-6',
        className
      )}
      style={{ backgroundColor: '#f3f4f6' }}
    >
      {children}
    </div>
  )
}
