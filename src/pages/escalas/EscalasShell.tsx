import { CalendarDays, Upload, MapPin, Route } from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'

const TABS: ModuleTab[] = [
  { path: '/escalas', label: 'Escalas', icon: CalendarDays },
  { path: '/escalas/importar', label: 'Importar', icon: Upload },
  { path: '/escalas/locais', label: 'Locais', icon: MapPin },
  { path: '/escalas/mapeamento', label: 'Mapeamento', icon: Route },
]

interface EscalasShellProps {
  children: React.ReactNode
}

export function EscalasShell({ children }: EscalasShellProps) {
  return <ModuleShell tabs={TABS}>{children}</ModuleShell>
}
