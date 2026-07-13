import { ModuleShell } from '@/components/layout/ModuleShell'

interface VrShellProps {
  children: React.ReactNode
}

export function VrShell({ children }: VrShellProps) {
  return <ModuleShell>{children}</ModuleShell>
}
