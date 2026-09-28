import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import type { Ocorrencia } from '@/types/database'
import { exigeDocumentoAssinado, TIPOS_SEM_ASSINATURA_OBRIGATORIA } from '@/lib/ocorrencias/tiposOcorrencia'

interface StatusBannerProps {
  ocorrencia: Ocorrencia
  anexosCount: number
  temDocAssinado: boolean
  temDocComprobatorio: boolean
}

export function StatusBanner({
  ocorrencia,
  anexosCount,
  temDocAssinado,
  temDocComprobatorio,
}: StatusBannerProps) {
  if (ocorrencia.status === 'Pendente') {
    const exigeAssinado = exigeDocumentoAssinado(ocorrencia.tipo_penalidade || '')
    const pendencias: string[] = []
    if (exigeAssinado && !temDocAssinado) pendencias.push('documento assinado')
    if (!temDocComprobatorio) pendencias.push('documento comprobatório do motivo da sanção')
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-800">Documentos pendentes (controle interno)</p>
          <p className="text-xs text-orange-700 mt-1">
            {exigeAssinado ? (
              <>
                Para ocorrências do tipo <strong>{ocorrencia.tipo_penalidade}</strong>, é obrigatório
                anexar o documento assinado e o documento comprobatório do motivo da sanção.
              </>
            ) : TIPOS_SEM_ASSINATURA_OBRIGATORIA.includes(ocorrencia.tipo_penalidade || '') ? (
              <>
                Para ocorrências do tipo <strong>{ocorrencia.tipo_penalidade}</strong>, é obrigatório
                anexar apenas o documento comprobatório (atestado médico) — o documento assinado pelo
                colaborador não é exigido neste tipo.
              </>
            ) : (
              <>
                Para ocorrências do tipo <strong>{ocorrencia.tipo_penalidade}</strong>, anexe apenas o
                documento comprobatório — o documento assinado pelo colaborador não é exigido neste
                tipo.
              </>
            )}{' '}
            O PDF para assinatura do colaborador não mostra o status "Pendente" — isso é controle
            interno do RH.
          </p>
          {ocorrencia.devolucao_motivo && (
            <p className="text-xs font-medium text-red-700 mt-2">
              Devolvida para correção: {ocorrencia.devolucao_motivo}
            </p>
          )}
          <p className="text-xs text-orange-600 mt-2">
            Anexos atuais: <strong>{anexosCount}</strong>
            {pendencias.length === 0
              ? ' (pronto para enviar para validação)'
              : ` (falta anexar: ${pendencias.join(' e ')})`}
          </p>
        </div>
      </div>
    )
  }

  if (ocorrencia.status === 'Aguardando Validação') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Clock className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800">Aguardando validação dos documentos</p>
          <p className="text-xs text-blue-700 mt-1">
            Os documentos foram anexados e enviados para conferência. A ocorrência só fica ativa
            quando um perfil admin/adm/dp validar que os anexos são o comprobatório e o documento
            assinado corretos. Se algo estiver errado, ela pode ser devolvida para correção.
          </p>
        </div>
      </div>
    )
  }

  if (ocorrencia.status === 'Ativa') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Ocorrência ativa</p>
          <p className="text-xs text-emerald-700 mt-1">
            Esta ocorrência está ativa com {anexosCount} documento(s) anexado(s).
          </p>
        </div>
      </div>
    )
  }

  return null
}
