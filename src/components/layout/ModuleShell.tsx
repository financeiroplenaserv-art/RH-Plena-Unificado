import { NavLink, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ModuleTab {
  path: string
  label: string
}

export interface ModuleShellProps {
  children: React.ReactNode
  tabs: ModuleTab[]
  activeColor?: string
  className?: string
}

export function ModuleShell({ children, tabs, activeColor = '#1F2937', className }: ModuleShellProps) {
  const location = useLocation()

  return (
    <div
      className={cn('min-h-full p-4 md:p-6', className)}
      style={{ backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-2 border-b pb-2" style={{ borderColor: '#E2E8F0' }}>
          {tabs.map((tab) => {
            const ativa = location.pathname === tab.path
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={cn(
                  'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
                  ativa
                    ? 'text-white'
                    : 'text-[#64748B] hover:text-[#1F2937] hover:bg-slate-100'
                )}
                style={{ backgroundColor: ativa ? activeColor : undefined }}
              >
                {tab.label}
              </NavLink>
            )
          })}
        </div>
        {children}
      </div>
    </div>
  )
}

export interface ModuleCardProps {
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
}

export function ModuleCard({ children, title, description, className }: ModuleCardProps) {
  return (
    <div
      className={cn('rounded-xl shadow-sm border-0 overflow-hidden', className)}
      style={{ backgroundColor: '#FFFFFF' }}
    >
      {(title || description) && (
        <div className="px-6 py-4 border-b" style={{ borderColor: '#F1F5F9' }}>
          {title && <h3 className="text-base font-semibold" style={{ color: '#1F2937' }}>{title}</h3>}
          {description && <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{description}</p>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}

export interface ModuleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger'
  size?: 'sm' | 'default' | 'lg'
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
        variant === 'outline' && 'bg-white hover:bg-slate-50',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'default' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-11 px-6 text-base',
        className
      )}
      style={{
        backgroundColor: variant === 'primary' ? '#1F2937' : variant === 'outline' ? '#FFFFFF' : undefined,
        borderColor: variant === 'outline' ? '#1F2937' : undefined,
        color: variant === 'outline' ? '#1F2937' : undefined,
        borderWidth: variant === 'outline' ? '1px' : undefined,
      }}
      {...props}
    >
      {children}
    </Button>
  )
}
