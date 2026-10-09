import { BarChart3, BookOpen, ClipboardCheck, ClipboardList, FileSignature, Inbox, PackageCheck, Timer, Truck } from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'
import { useAuth } from '@/hooks/useAuth'
import { podeAprovarMateriais, podeValidarMateriais, podeVerSemPedidoMateriais, verificarPermissao } from '@/lib/permissoes'

// Abas do módulo Materiais (docs/PLANO_MATERIAIS_FASE1.md §5.1). As filas
// (validação, painel, sem pedido) aparecem só para quem age nelas.
const TAB_FORNECEDORES: ModuleTab = { path: '/materiais/fornecedores', label: 'Fornecedores', icon: Truck }

const TAB_PEDIDOS: ModuleTab = { path: '/materiais/pedidos', label: 'Pedidos', icon: Inbox }
const TAB_VALIDACAO: ModuleTab = { path: '/materiais/validacao', label: 'Validação', icon: ClipboardCheck }
const TAB_PAINEL: ModuleTab = { path: '/materiais/painel', label: 'Painel', icon: BarChart3 }
const TAB_SEM_PEDIDO: ModuleTab = { path: '/materiais/sem-pedido', label: 'Sem pedido', icon: Timer }

const TABS_CADASTRO: ModuleTab[] = [
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
  if (!user || !moduloInteiro) return <ModuleShell tabs={[TAB_FORNECEDORES]}>{children}</ModuleShell>
  const n = user.nivel_acesso
  const tabs = [
    TAB_PEDIDOS,
    ...(podeValidarMateriais(n) ? [TAB_VALIDACAO] : []),
    ...(podeAprovarMateriais(n) ? [TAB_PAINEL] : []),
    ...(podeVerSemPedidoMateriais(n) ? [TAB_SEM_PEDIDO] : []),
    ...TABS_CADASTRO,
  ]
  return <ModuleShell tabs={tabs}>{children}</ModuleShell>
}
