import { useState } from 'react'
import { Bell, ChevronRight, LifeBuoy, Menu, ShieldCheck } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TermoLGPDDialog } from '@/components/layout/TermoLGPDDialog'
import { SuporteDialog } from '@/components/layout/SuporteDialog'
import type { Perfil } from '@/types/database'

interface HeaderProps {
  user: Perfil
  onMenuToggle?: () => void
}

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/colaboradores': 'Colaboradores',
  '/departamentos': 'Departamentos',
  '/empresas': 'Empresas',
  '/escalas': 'Escalas',
  '/escalas/importar': 'Importar',
  '/escalas/locais': 'Locais',
  '/escalas/mapeamento': 'Mapeamento',
  '/extras': 'Extras',
  '/extras/lancamentos': 'Lançamentos',
  '/extras/novo': 'Novo',
  '/extras/balanco': 'Balanço',
  '/extras/relatorio': 'Relatório',
  '/extras/recibos': 'Recibos',
  '/extras/categorias': 'Categorias',
  '/extras/mobile': 'Plantão',
  '/ferias': 'Férias',
  '/rh': 'RH',
  '/rh/ocorrencias': 'Ocorrências',
  '/rh/ocorrencias/novo': 'Nova ocorrência',
  '/rh/alertas': 'Alertas',
  '/rh/importar': 'Importar',
  '/rh/modelos': 'Modelos',
  '/adicionais': 'Adicionais',
  '/adicionais/contratos': 'Contratos',
  '/adicionais/vinculos': 'Vínculos',
  '/adicionais/calendario': 'Calendário',
  '/adicionais/relatorio': 'Relatório',
  '/adicionais/importar-ponto': 'Importar ponto',
  '/vr': 'Benefícios',
  '/vr/projetos': 'Projetos',
  '/vr/projetos/novo': 'Novo projeto',
  '/ceu': 'CEU',
  '/ceu/movimentacoes': 'Movimentações',
  '/ceu/itens': 'Itens',
  '/ceu/fornecedores': 'Fornecedores',
  '/ceu/lancamento-rapido': 'Lançamento rápido',
  '/ceu/relatorios': 'Relatórios',
  '/ceu/importar': 'Importar',
  '/auditoria': 'Auditoria',
  '/importar/econtador': 'e-Contador',
  '/permissoes': 'Permissões',
  '/configuracoes': 'Configurações',
  '/relatorios': 'Relatórios',
  '/mobile/falta': 'Lançar falta',
}

function iniciais(nome?: string | null): string {
  const limpo = nome?.trim()
  if (!limpo) return 'U'
  const partes = limpo.split(' ').filter(Boolean)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function buildBreadcrumb(pathname: string): string[] {
  const base = routeLabels[pathname]
  if (!base) return ['Dashboard']

  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return ['Dashboard']

  const crumbs: string[] = []
  let current = ''
  for (let i = 0; i < parts.length; i++) {
    current += `/${parts[i]}`
    const label = routeLabels[current]
    if (label) crumbs.push(label)
  }

  if (crumbs.length === 0) crumbs.push('Dashboard')
  return crumbs
}

export function Header({ user, onMenuToggle }: HeaderProps) {
  const location = useLocation()
  const breadcrumb = buildBreadcrumb(location.pathname)
  const displayName = user.nome || user.email || 'Usuário'
  const perfil = user.nivel_acesso?.toUpperCase() || 'VISUALIZADOR'
  const [termoAberto, setTermoAberto] = useState(false)
  const [suporteAberto, setSuporteAberto] = useState(false)

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
      <button
        type="button"
        onClick={onMenuToggle}
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <nav className="hidden flex-1 items-center gap-1.5 overflow-hidden text-[13px] text-muted-foreground md:flex">
        {breadcrumb.map((b, i) => (
          <span key={`${b}-${i}`} className="flex items-center gap-1.5 shrink-0">
            {i > 0 && <ChevronRight className="size-3.5" />}
            <span className={cn(i === breadcrumb.length - 1 && 'font-semibold text-foreground')}>
              {b}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSuporteAberto(true)}
          title="Ajuda e suporte"
          className="flex size-9 items-center justify-center rounded-full border border-input bg-white text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        >
          <LifeBuoy className="size-4" />
        </button>

        <button className="relative flex size-9 items-center justify-center rounded-full border border-input bg-white text-muted-foreground transition hover:border-primary/40 hover:text-primary">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-full border border-input bg-white py-1 pl-1 pr-3 transition hover:border-primary/40"
            >
              <div className="bg-brand-gradient-soft flex size-7 items-center justify-center rounded-full text-[11px] font-bold text-white">
                {iniciais(displayName)}
              </div>
              <div className="hidden leading-tight md:block text-left">
                <p className="text-[12px] font-semibold text-foreground">{displayName}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-primary">{perfil}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="leading-tight">
              <p className="text-sm font-semibold">{displayName}</p>
              {user.email && <p className="text-xs font-normal text-muted-foreground">{user.email}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setTermoAberto(true)} className="cursor-pointer">
              <ShieldCheck className="size-4 text-emerald-600" />
              Termo de privacidade (LGPD)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSuporteAberto(true)} className="cursor-pointer">
              <LifeBuoy className="size-4 text-primary" />
              Ajuda e suporte
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TermoLGPDDialog open={termoAberto} onOpenChange={setTermoAberto} />
      <SuporteDialog open={suporteAberto} onOpenChange={setSuporteAberto} user={user} />
    </header>
  )
}
