import { FileText, CalendarDays, Link2, Upload, ClipboardList } from 'lucide-react'
import { ModuleShell, ModuleTab } from '@/components/layout/ModuleShell'

const TABS: ModuleTab[] = [
  { path: '/adicionais/contratos', label: 'Contratos', icon: FileText },
  { path: '/adicionais/vinculos', label: 'Vínculos', icon: Link2 },
  { path: '/adicionais/calendario', label: 'Calendário', icon: CalendarDays },
  { path: '/adicionais/relatorio', label: 'Relatório', icon: ClipboardList },
  { path: '/adicionais/importar-ponto', label: 'Importar Ponto', icon: Upload },
]

interface AdicionaisShellProps {
  children: React.ReactNode
}

export function AdicionaisShell({ children }: AdicionaisShellProps) {
  return <ModuleShell tabs={TABS}>{children}</ModuleShell>
}
