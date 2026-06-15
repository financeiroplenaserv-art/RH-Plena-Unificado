import { Bell, User, RefreshCw, CheckCircle2 } from 'lucide-react'
import type { Perfil } from '@/types/database'

interface CeuHeaderProps {
  user: Perfil
}

export function CeuHeader({ user }: CeuHeaderProps) {
  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Controle CEU</h1>
        <p className="text-xs text-slate-500">Módulo de Controle de EPIs e Uniformes</p>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#1E3A5F', color: '#FFFFFF' }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sincronizado</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        </div>

        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: '#1E3A5F' }}
          >
            <User className="w-4 h-4" />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user.nome || user.email}</p>
            <p className="text-xs text-slate-500 capitalize">{user.nivel_acesso}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
