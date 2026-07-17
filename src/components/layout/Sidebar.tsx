import { useState, useEffect, useMemo, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogoMarca } from '@/components/LogoMarca'
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
  color: string
  permissao: { recurso: string; acao: string }
}

interface MenuGroup {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  items: MenuItem[]
}

const STORAGE_KEY = 'rh-plena-sidebar-groups'

const groups: MenuGroup[] = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: <FolderOpen className="w-5 h-5" />,
    color: '#7C3AED',
    items: [
      { path: '/colaboradores', label: 'Colaboradores', icon: <Users className="w-4 h-4" />, color: '#059669', permissao: { recurso: 'menu', acao: 'colaboradores' } },
      { path: '/departamentos', label: 'Departamentos', icon: <Building2 className="w-4 h-4" />, color: '#7C3AED', permissao: { recurso: 'menu', acao: 'departamentos' } },
      { path: '/empresas', label: 'Empresas', icon: <Building className="w-4 h-4" />, color: '#4F46E5', permissao: { recurso: 'menu', acao: 'empresas' } },
    ],
  },
  {
    id: 'operacional',
    label: 'Operacional',
    icon: <CalendarClock className="w-5 h-5" />,
    color: '#EA580C',
    items: [
      { path: '/escalas', label: 'Escalas', icon: <CalendarDays className="w-4 h-4" />, color: '#EA580C', permissao: { recurso: 'menu', acao: 'escalas' } },
      { path: '/extras', label: 'Extras', icon: <Banknote className="w-4 h-4" />, color: '#DC2626', permissao: { recurso: 'menu', acao: 'extras' } },
    ],
  },
  {
    id: 'rh',
    label: 'RH',
    icon: <HeartPulse className="w-5 h-5" />,
    color: '#E11D48',
    items: [
      { path: '/ferias', label: 'Férias', icon: <Umbrella className="w-4 h-4" />, color: '#0891B2', permissao: { recurso: 'menu', acao: 'ferias' } },
      { path: '/rh/ocorrencias', label: 'Ocorrências', icon: <FileWarning className="w-4 h-4" />, color: '#D97706', permissao: { recurso: 'menu', acao: 'rh' } },
    ],
  },
  {
    id: 'dp',
    label: 'DP',
    icon: <Briefcase className="w-5 h-5" />,
    color: '#0D9488',
    items: [
      { path: '/adicionais', label: 'Adicionais', icon: <Briefcase className="w-4 h-4" />, color: '#475569', permissao: { recurso: 'menu', acao: 'adicionais' } },
      { path: '/vr/projetos', label: 'Benefícios', icon: <Wallet className="w-4 h-4" />, color: '#10B981', permissao: { recurso: 'menu', acao: 'vr' } },
      { path: '/ceu/movimentacoes', label: 'CEU', icon: <Package className="w-4 h-4" />, color: '#9333EA', permissao: { recurso: 'menu', acao: 'ceu' } },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    icon: <ShieldCheck className="w-5 h-5" />,
    color: '#9333EA',
    items: [
      { path: '/auditoria', label: 'Auditoria', icon: <ClipboardList className="w-4 h-4" />, color: '#F97316', permissao: { recurso: 'menu', acao: 'auditoria' } },
      { path: '/importar/econtador', label: 'e-Contador', icon: <Cloud className="w-4 h-4" />, color: '#0EA5E9', permissao: { recurso: 'menu', acao: 'econtador' } },
      { path: '/permissoes', label: 'Permissões', icon: <Shield className="w-4 h-4" />, color: '#E11D48', permissao: { recurso: 'menu', acao: 'permissoes' } },
    ],
  },
]

const topItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, color: '#2563EB', permissao: { recurso: 'menu', acao: 'dashboard' } },
]

const bottomItems: MenuItem[] = [
  { path: '/relatorios', label: 'Relatórios', icon: <BarChart3 className="w-5 h-5" />, color: '#2563EB', permissao: { recurso: 'menu', acao: 'relatorios' } },
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

  const visibleTop = useMemo(
    () => topItems.filter((item) => podeVer(item.permissao)),
    [podeVer]
  )

  const visibleBottom = useMemo(
    () => bottomItems.filter((item) => podeVer(item.permissao)),
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
        'fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50 bg-white border-r border-slate-200',
        isOpen ? 'w-60' : 'w-16'
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
        {isOpen ? (
          <div className="flex items-center gap-3">
            <LogoMarca size={36} alt="Plena" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">CORH</h1>
              <p className="text-[10px] text-slate-500 leading-tight">Controle Operacional e de RH</p>
            </div>
          </div>
        ) : (
          <LogoMarca size={32} alt="Plena" className="mx-auto" />
        )}
        <button
          onClick={onToggle}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            isOpen ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900' : 'mx-auto text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          )}
          title={isOpen ? 'Recolher menu' : 'Expandir menu'}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {/* Itens avulsos no topo (Dashboard) */}
        {visibleTop.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'text-[#0F5EDD] font-semibold bg-[#F0F7FF]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              )
            }
          >
            {() => (
              <>
                <span className="flex-shrink-0" style={{ color: item.color }}>
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
                    ? 'text-[#0F5EDD] font-semibold bg-[#F0F7FF]'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                )}
                title={group.label}
              >
                <span className="flex-shrink-0" style={{ color: group.color }}>
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
                <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-2">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                          isActive
                            ? 'text-[#0F5EDD] font-semibold bg-[#F0F7FF]'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        )
                      }
                    >
                      {() => (
                        <>
                          <span className="flex-shrink-0" style={{ color: item.color }}>
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

        {/* Itens avulsos no final (Relatórios) */}
        {visibleBottom.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'text-[#0F5EDD] font-semibold bg-[#F0F7FF]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              )
            }
          >
            {() => (
              <>
                <span className="flex-shrink-0" style={{ color: item.color }}>
                  {item.icon}
                </span>
                {isOpen && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-slate-200">
        <button
          onClick={onLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 w-full transition-colors',
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
