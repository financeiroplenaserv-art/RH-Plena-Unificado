import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginacaoProps {
  pagina: number
  totalPaginas: number
  totalRegistros: number
  tamanho?: number
  onPaginaAnterior: () => void
  onPaginaProxima: () => void
  onIrParaPagina?: (pagina: number) => void
  carregando?: boolean
}

export function Paginacao({
  pagina,
  totalPaginas,
  totalRegistros,
  tamanho = 50,
  onPaginaAnterior,
  onPaginaProxima,
  carregando,
}: PaginacaoProps) {
  if (totalPaginas <= 1) return null

  const inicio = totalRegistros === 0 ? 0 : pagina * tamanho + 1
  const fim = Math.min((pagina + 1) * tamanho, totalRegistros)

  return (
    <div className="flex items-center justify-between px-2 py-3 border-t border-slate-200">
      <p className="text-sm text-[#94A3B8]">
        Mostrando <span className="font-medium text-[#1F2937]">{inicio}</span> a{' '}
        <span className="font-medium text-[#1F2937]">{fim}</span> de{' '}
        <span className="font-medium text-[#1F2937]">{totalRegistros}</span> resultados
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPaginaAnterior}
          disabled={pagina === 0 || carregando}
          className="border-[#E2E8F0] text-[#1F2937] hover:bg-slate-50 rounded-[8px] h-8 px-3"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Anterior
        </Button>
        <span className="text-sm text-[#64748B] min-w-[80px] text-center">
          Página {pagina + 1} de {totalPaginas}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onPaginaProxima}
          disabled={pagina >= totalPaginas - 1 || carregando}
          className="border-[#E2E8F0] text-[#1F2937] hover:bg-slate-50 rounded-[8px] h-8 px-3"
        >
          Próxima
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
