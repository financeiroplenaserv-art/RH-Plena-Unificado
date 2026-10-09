import { BookOpen, ClipboardList, FileSignature, PackageCheck, Truck } from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'

// Abas do módulo Materiais (docs/PLANO_MATERIAIS_FASE1.md §5.1). Pedidos,
// validação, painel e "sem pedido" entram nos próximos passos do plano.
const TABS: ModuleTab[] = [
  { path: '/materiais/contratos', label: 'Contratos', icon: FileSignature },
  { path: '/materiais/kit', label: 'Kit Mensal', icon: PackageCheck },
  { path: '/materiais/catalogo', label: 'Catálogo', icon: BookOpen },
  { path: '/materiais/fornecedores', label: 'Fornecedores', icon: Truck },
  { path: '/materiais/alteracoes-kit', label: 'Alterações de kit', icon: ClipboardList },
]

export function MateriaisShell({ children }: { children: React.ReactNode }) {
  return <ModuleShell tabs={TABS}>{children}</ModuleShell>
}
