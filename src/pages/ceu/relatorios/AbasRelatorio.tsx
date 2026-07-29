import { ABAS, type AbaId } from './abas'

interface AbasRelatorioProps {
  abaAtiva: AbaId
  onAbaChange: (aba: AbaId) => void
}

export function AbasRelatorio({ abaAtiva, onAbaChange }: AbasRelatorioProps) {
  return (
    <div className="border-b border-slate-200">
      <div className="flex flex-wrap gap-1">
        {ABAS.map((aba) => {
          const Icon = aba.icon
          const ativa = aba.id === abaAtiva
          return (
            <button
              key={aba.id}
              onClick={() => onAbaChange(aba.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                ativa
                  ? 'border-[#3B82F6] text-[#1E40AF]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {aba.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
