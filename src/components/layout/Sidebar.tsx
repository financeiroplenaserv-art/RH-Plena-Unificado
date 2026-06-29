import { useState, useEffect, useMemo, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Building2,
  Building,
  CalendarDays,
  Banknote,
  FileWarning,
  Umbrella,
  Wallet,
  Package,
  Briefcase,
  BarChart3,
  Cloud,
  ClipboardList,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  CalendarClock,
  HeartPulse,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { verificarPermissao } from '@/lib/permissoes'
import type { Perfil } from '@/types/database'

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
  permissao: { recurso: string; acao: string }
}

interface MenuGroup {
  id: string
  label: string
  icon: React.ReactNode
  items: MenuItem[]
}

const STORAGE_KEY = 'rh-plena-sidebar-groups'

const groups: MenuGroup[] = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: <FolderOpen className="w-5 h-5" />,
    items: [
      { path: '/colaboradores', label: 'Colaboradores', icon: <Users className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'colaboradores' } },
      { path: '/departamentos', label: 'Departamentos', icon: <Building2 className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'departamentos' } },
      { path: '/empresas', label: 'Empresas', icon: <Building className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'empresas' } },
    ],
  },
  {
    id: 'operacional',
    label: 'Operacional',
    icon: <CalendarClock className="w-5 h-5" />,
    items: [
      { path: '/escalas', label: 'Escalas', icon: <CalendarDays className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'escalas' } },
      { path: '/extras', label: 'Extras', icon: <Banknote className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'extras' } },
    ],
  },
  {
    id: 'rh',
    label: 'RH',
    icon: <HeartPulse className="w-5 h-5" />,
    items: [
      { path: '/ferias', label: 'Férias', icon: <Umbrella className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'ferias' } },
      { path: '/rh/ocorrencias', label: 'Ocorrências', icon: <FileWarning className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'rh' } },
    ],
  },
  {
    id: 'dp',
    label: 'DP',
    icon: <Briefcase className="w-5 h-5" />,
    items: [
      { path: '/adicionais', label: 'Adicionais', icon: <Briefcase className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'adicionais' } },
      { path: '/vr/projetos', label: 'Benefícios', icon: <Wallet className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'vr' } },
      { path: '/ceu/dashboard', label: 'CEU', icon: <Package className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'ceu' } },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    icon: <ShieldCheck className="w-5 h-5" />,
    items: [
      { path: '/auditoria', label: 'Auditoria', icon: <ClipboardList className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'auditoria' } },
      { path: '/importar/econtador', label: 'e-Contador', icon: <Cloud className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'econtador' } },
      { path: '/permissoes', label: 'Permissões', icon: <Shield className="w-4 h-4" />, permissao: { recurso: 'menu', acao: 'permissoes' } },
    ],
  },
]

const standaloneItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, permissao: { recurso: 'menu', acao: 'dashboard' } },
  { path: '/relatorios', label: 'Relatórios', icon: <BarChart3 className="w-5 h-5" />, permissao: { recurso: 'menu', acao: 'relatorios' } },
]

function getInitialExpandedState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore
  }
  return {}
}

export function Sidebar({ user, isOpen, onToggle, onLogout }: SidebarProps) {
  const location = useLocation()
  const podeVer = useCallback(
    (permissao: { recurso: string; acao: string }) =>
      verificarPermissao(user.nivel_acesso, permissao.recurso, permissao.acao),
    [user.nivel_acesso]
  )

  const [expanded, setExpanded] = useState<Record<string, boolean>>(getInitialExpandedState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded))
  }, [expanded])

  const toggleGroup = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const isGroupActive = (group: MenuGroup) =>
    group.items.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => podeVer(item.permissao)),
        }))
        .filter((group) => group.items.length > 0),
    [podeVer]
  )

  const visibleStandalone = useMemo(
    () => standaloneItems.filter((item) => podeVer(item.permissao)),
    [podeVer]
  )

  const handleGroupClick = (id: string) => {
    if (!isOpen) {
      onToggle()
    }
    toggleGroup(id)
  }

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
          <img
            src="/logo_plena_cab.jpg"
            alt="Plena"
            className="h-7 w-auto object-contain rounded"
          />
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
        {/* Itens avulsos (Dashboard / Relatórios) */}
        {visibleStandalone.map((item) => (
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
        ))}

        {/* Grupos expansíveis */}
        {visibleGroups.map((group) => {
          const isActive = isGroupActive(group)
          const isExpanded = !!expanded[group.id] || isActive

          return (
            <div key={group.id} className="mt-1">
              <button
                type="button"
                onClick={() => handleGroupClick(group.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'text-white font-bold bg-white/10'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                )}
                title={group.label}
              >
                <span className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-[#94A3B8]')}>
                  {group.icon}
                </span>
                {isOpen && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-transform duration-200',
                        isExpanded ? 'rotate-180' : 'rotate-0'
                      )}
                    />
                  </>
                )}
              </button>

              {isOpen && isExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
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
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
