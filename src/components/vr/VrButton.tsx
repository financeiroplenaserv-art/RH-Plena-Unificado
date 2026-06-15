import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface VrButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'danger'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function VrButton({
  children,
  variant = 'primary',
  size = 'default',
  className,
  ...props
}: VrButtonProps) {
  return (
    <Button
      className={cn(
        variant === 'primary' && 'bg-blue-600 hover:bg-blue-700 text-white shadow-md',
        variant === 'secondary' && 'bg-green-600 hover:bg-green-700 text-white shadow-md',
        variant === 'outline' && 'border-2 border-blue-600 text-blue-700 hover:bg-blue-50 bg-white',
        variant === 'danger' && 'bg-red-600 hover:bg-red-700 text-white shadow-md',
        size === 'lg' && 'h-11 px-6 text-base',
        size === 'sm' && 'h-8 px-3 text-xs',
        'font-semibold',
        className
      )}
      size={size === 'lg' ? 'default' : size}
      {...props}
    >
      {children}
    </Button>
  )
}
