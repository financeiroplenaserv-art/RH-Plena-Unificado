import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Ocorrencia } from '@/types/database'

interface DadosOcorrenciaCardProps {
  ocorrencia: Ocorrencia
  empresa: { nome: string; cnpj: string | null } | null
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR')
}

export function DadosOcorrenciaCard({ ocorrencia, empresa }: DadosOcorrenciaCardProps) {
  return (
    <Card className="border-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Dados da Ocorrência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {empresa && (
          <div className="flex justify-between">
            <span className="text-slate-500 text-xs">Empresa</span>
            <span className="text-slate-800">
              {empresa.nome}
              {empresa.cnpj ? ` (CNPJ: ${empresa.cnpj})` : ''}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">Título</span>
          <span className="text-slate-800 font-medium">{ocorrencia.titulo || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">Tipo</span>
          <span className="text-slate-800">{ocorrencia.tipo_ocorrencia}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">Data</span>
          <span className="text-slate-800">{fmtDate(ocorrencia.data_ocorrencia)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">Status</span>
          <span className="text-slate-800">{ocorrencia.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 text-xs">Registro</span>
          <span className="text-slate-800">{fmtDateTime(ocorrencia.created_at || '')}</span>
        </div>
        <div className="pt-2 border-t border-slate-100">
          <span className="text-slate-500 text-xs block mb-1">Descrição</span>
          <p className="text-slate-700 text-xs leading-relaxed">{ocorrencia.descricao}</p>
        </div>
        {ocorrencia.defesa_funcionario && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-slate-500 text-xs block mb-1">Defesa do Funcionário</span>
            <p className="text-slate-700 text-xs leading-relaxed">
              {ocorrencia.defesa_funcionario}
            </p>
          </div>
        )}
        {ocorrencia.medida_corretiva && (
          <div className="pt-2 border-t border-slate-100">
            <span className="text-slate-500 text-xs block mb-1">Medida Corretiva</span>
            <p className="text-slate-700 text-xs leading-relaxed">
              {ocorrencia.medida_corretiva}
            </p>
          </div>
        )}
        {ocorrencia.prazo_acompanhamento && (
          <div className="flex justify-between pt-2 border-t border-slate-100">
            <span className="text-slate-500 text-xs">Prazo de Acompanhamento</span>
            <span className="text-slate-800">{fmtDate(ocorrencia.prazo_acompanhamento)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
