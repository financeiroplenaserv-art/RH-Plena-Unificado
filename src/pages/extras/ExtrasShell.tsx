import {
  List,
  PlusCircle,
  Scale,
  BarChart3,
  Receipt,
  Tags,
  Smartphone,
} from 'lucide-react'
import { ModuleShell, ModuleTab } from '@/components/layout/ModuleShell'

const TABS: ModuleTab[] = [
  { path: '/extras/lancamentos', label: 'Lançamentos', icon: List },
  { path: '/extras/novo', label: 'Novo', icon: PlusCircle },
  { path: '/extras/balanco', label: 'Balanço Diário', icon: Scale },
  { path: '/extras/relatorio', label: 'Relatório Semanal', icon: BarChart3 },
  { path: '/extras/recibos', label: 'Recibos', icon: Receipt },
  { path: '/extras/categorias', label: 'Categorias', icon: Tags },
  { path: '/extras/mobile', label: 'Mobile', icon: Smartphone },
]

interface ExtrasShellProps {
  children: React.ReactNode
}

export function ExtrasShell({ children }: ExtrasShellProps) {
  return <ModuleShell tabs={TABS}>{children}</ModuleShell>
}
