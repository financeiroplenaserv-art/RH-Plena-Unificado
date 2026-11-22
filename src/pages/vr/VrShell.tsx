import { CreditCard, FileText } from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'

const TABS: ModuleTab[] = [
  { path: '/vr/projetos', label: 'Projetos VR', icon: FileText },
  { path: '/vr/lifecard', label: 'Lifecard', icon: CreditCard },
]

interface VrShellProps {
  children: React.ReactNode
}

export function VrShell({ children }: VrShellProps) {
  return <ModuleShell tabs={TABS}>{children}</ModuleShell>
}
