import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CeuInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function CeuInput({ className, ...props }: CeuInputProps) {
  return (
    <Input
      className={cn(
        'border-[#3B82F6]/30 focus:border-[#3B82F6] focus:ring-[#3B82F6]/20',
        className
      )}
      {...props}
    />
  )
}
