import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FiltrosAtivosBadgeProps {
  /** Quantidade de filtros aplicados fora do valor padrão. Com 0, renderiza null. */
  total: number
  /** Quando informado, exibe o botão "Limpar" dentro do pill. */
  onLimpar?: () => void
  className?: string
}

/**
 * Indicador de filtros ativos para telas com filtro persistido
 * (useFiltroPersistente). Como o filtro sobrevive à navegação, sem este
 * selo o usuário volta à tela e vê uma lista filtrada sem saber — parece
 * que o filtro "vazou" de outra tela. Quem conta os filtros é a página.
 */
export function FiltrosAtivosBadge({ total, onLimpar, className }: FiltrosAtivosBadgeProps) {
  if (total === 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-[#0F6CBD]/10 px-2.5 py-1 text-[11px] font-semibold text-[#0F6CBD]',
        className
      )}
    >
      {total} {total === 1 ? 'filtro ativo' : 'filtros ativos'}
      {onLimpar && (
        <button
          type="button"
          onClick={onLimpar}
          className="inline-flex items-center gap-0.5 rounded-full px-1 font-semibold hover:bg-[#0F6CBD]/20"
          title="Limpar filtros"
        >
          <X className="size-3" />
          Limpar
        </button>
      )}
    </span>
  )
}
