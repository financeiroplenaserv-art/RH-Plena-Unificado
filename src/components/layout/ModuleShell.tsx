import { NavLink, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface ModuleTab {
  path: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

export interface ModuleShellProps {
  children: React.ReactNode
  tabs?: ModuleTab[]
  className?: string
}

export function ModuleShell({ children, tabs, className }: ModuleShellProps) {
  const location = useLocation()

  return (
    <div
      className={cn('min-h-full p-4 md:p-5', className)}
      style={{ backgroundColor: 'var(--bg-page)' }}
    >
      <div className="max-w-7xl mx-auto space-y-4">
        {tabs && tabs.length > 0 && (
          <div className="flex flex-wrap gap-1 border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
            {tabs.map((tab) => {
              const ativa = location.pathname === tab.path
              const Icon = tab.icon
              return (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-sm font-medium transition-colors',
                    ativa
                      ? 'text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page-soft)]'
                  )}
                  style={{
                    backgroundColor: ativa ? 'var(--accent-teal)' : undefined,
                  }}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {tab.label}
                </NavLink>
              )
            })}
          </div>
        )}
        {children}
      </div>
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
    <Card
      className={cn('border-0 shadow-sm', className)}
      style={{
        backgroundColor: 'var(--surface)',
        boxShadow: '0 1px 3px rgba(15, 94, 221, 0.06)',
      }}
    >
      {(title || description) && (
        <CardHeader className={cn('px-5 py-3 border-b', headerClassName)} style={{ borderColor: 'var(--bg-page-soft)' }}>
          {title && (
            <CardTitle className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              {icon && <span>{icon}</span>}
              {title}
            </CardTitle>
          )}
          {description && <CardDescription className="text-sm mt-0.5">{description}</CardDescription>}
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
  return (
    <Button
      className={cn(
        variant === 'primary' && 'text-white hover:opacity-90',
        variant === 'outline' && 'bg-white hover:bg-[var(--bg-page)]',
        variant === 'danger' && 'bg-[var(--danger)] text-white hover:opacity-90',
        variant === 'ghost' && 'hover:bg-[var(--bg-page-soft)]',
        size === 'sm' && 'h-8 px-3 text-xs',
        size === 'default' && 'h-9 px-4 text-sm',
        size === 'lg' && 'h-10 px-5 text-sm',
        size === 'icon' && 'h-9 w-9',
        className
      )}
      style={{
        backgroundColor: variant === 'primary' ? 'var(--primary-600)' : variant === 'outline' ? 'var(--surface)' : undefined,
        borderColor: variant === 'outline' ? 'var(--primary-600)' : undefined,
        color: variant === 'outline' ? 'var(--primary-600)' : variant === 'ghost' ? 'var(--text-secondary)' : undefined,
        borderWidth: variant === 'outline' ? '1px' : undefined,
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

export { Card, CardContent, CardHeader, CardTitle, CardDescription }
