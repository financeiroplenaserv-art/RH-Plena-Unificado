import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Building2,
  Building,
  CalendarDays,
  FileWarning,
  Wallet,
  Umbrella,
  Package,
  BarChart3,
  Briefcase,
  Cloud,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Perfil, NivelAcesso } from '@/types/database'

interface SidebarProps {
  user: Perfil
  isOpen: boolean
  onToggle: () => void
  onLogout: () => void
}

interface MenuItem {
  path: string
  label: string
  icon: React.ReactNode
  niveis: NivelAcesso[]
}

const menuItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/colaboradores', label: 'Colaboradores', icon: <Users className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/departamentos', label: 'Departamentos', icon: <Building2 className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/empresas', label: 'Empresas', icon: <Building className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/importar/econtador', label: 'e-Contador', icon: <Cloud className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/escalas', label: 'Escalas', icon: <CalendarDays className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/rh/ocorrencias', label: 'Ocorrências', icon: <FileWarning className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/vr/projetos', label: 'Benefícios', icon: <Wallet className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/ferias', label: 'Férias', icon: <Umbrella className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/ceu', label: 'Uniformes', icon: <Package className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/adicionais', label: 'Adicionais', icon: <Briefcase className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
  { path: '/relatorios', label: 'Relatórios', icon: <BarChart3 className="w-5 h-5" />, niveis: ['admin', 'rh', 'gestor', 'visualizador'] },
]

export function Sidebar({ user, isOpen, onToggle, onLogout }: SidebarProps) {
  const podeVer = (niveis: NivelAcesso[]) => niveis.includes(user.nivel_acesso)

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50',
        isOpen ? 'w-60' : 'w-16'
      )}
      style={{ backgroundColor: '#1F2937' }}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        {isOpen && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-white font-bold" style={{ fontSize: '16px' }}>
              RH
            </span>
            <span className="font-light" style={{ color: '#94A3B8', fontSize: '8px' }}>
              Plena
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isOpen ? 'hover:bg-white/10 text-[#94A3B8] hover:text-white' : 'mx-auto text-[#94A3B8] hover:text-white hover:bg-white/10'
          )}
          title={isOpen ? 'Recolher menu' : 'Expandir menu'}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) =>
          podeVer(item.niveis) ? (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'text-white font-bold bg-white/10'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-[#94A3B8]')}>
                    {item.icon}
                  </span>
                  {isOpen && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          ) : null
        )}
      </nav>

      <div className="p-2 border-t border-white/10">
        <button
          onClick={onLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-[#94A3B8] hover:text-white hover:bg-white/5 w-full transition-colors',
            !isOpen && 'justify-center'
          )}
        >
          <LogOut className="w-5 h-5" />
          {isOpen && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
