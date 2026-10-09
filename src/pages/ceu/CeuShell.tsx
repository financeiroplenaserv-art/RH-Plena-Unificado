import {
  ArrowLeftRight,
  Package,
  Zap,
  FileBarChart,
  Upload,
  Ruler,
  IdCard,
  Inbox,
} from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'
import { useAuth } from '@/hooks/useAuth'
import { podeAtenderPedidoCEU, podeConferirPedidoCEU, podeEmitirCrachaCEU } from '@/lib/permissoes'

const TABS: ModuleTab[] = [
  { path: '/ceu/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { path: '/ceu/itens', label: 'Itens', icon: Package },
  { path: '/ceu/lancamento-rapido', label: 'Lançamento Rápido', icon: Zap },
  { path: '/ceu/tamanhos', label: 'Tamanhos', icon: Ruler },
  { path: '/ceu/relatorios', label: 'Relatórios', icon: FileBarChart },
  { path: '/ceu/importar', label: 'Importar', icon: Upload },
]

// Fila de pedidos do líder (módulo Materiais): inspetoria confere, Beth (dp2) atende
const TAB_PEDIDOS: ModuleTab = { path: '/ceu/pedidos', label: 'Pedidos', icon: Inbox }

const TAB_CRACHAS: ModuleTab = { path: '/ceu/crachas', label: 'Crachás', icon: IdCard }

interface CeuShellProps {
  children: React.ReactNode
  /**
   * Só a aba Crachás — para quem emite crachás mas não tem acesso ao resto do
   * CEU (perfil dp3). As demais abas redirecionariam para o início.
   */
  apenasCrachas?: boolean
}

export function CeuShell({ children, apenasCrachas = false }: CeuShellProps) {
  const { user } = useAuth()
  const podeCrachas = user ? podeEmitirCrachaCEU(user.nivel_acesso) : false

  const podePedidos = user ? podeConferirPedidoCEU(user.nivel_acesso) || podeAtenderPedidoCEU(user.nivel_acesso) : false
  const base = podePedidos ? [...TABS, TAB_PEDIDOS] : TABS
  const tabs = apenasCrachas ? [TAB_CRACHAS] : podeCrachas ? [...base, TAB_CRACHAS] : base

  return <ModuleShell tabs={tabs}>{children}</ModuleShell>
}
