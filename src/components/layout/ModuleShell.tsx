import { NavLink, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface ModuleTab {
  path: string
  label: string
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

export interface ModuleShellProps {
  children: React.ReactNode
  tabs?: ModuleTab[]
  className?: string
}

export function ModuleShell({ children, tabs, className }: ModuleShellProps) {
  const location = useLocation()

  return (
    <div className={cn('min-h-full space-y-4', className)}>
      {tabs && tabs.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-border pb-2">
          {tabs.map((tab) => {
            const ativa = location.pathname === tab.path
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors',
                  ativa
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                {Icon && <Icon className="size-4" strokeWidth={1.8} />}
                {tab.label}
              </NavLink>
            )
          })}
        </div>
      )}
      {children}
    </div>
  )
}

export interface ModuleCardProps {
  children: React.ReactNode
  title?: React.ReactNode
  description?: string
  icon?: React.ReactNode
  className?: string
  contentClassName?: string
  headerClassName?: string
}

export function ModuleCard({ children, title, description, icon, className, contentClassName, headerClassName }: ModuleCardProps) {
  return (
    <Card className={cn('border-border shadow-sm', className)}>
      {(title || description) && (
        <CardHeader className={cn('border-b border-border px-5 py-3.5', headerClassName)}>
          {title && (
            <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
              {icon && <span className="text-muted-foreground">{icon}</span>}
              {title}
            </CardTitle>
          )}
          {description && <CardDescription className="mt-0.5 text-[12px] text-muted-foreground">{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn('p-5', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

export interface ModuleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'default' | 'lg' | 'icon'
}

export function ModuleButton({
  children,
  variant = 'primary',
  size = 'default',
  className,
  ...props
}: ModuleButtonProps) {
  const variantClasses = {
    primary: 'bg-brand-gradient-soft text-white shadow-sm hover:opacity-95 hover:shadow',
    outline: 'border border-input bg-white text-muted-foreground shadow-sm hover:border-primary/40 hover:text-primary',
    danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  }

  const sizeClasses = {
    sm: 'h-9 px-3 text-xs',
    default: 'h-10 px-4 text-[13px]',
    lg: 'h-11 px-5 text-[13px]',
    icon: 'h-10 w-10',
  }

  return (
    <Button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

export { Card, CardContent, CardHeader, CardTitle, CardDescription }
