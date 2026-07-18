import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface ModuleTab {
  path: string
  label: string
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

interface ModuleTabsProps {
  tabs: ModuleTab[]
  className?: string
}

export function ModuleTabs({ tabs, className }: ModuleTabsProps) {
  const location = useLocation()

  return (
    <div className={cn('flex flex-wrap gap-1 border-b border-border pb-2', className)}>
      {tabs.map((tab) => {
        const active = location.pathname === tab.path
        const Icon = tab.icon
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors',
              active
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
  )
}
