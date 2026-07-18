import { Button as ShadcnButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CorhButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'

interface CorhButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CorhButtonVariant
  size?: 'sm' | 'default' | 'lg' | 'icon'
  loading?: boolean
}

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  loading = false,
  className,
  disabled,
  ...props
}: CorhButtonProps) {
  const variantMap: Record<CorhButtonVariant, string> = {
    primary: 'bg-brand-gradient-soft text-white hover:opacity-95 hover:shadow',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-white text-muted-foreground hover:border-primary/40 hover:text-primary',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }

  const sizeMap = {
    sm: 'h-9 px-3 text-xs',
    default: 'h-10 px-4 text-[13px]',
    lg: 'h-11 px-5 text-[13px]',
    icon: 'h-10 w-10',
  }

  return (
    <ShadcnButton
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors',
        variantMap[variant],
        sizeMap[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {children}
    </ShadcnButton>
  )
}
