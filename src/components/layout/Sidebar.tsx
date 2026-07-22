import { useState, useEffect, useMemo, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogoMarca } from '@/components/LogoMarca'
import {
  LayoutGrid,
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
  ChevronDown,
  FolderOpen,
  CalendarClock,
  HeartPulse,
  ShieldCheck,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { verificarPermissao } from '@/lib/permissoes'
import type { Perfil } from '@/types/database'

interface SidebarProps {
  user: Perfil
  isOpen: boolean
  onToggle: () => void
  onLogout: () => void
  /** Quando true, renderiza para o drawer mobile (sem fixed/hidden, ocupa o container) */
  mobile?: boolean
}

interface MenuItem {
  path: string
  label: string
  icon: React.ElementType
  permissao: { recurso: string; acao: string }
}

interface MenuGroup {
  id: string
  label: string
  icon: React.ElementType
  items: MenuItem[]
}

const STORAGE_KEY = 'rh-plena-sidebar-groups'

const groups: MenuGroup[] = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: FolderOpen,
    items: [
      { path: '/colaboradores', label: 'Colaboradores', icon: Users, permissao: { recurso: 'menu', acao: 'colaboradores' } },
      { path: '/departamentos', label: 'Departamentos', icon: Building2, permissao: { recurso: 'menu', acao: 'departamentos' } },
      { path: '/empresas', label: 'Empresas', icon: Building, permissao: { recurso: 'menu', acao: 'empresas' } },
    ],
  },
  {
    id: 'operacional',
    label: 'Operacional',
    icon: CalendarClock,
    items: [
      { path: '/escalas', label: 'Escalas', icon: CalendarDays, permissao: { recurso: 'menu', acao: 'escalas' } },
      { path: '/extras', label: 'Extras', icon: Banknote, permissao: { recurso: 'menu', acao: 'extras' } },
    ],
  },
  {
    id: 'rh',
    label: 'RH',
    icon: HeartPulse,
    items: [
      { path: '/ferias', label: 'Férias', icon: Umbrella, permissao: { recurso: 'menu', acao: 'ferias' } },
      { path: '/rh/ocorrencias', label: 'Ocorrências', icon: FileWarning, permissao: { recurso: 'menu', acao: 'rh' } },
    ],
  },
  {
    id: 'dp',
    label: 'DP',
    icon: Briefcase,
    items: [
      { path: '/adicionais', label: 'Adicionais', icon: Briefcase, permissao: { recurso: 'menu', acao: 'adicionais' } },
      { path: '/vr/projetos', label: 'Benefícios', icon: Wallet, permissao: { recurso: 'menu', acao: 'vr' } },
      { path: '/ceu/movimentacoes', label: 'CEU', icon: Package, permissao: { recurso: 'menu', acao: 'ceu' } },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    icon: ShieldCheck,
    items: [
      { path: '/auditoria', label: 'Auditoria', icon: ClipboardList, permissao: { recurso: 'menu', acao: 'auditoria' } },
      { path: '/importar/econtador', label: 'e-Contador', icon: Cloud, permissao: { recurso: 'menu', acao: 'econtador' } },
      { path: '/permissoes', label: 'Permissões', icon: Shield, permissao: { recurso: 'menu', acao: 'permissoes' } },
    ],
  },
]

const topItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutGrid, permissao: { recurso: 'menu', acao: 'dashboard' } },
]

const bottomItems: MenuItem[] = [
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3, permissao: { recurso: 'menu', acao: 'relatorios' } },
]

function getInitialExpandedState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore
  }
  return { cadastros: true }
}

