import { Button } from '@/components/ui/button'
import { BadgeStatus } from '@/components/BadgeStatus'
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  XCircle,
  SquarePen,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Ocorrencia, Colaborador } from '@/types/database'

interface DetailHeaderProps {
  ocorrencia: Ocorrencia
  colaborador: Colaborador | null
  podeGerarPDF: boolean
  podeEditar: boolean
  podeAprovar: boolean
  podeCancelar: boolean
  ativando: boolean
  anexosCount: number
  onGerarPDF: () => void
  onAtivar: () => void
  onCancelar: () => void
}

import {
  TIPOS_COM_DOCUMENTO_OBRIGATORIO,
} from '@/lib/ocorrencias/tiposOcorrencia'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export function DetailHeader({
  ocorrencia,
  colaborador,
  podeGerarPDF,
  podeEditar,
  podeAprovar,
  podeCancelar,
  ativando,
  anexosCount,
  onGerarPDF,
  onAtivar,
  onCancelar,
}: DetailHeaderProps) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const isPendente = ocorrencia.status === 'Pendente'
  const isAtiva = ocorrencia.status === 'Ativa'

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/rh/ocorrencias')}
          className="gap-1 h-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {ocorrencia.titulo || `Ocorrência #${ocorrencia.id?.substring(0, 8).toUpperCase()}`}
            </h2>
            <BadgeStatus status={ocorrencia.status} />
          </div>
          <p className="text-xs text-slate-500">
            #{ocorrencia.id?.substring(0, 8).toUpperCase()} | {ocorrencia.tipo_ocorrencia} |{' '}
            {fmtDate(ocorrencia.data_ocorrencia)}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        {podeGerarPDF && colaborador && (
          <Button
            variant="outline"
            size="sm"
            onClick={onGerarPDF}
            className="gap-1 text-xs h-8"
          >
            <Printer className="h-3.5 w-3.5" /> Gerar PDF
          </Button>
        )}
        {podeEditar && ocorrencia.status !== 'Cancelada' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/rh/ocorrencias/${id}/editar`)}
            className="gap-1 text-xs h-8"
          >
            <SquarePen className="h-3.5 w-3.5" /> Editar
          </Button>
        )}
        {isPendente &&
          podeAprovar &&
          TIPOS_COM_DOCUMENTO_OBRIGATORIO.includes(ocorrencia.tipo_penalidade || '') && (
            <Button
              size="sm"
              onClick={onAtivar}
              disabled={ativando || anexosCount === 0}
              className="gap-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              title={anexosCount === 0 ? 'Anexe documentos para ativar' : 'Ativar ocorrência'}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {ativando ? 'Ativando...' : 'Ativar'}
            </Button>
          )}
        {(isPendente || isAtiva) && podeCancelar && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancelar}
            className="gap-1 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancelar
          </Button>
        )}
      </div>
    </div>
  )
}
