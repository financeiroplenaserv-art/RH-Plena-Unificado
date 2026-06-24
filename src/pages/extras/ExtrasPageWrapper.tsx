import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { path: '/extras/lancamentos', label: 'Lançamentos' },
  { path: '/extras/novo', label: 'Novo' },
  { path: '/extras/balanco', label: 'Balanço Diário' },
  { path: '/extras/relatorio', label: 'Relatório Semanal' },
]

interface ExtrasPageWrapperProps {
  children: React.ReactNode
  className?: string
}

export function ExtrasPageWrapper({ children, className }: ExtrasPageWrapperProps) {
  const location = useLocation()

  return (
    <div
      className={cn('min-h-full p-4 md:p-6', className)}
      style={{ backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap gap-2 border-b pb-2" style={{ borderColor: '#E2E8F0' }}>
          {TABS.map(tab => {
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
                style={{ backgroundColor: ativa ? '#1F2937' : undefined }}
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

interface ExtrasCardProps {
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
}

export function ExtrasCard({ children, title, description, className }: ExtrasCardProps) {
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

interface ExtrasButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'primary' | 'outline' | 'danger'
  size?: 'sm' | 'default' | 'lg'
}

export function ExtrasButton({ children, variant = 'primary', size = 'default', className, ...props }: ExtrasButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
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
    </button>
  )
}