export function Sidebar({ user, isOpen, onToggle, onLogout, mobile = false }: SidebarProps) {
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

  const visibleTop = useMemo(() => topItems.filter((item) => podeVer(item.permissao)), [podeVer])
  const visibleBottom = useMemo(() => bottomItems.filter((item) => podeVer(item.permissao)), [podeVer])

  const navItemBase =
    'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors'
  const navItemInactive = 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white'
  const navItemActive =
    'bg-[#0F6CBD] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_14px_-4px_rgba(15,108,189,0.7)]'
  const iconBase = 'size-4 shrink-0 transition-colors'
  const iconInactive = 'text-sidebar-foreground/50 group-hover:text-white'
  const iconActive = 'text-white'

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <LogoMarca size={40} alt="Plena" coracao="branco" className="[&_svg]:size-10 [&_img]:size-10" />
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight text-white">CORH</p>
          <p className="text-[10px] text-sidebar-foreground/60">Controle Operacional e de RH</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {visibleTop.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(navItemBase, isActive ? navItemActive : navItemInactive)}
          >
            {({ isActive }) => (
              <>
                <item.icon strokeWidth={1.8} className={cn(iconBase, isActive ? iconActive : iconInactive)} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}

        {visibleGroups.map((group) => {
          const active = isGroupActive(group)
          const isExpanded = !!expanded[group.id] || active
          const GroupIcon = group.icon

          return (
            <div key={group.id} className="mt-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn(navItemBase, navItemInactive)}
              >
                <GroupIcon strokeWidth={1.8} className={cn(iconBase, iconInactive)} />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={cn('ml-auto size-3.5 text-sidebar-foreground/40 transition-transform', !isExpanded && '-rotate-90')}
                />
              </button>

              {isExpanded && (
                <div className="mt-0.5 space-y-0.5 pl-3">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => cn(navItemBase, 'pl-9', isActive ? navItemActive : navItemInactive)}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon strokeWidth={1.8} className={cn(iconBase, isActive ? iconActive : iconInactive)} />
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

        {visibleBottom.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(navItemBase, isActive ? navItemActive : navItemInactive)}
          >
            {({ isActive }) => (
              <>
                <item.icon strokeWidth={1.8} className={cn(iconBase, isActive ? iconActive : iconInactive)} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onLogout}
          className={cn(
            navItemBase,
            'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white'
          )}
        >
          <LogOut strokeWidth={1.8} className={cn(iconBase, iconInactive)} />
          <span>Sair</span>
        </button>
      </div>
    </>
  )

  if (mobile) {
    return (
      <aside className="flex h-full w-full flex-col bg-sidebar">
        {sidebarContent}
      </aside>
    )
  }

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          'fixed left-0 top-0 hidden h-screen shrink-0 flex-col bg-sidebar lg:flex',
          isOpen ? 'w-60' : 'w-16'
        )}
      >
        {isOpen ? (
          sidebarContent
        ) : (
          <div className="flex h-full flex-col items-center py-4">
            <button onClick={onToggle} className="mb-6 rounded-lg p-2 text-sidebar-foreground/50 hover:bg-white/5 hover:text-white">
              <Menu className="size-5" />
            </button>
            <div className="flex-1 space-y-2 overflow-y-auto px-2">
              {visibleTop.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex size-9 items-center justify-center rounded-lg transition-colors',
                      isActive ? 'bg-[#0F6CBD] text-white' : 'text-sidebar-foreground/50 hover:bg-white/5 hover:text-white'
                    )
                  }
                  title={item.label}
                >
                  <item.icon strokeWidth={1.8} className="size-4" />
                </NavLink>
              ))}
              {visibleGroups.map((group) => (
                <div key={group.id} className="space-y-1">
                  <group.icon strokeWidth={1.8} className="mx-auto size-4 text-sidebar-foreground/40" />
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        cn(
                          'flex size-9 items-center justify-center rounded-lg transition-colors',
                          isActive ? 'bg-[#0F6CBD] text-white' : 'text-sidebar-foreground/50 hover:bg-white/5 hover:text-white'
                        )
                      }
                      title={item.label}
                    >
                      <item.icon strokeWidth={1.8} className="size-4" />
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>
            <button
              onClick={onLogout}
              className="mt-auto rounded-lg p-2 text-sidebar-foreground/50 hover:bg-white/5 hover:text-white"
              title="Sair"
            >
              <LogOut strokeWidth={1.8} className="size-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
