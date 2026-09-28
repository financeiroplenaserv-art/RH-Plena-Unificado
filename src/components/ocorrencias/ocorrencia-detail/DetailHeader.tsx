import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BadgeStatus } from '@/components/BadgeStatus'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Printer,
  CheckCircle,
  XCircle,
  SquarePen,
  Send,
  Undo2,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { parseDataLocal } from '@/lib/utils'
import type { Ocorrencia, Colaborador } from '@/types/database'

interface DetailHeaderProps {
  ocorrencia: Ocorrencia
  colaborador: Colaborador | null
  podeGerarPDF: boolean
  podeEditar: boolean
  podeAprovar: boolean
  podeValidar: boolean
  podeCancelar: boolean
  ativando: boolean
  validando: boolean
  temDocAssinado: boolean
  temDocComprobatorio: boolean
  onGerarPDF: () => void
  onEnviarValidacao: () => void
  onValidar: () => void
  onDevolver: (motivo: string) => Promise<boolean>
  onCancelar: () => void
}

import {
  TIPOS_COM_DOCUMENTO_OBRIGATORIO,
  exigeDocumentoAssinado,
} from '@/lib/ocorrencias/tiposOcorrencia'

function fmtDate(d: string) {
  return parseDataLocal(d).toLocaleDateString('pt-BR')
}

export function DetailHeader({
  ocorrencia,
  colaborador,
  podeGerarPDF,
  podeEditar,
  podeAprovar,
  podeValidar,
  podeCancelar,
  ativando,
  validando,
  temDocAssinado,
  temDocComprobatorio,
  onGerarPDF,
  onEnviarValidacao,
  onValidar,
  onDevolver,
  onCancelar,
}: DetailHeaderProps) {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [dialogDevolverAberto, setDialogDevolverAberto] = useState(false)
  const [motivoDevolucao, setMotivoDevolucao] = useState('')

  const isPendente = ocorrencia.status === 'Pendente'
  const isAguardandoValidacao = ocorrencia.status === 'Aguardando Validação'
  const isAtiva = ocorrencia.status === 'Ativa'

  const exigeAssinado = exigeDocumentoAssinado(ocorrencia.tipo_penalidade || '')
  const podeEnviar = temDocComprobatorio && (!exigeAssinado || temDocAssinado)
  const tooltipEnviar = podeEnviar
    ? 'Enviar os documentos para validação do DP/admin'
    : exigeAssinado && !temDocAssinado && !temDocComprobatorio
      ? 'Anexe o documento assinado e o documento comprobatório do motivo da sanção para enviar para validação'
      : exigeAssinado && !temDocAssinado
        ? 'Falta anexar o documento assinado para enviar para validação'
        : 'Falta anexar o documento comprobatório do motivo da sanção para enviar para validação'

  const confirmarDevolucao = async () => {
    const ok = await onDevolver(motivoDevolucao)
    if (ok) {
      setDialogDevolverAberto(false)
      setMotivoDevolucao('')
    }
  }

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
              onClick={onEnviarValidacao}
              disabled={ativando || !podeEnviar}
              className="gap-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              title={tooltipEnviar}
            >
              <Send className="h-3.5 w-3.5" />
              {ativando ? 'Enviando...' : 'Enviar para validação'}
            </Button>
          )}
        {isAguardandoValidacao && podeValidar && (
          <>
            <Button
              size="sm"
              onClick={onValidar}
              disabled={validando}
              className="gap-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              title="Dar os documentos como satisfatórios e ativar a ocorrência"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {validando ? 'Validando...' : 'Validar documentos'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogDevolverAberto(true)}
              disabled={validando}
              className="gap-1 text-xs h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
              title="Devolver para o operador corrigir os documentos"
            >
              <Undo2 className="h-3.5 w-3.5" /> Devolver
            </Button>
          </>
        )}
        {(isPendente || isAguardandoValidacao || isAtiva) && podeCancelar && (
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

      <Dialog open={dialogDevolverAberto} onOpenChange={setDialogDevolverAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver ocorrência</DialogTitle>
            <DialogDescription>
              A ocorrência volta para Pendente e o motivo fica registrado para o operador corrigir
              os documentos.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Motivo da devolução (obrigatório)</Label>
            <Textarea
              value={motivoDevolucao}
              onChange={(e) => setMotivoDevolucao(e.target.value)}
              placeholder="Ex.: o anexo enviado não é o documento comprobatório, refaça o upload do atestado..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogDevolverAberto(false)}>
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={confirmarDevolucao}
              disabled={validando || !motivoDevolucao.trim()}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
            >
              {validando ? 'Devolvendo...' : 'Confirmar devolução'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
