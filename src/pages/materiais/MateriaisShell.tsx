import { BookOpen, ClipboardList, FileSignature, PackageCheck, Truck } from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'
import { useAuth } from '@/hooks/useAuth'
import { verificarPermissao } from '@/lib/permissoes'

// Abas do módulo Materiais (docs/PLANO_MATERIAIS_FASE1.md §5.1). Pedidos,
// validação, painel e "sem pedido" entram nos próximos passos do plano.
const TAB_FORNECEDORES: ModuleTab = { path: '/materiais/fornecedores', label: 'Fornecedores', icon: Truck }

const TABS: ModuleTab[] = [
  { path: '/materiais/contratos', label: 'Contratos', icon: FileSignature },
  { path: '/materiais/kit', label: 'Kit Mensal', icon: PackageCheck },
  { path: '/materiais/catalogo', label: 'Catálogo', icon: BookOpen },
  TAB_FORNECEDORES,
  { path: '/materiais/alteracoes-kit', label: 'Alterações de kit', icon: ClipboardList },
]

export function MateriaisShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // dp2 e financeiro só têm rota.materiais_fornecedores: veem apenas a aba Fornecedores
  const moduloInteiro = user ? verificarPermissao(user.nivel_acesso, 'rota', 'materiais') : false
  return <ModuleShell tabs={moduloInteiro ? TABS : [TAB_FORNECEDORES]}>{children}</ModuleShell>
}
