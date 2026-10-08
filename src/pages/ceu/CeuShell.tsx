import {
  ArrowLeftRight,
  Package,
  Zap,
  FileBarChart,
  Truck,
  Upload,
  Ruler,
  IdCard,
  Users,
} from 'lucide-react'
import { ModuleShell } from '@/components/layout/ModuleShell'
import type { ModuleTab } from '@/components/layout/ModuleShell'
import { useAuth } from '@/hooks/useAuth'
import { podeEmitirCrachaCEU } from '@/lib/permissoes'

const TABS: ModuleTab[] = [
  { path: '/ceu/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { path: '/ceu/itens', label: 'Itens', icon: Package },
  { path: '/ceu/lancamento-rapido', label: 'Lançamento Rápido', icon: Zap },
  { path: '/ceu/tamanhos', label: 'Tamanhos', icon: Ruler },
  { path: '/ceu/relatorios', label: 'Relatórios', icon: FileBarChart },
  { path: '/ceu/fornecedores', label: 'Fornecedores', icon: Truck },
  { path: '/ceu/importar', label: 'Importar', icon: Upload },
]

const TAB_CRACHAS: ModuleTab = { path: '/ceu/crachas', label: 'Crachás', icon: IdCard }
const TAB_QUADRO: ModuleTab = { path: '/ceu/quadro', label: 'Quadro', icon: Users }

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

  const tabs = apenasCrachas ? [TAB_CRACHAS] : podeCrachas ? [...TABS, TAB_CRACHAS, TAB_QUADRO] : TABS

  return <ModuleShell tabs={tabs}>{children}</ModuleShell>
}
