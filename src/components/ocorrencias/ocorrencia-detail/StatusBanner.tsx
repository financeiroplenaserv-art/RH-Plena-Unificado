import { AlertTriangle, CheckCircle } from 'lucide-react'
import type { Ocorrencia } from '@/types/database'

interface StatusBannerProps {
  ocorrencia: Ocorrencia
  anexosCount: number
}

export function StatusBanner({ ocorrencia, anexosCount }: StatusBannerProps) {
  if (ocorrencia.status === 'Pendente') {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-800">Documentos pendentes (controle interno)</p>
          <p className="text-xs text-orange-700 mt-1">
            Para ocorrências do tipo <strong>{ocorrencia.tipo_penalidade}</strong>, é obrigatório
            anexar documentos comprobatórios. O PDF para assinatura do colaborador não mostra o
            status "Pendente" — isso é controle interno do RH.
          </p>
          <p className="text-xs text-orange-600 mt-2">
            Anexos atuais: <strong>{anexosCount}</strong>
            {anexosCount === 0
              ? ' (anexe pelo menos 1 documento para ativar)'
              : ' (pronto para ativar)'}
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
