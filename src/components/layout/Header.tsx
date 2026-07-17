import { Bell, User } from 'lucide-react'
import { LogoMarca } from '@/components/LogoMarca'
import type { Perfil } from '@/types/database'

interface HeaderProps {
  user: Perfil
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <LogoMarca size={36} alt="Plena" />
        <div className="hidden sm:block h-6 w-px bg-slate-200" />
        <div className="hidden sm:block">
          <h1 className="text-lg font-semibold text-slate-900">CORH</h1>
          <p className="text-xs text-slate-500">Controle Operacional e de RH</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white">
            <User className="w-4 h-4" />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{user.nome || user.email}</p>
            <p className="text-xs text-slate-500 uppercase">{user.nivel_acesso}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
