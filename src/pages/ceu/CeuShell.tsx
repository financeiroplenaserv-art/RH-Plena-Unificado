import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Zap,
  FileBarChart,
  Truck,
  Upload,
} from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'

const TABS: ModuleTab[] = [
  { path: '/ceu/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ceu/itens', label: 'Itens', icon: Package },
  { path: '/ceu/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { path: '/ceu/lancamento-rapido', label: 'Lançamento Rápido', icon: Zap },
  { path: '/ceu/relatorios', label: 'Relatórios', icon: FileBarChart },
  { path: '/ceu/fornecedores', label: 'Fornecedores', icon: Truck },
  { path: '/ceu/importar', label: 'Importar', icon: Upload },
]

interface CeuShellProps {
  children: React.ReactNode
}

export function CeuShell({ children }: CeuShellProps) {
  return <ModuleShell tabs={TABS}>{children}</ModuleShell>
}
