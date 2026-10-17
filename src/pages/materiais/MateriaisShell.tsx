import { BarChart3, BookOpen, ClipboardCheck, ClipboardList, FileSignature, Inbox, PackageCheck, ShoppingCart, Timer, Truck } from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'
import { useAuth } from '@/hooks/useAuth'
import {
  podeAprovarMateriais,
  podeComprarMateriais,
  podeValidarMateriais,
  podeVerComprasMateriais,
  podeVerSemPedidoMateriais,
  verificarPermissao,
} from '@/lib/permissoes'

// Abas do módulo Materiais (docs/PLANO_MATERIAIS_FASE1.md §5.1). As filas
// (validação, painel, sem pedido) aparecem só para quem age nelas.
const TAB_FORNECEDORES: ModuleTab = { path: '/materiais/fornecedores', label: 'Fornecedores', icon: Truck }

const TAB_PEDIDOS: ModuleTab = { path: '/materiais/pedidos', label: 'Pedidos', icon: Inbox }
const TAB_VALIDACAO: ModuleTab = { path: '/materiais/validacao', label: 'Validação', icon: ClipboardCheck }
const TAB_PAINEL: ModuleTab = { path: '/materiais/painel', label: 'Painel', icon: BarChart3 }
const TAB_SEM_PEDIDO: ModuleTab = { path: '/materiais/sem-pedido', label: 'Sem pedido', icon: Timer }

const TAB_KIT: ModuleTab = { path: '/materiais/kit', label: 'Kit Mensal', icon: PackageCheck }
// Fase 2 (migration 147): compra do mês; o financeiro entra só nesta aba (consulta).
const TAB_COMPRAS: ModuleTab = { path: '/materiais/compras', label: 'Compras', icon: ShoppingCart }

const TABS_CADASTRO: ModuleTab[] = [
  { path: '/materiais/contratos', label: 'Contratos', icon: FileSignature },
  TAB_KIT,
  { path: '/materiais/catalogo', label: 'Catálogo', icon: BookOpen },
  TAB_FORNECEDORES,
  { path: '/materiais/alteracoes-kit', label: 'Alterações de kit', icon: ClipboardList },
]

export function MateriaisShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // Sem o módulo inteiro (dp2, financeiro): só as abas avulsas que a pessoa tem —
  // Compras (rota.materiais_compras — financeiro), Fornecedores
  // (rota.materiais_fornecedores) e, para a dp2, Kit Mensal
  // (rota.materiais_kit, migration 129: edita as peças de uniforme/EPI).
  const moduloInteiro = user ? verificarPermissao(user.nivel_acesso, 'rota', 'materiais') : false
  if (!user || !moduloInteiro) {
    const avulsas = user
      ? [
          ...(verificarPermissao(user.nivel_acesso, 'rota', 'materiais_compras') ? [TAB_COMPRAS] : []),
          ...(verificarPermissao(user.nivel_acesso, 'rota', 'materiais_kit') ? [TAB_KIT] : []),
          ...(verificarPermissao(user.nivel_acesso, 'rota', 'materiais_fornecedores') ? [TAB_FORNECEDORES] : []),
        ]
      : []
    return <ModuleShell tabs={avulsas.length ? avulsas : [TAB_FORNECEDORES]}>{children}</ModuleShell>
  }
  const n = user.nivel_acesso
  const tabs = [
    TAB_PEDIDOS,
    ...(podeValidarMateriais(n) ? [TAB_VALIDACAO] : []),
    ...(podeAprovarMateriais(n) ? [TAB_PAINEL] : []),
    ...(podeVerSemPedidoMateriais(n) ? [TAB_SEM_PEDIDO] : []),
    ...(podeComprarMateriais(n) || podeVerComprasMateriais(n) ? [TAB_COMPRAS] : []),
    ...TABS_CADASTRO,
  ]
  return <ModuleShell tabs={tabs}>{children}</ModuleShell>
}
