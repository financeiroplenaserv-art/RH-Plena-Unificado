import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingScreenProps {
  className?: string
  mensagem?: string
}

export function LoadingScreen({ className, mensagem = 'Carregando...' }: LoadingScreenProps) {
  return (
    <div className={cn('flex h-64 w-full flex-col items-center justify-center gap-3 text-slate-500', className)}>
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">{mensagem}</p>
    </div>
  )
}
