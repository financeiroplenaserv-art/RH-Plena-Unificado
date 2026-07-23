import { CalendarDays, Upload, Bell } from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'

const TABS: ModuleTab[] = [
  { path: '/ferias', label: 'Visão geral', icon: CalendarDays },
  { path: '/ferias/importar', label: 'Importar', icon: Upload },
  { path: '/ferias/notificacoes', label: 'Notificações', icon: Bell },
]

interface FeriasShellProps {
  children: React.ReactNode
}

export function FeriasShell({ children }: FeriasShellProps) {
  return <ModuleShell tabs={TABS}>{children}</ModuleShell>
}
