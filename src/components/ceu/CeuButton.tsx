import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'icon'
  className?: string
}

export function CeuButton({
  children,
  variant = 'primary',
  size = 'default',
  className,
  ...props
}: CeuButtonProps) {
  return (
    <Button
      className={cn(
        variant === 'primary' &&
          'bg-gradient-to-r from-[#3B82F6] to-[#1E40AF] text-white hover:from-[#2563EB] hover:to-[#1E3A8A] border-0 shadow-sm',
        variant === 'outline' &&
          'border-[#3B82F6] text-[#1E40AF] hover:bg-[#3B82F6]/10 hover:text-[#1E40AF] bg-white',
        variant === 'ghost' && 'text-slate-500 hover:text-[#1E40AF] hover:bg-[#3B82F6]/10',
        size === 'icon' && 'h-9 w-9',
        className
      )}
      size={size === 'icon' ? 'icon' : size}
      {...props}
    >
      {children}
    </Button>
  )
}
