import { ClipboardList, FileUp, FileStack, Bell } from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'

const TABS: ModuleTab[] = [
  { path: '/rh/ocorrencias', label: 'Ocorrências', icon: ClipboardList },
  // A importação de ponto foi unificada na tela do módulo Adicionais
  { path: '/adicionais/importar-ponto', label: 'Importar Ponto', icon: FileUp },
  { path: '/rh/modelos', label: 'Modelos', icon: FileStack },
  { path: '/rh/alertas', label: 'Alertas', icon: Bell },
]

interface RhShellProps {
  children: React.ReactNode
}

export function RhShell({ children }: RhShellProps) {
  return <ModuleShell tabs={TABS}>{children}</ModuleShell>
}
